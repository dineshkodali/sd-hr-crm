-- Add bathroom and kitchen columns to rooms table
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS bathroom_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS has_bathroom BOOLEAN,
ADD COLUMN IF NOT EXISTS has_kitchen BOOLEAN,
ADD COLUMN IF NOT EXISTS length NUMERIC,
ADD COLUMN IF NOT EXISTS width NUMERIC,
ADD COLUMN IF NOT EXISTS inventory TEXT;

-- Add index for easier querying
CREATE INDEX IF NOT EXISTS idx_rooms_bathroom_type ON public.rooms(bathroom_type);
CREATE INDEX IF NOT EXISTS idx_rooms_has_bathroom ON public.rooms(has_bathroom);
CREATE INDEX IF NOT EXISTS idx_rooms_has_kitchen ON public.rooms(has_kitchen);
