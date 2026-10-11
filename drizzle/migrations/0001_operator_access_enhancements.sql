ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_entry_operators integer NOT NULL DEFAULT 3;
ALTER TABLE public.operator_access ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE public.operator_access ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS operator_access_unique_device ON public.operator_access (director_id, kind, device_id);