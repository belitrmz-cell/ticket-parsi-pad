ALTER TABLE public.operator_access ADD COLUMN IF NOT EXISTS print_size text NOT NULL DEFAULT 'standard';
CREATE UNIQUE INDEX IF NOT EXISTS tickets_session_seat_unique ON public.tickets (session_id, seat_id) WHERE status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.booth_sell(_director uuid, _session uuid, _access uuid, _operator text, _seats uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; tx uuid; n int; seat record;
BEGIN
  SELECT ss.id, ss.starts_at, ss.hall_id, sh.title, sh.price, h.name AS hall_name
    INTO s FROM show_sessions ss JOIN shows sh ON sh.id = ss.show_id JOIN halls h ON h.id = ss.hall_id
   WHERE ss.id = _session AND ss.director_id = _director AND ss.is_active AND sh.is_active;
  IF s IS NULL THEN RAISE EXCEPTION 'session_unavailable'; END IF;
  SELECT count(*) INTO n FROM seats WHERE id = ANY(_seats) AND hall_id = s.hall_id AND is_active AND number > 0;
  IF n <> array_length(_seats, 1) THEN RAISE EXCEPTION 'seat_invalid'; END IF;
  PERFORM 1 FROM seats WHERE id = ANY(_seats) FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tickets WHERE session_id = _session AND seat_id = ANY(_seats) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'seat_sold';
  END IF;
  INSERT INTO transactions (director_id, session_id, operator_name, operator_access_id, total_amount)
  VALUES (_director, _session, _operator, _access, s.price * n) RETURNING id INTO tx;
  FOR seat IN SELECT se.id, se.number, r.label, coalesce(sc.name, '') AS sname
      FROM seats se JOIN hall_rows r ON r.id = se.row_id LEFT JOIN sections sc ON sc.id = se.section_id
      WHERE se.id = ANY(_seats) LOOP
    INSERT INTO tickets (director_id, transaction_id, session_id, seat_id, show_title, hall_name, section_name, row_label, seat_number, starts_at, price)
    VALUES (_director, tx, _session, seat.id, s.title, s.hall_name, seat.sname, seat.label, seat.number, s.starts_at, s.price);
  END LOOP;
  RETURN tx;
END $$;
REVOKE ALL ON FUNCTION public.booth_sell(uuid, uuid, uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booth_sell(uuid, uuid, uuid, text, uuid[]) TO service_role;