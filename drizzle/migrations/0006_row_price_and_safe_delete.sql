ALTER TABLE public.hall_rows ADD COLUMN IF NOT EXISTS price bigint;
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_show_hall()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.halls h WHERE h.id = NEW.hall_id AND h.director_id = NEW.director_id
     AND (h.deleted_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.hall_id = OLD.hall_id))) THEN
    RAISE EXCEPTION 'hall does not belong to director';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date before start_date';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.booth_sell(_director uuid, _session uuid, _access uuid, _operator text, _seats uuid[])
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s record; tx uuid; n int; seat record; total bigint;
BEGIN
  SELECT ss.id, ss.starts_at, ss.hall_id, sh.title, sh.price, h.name AS hall_name
    INTO s FROM show_sessions ss JOIN shows sh ON sh.id = ss.show_id JOIN halls h ON h.id = ss.hall_id
   WHERE ss.id = _session AND ss.director_id = _director AND ss.is_active AND sh.is_active AND sh.deleted_at IS NULL;
  IF s IS NULL THEN RAISE EXCEPTION 'session_unavailable'; END IF;
  SELECT count(*) INTO n FROM seats WHERE id = ANY(_seats) AND hall_id = s.hall_id AND is_active AND number > 0;
  IF n <> array_length(_seats, 1) THEN RAISE EXCEPTION 'seat_invalid'; END IF;
  PERFORM 1 FROM seats WHERE id = ANY(_seats) FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tickets WHERE session_id = _session AND seat_id = ANY(_seats) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'seat_sold';
  END IF;
  SELECT coalesce(sum(coalesce(r.price, s.price)), 0) INTO total
    FROM seats se JOIN hall_rows r ON r.id = se.row_id WHERE se.id = ANY(_seats);
  INSERT INTO transactions (director_id, session_id, operator_name, operator_access_id, total_amount)
  VALUES (_director, _session, _operator, _access, total) RETURNING id INTO tx;
  FOR seat IN SELECT se.id, se.number, r.label, coalesce(r.price, s.price) AS p, coalesce(sc.name, '') AS sname
      FROM seats se JOIN hall_rows r ON r.id = se.row_id LEFT JOIN sections sc ON sc.id = se.section_id
      WHERE se.id = ANY(_seats) LOOP
    INSERT INTO tickets (director_id, transaction_id, session_id, seat_id, show_title, hall_name, section_name, row_label, seat_number, starts_at, price)
    VALUES (_director, tx, _session, seat.id, s.title, s.hall_name, seat.sname, seat.label, seat.number, s.starts_at, seat.p);
  END LOOP;
  RETURN tx;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_show(_show uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shows WHERE id = _show AND director_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  DELETE FROM show_sessions ss WHERE ss.show_id = _show
    AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.session_id = ss.id)
    AND NOT EXISTS (SELECT 1 FROM transactions x WHERE x.session_id = ss.id);
  IF EXISTS (SELECT 1 FROM show_sessions WHERE show_id = _show) THEN
    UPDATE show_sessions SET is_active = false WHERE show_id = _show;
    UPDATE shows SET is_active = false, deleted_at = now() WHERE id = _show;
    RETURN 'archived';
  END IF;
  DELETE FROM shows WHERE id = _show;
  RETURN 'deleted';
END $function$;

CREATE OR REPLACE FUNCTION public.delete_hall(_hall uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sh record; any_archived boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM halls WHERE id = _hall AND director_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  FOR sh IN SELECT id FROM shows WHERE hall_id = _hall LOOP
    IF public.delete_show(sh.id) = 'archived' THEN any_archived := true; END IF;
  END LOOP;
  IF any_archived OR EXISTS (SELECT 1 FROM tickets t JOIN seats se ON se.id = t.seat_id WHERE se.hall_id = _hall) THEN
    UPDATE halls SET is_active = false, deleted_at = now() WHERE id = _hall;
    RETURN 'archived';
  END IF;
  DELETE FROM seats WHERE hall_id = _hall;
  DELETE FROM hall_rows WHERE hall_id = _hall;
  DELETE FROM sections WHERE hall_id = _hall;
  DELETE FROM hall_objects WHERE hall_id = _hall;
  DELETE FROM halls WHERE id = _hall;
  RETURN 'deleted';
END $function$;

REVOKE EXECUTE ON FUNCTION public.delete_show(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_hall(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_show(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_hall(uuid) TO authenticated;