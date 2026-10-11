CREATE OR REPLACE FUNCTION public.validate_show_hall()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.halls h WHERE h.id = NEW.hall_id AND h.director_id = NEW.director_id) THEN
    RAISE EXCEPTION 'hall does not belong to director';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date before start_date';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shows_validate_hall BEFORE INSERT OR UPDATE ON public.shows
FOR EACH ROW EXECUTE FUNCTION public.validate_show_hall();

CREATE OR REPLACE FUNCTION public.validate_session_show()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  SELECT director_id, hall_id INTO s FROM public.shows WHERE id = NEW.show_id;
  IF s IS NULL OR s.director_id <> NEW.director_id THEN
    RAISE EXCEPTION 'show does not belong to director';
  END IF;
  NEW.hall_id := s.hall_id;
  RETURN NEW;
END $$;
CREATE TRIGGER sessions_validate_show BEFORE INSERT OR UPDATE ON public.show_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_session_show();