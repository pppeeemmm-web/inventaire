-- §4.4 preparatory: forest_pins table for the /works map layout.
-- Apply in Supabase SQL Editor when the map layout is ready to implement.
-- Requires: R2 forest panorama asset + per-work lat/lng data population.

-- lat = y%, lng = x% (0–100 percentage position on the forest panorama image).
CREATE TABLE forest_pins (
  id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id     int8         NOT NULL REFERENCES "Oeuvres"("OeuvreID") ON DELETE CASCADE,
  lat         float8       NOT NULL CHECK (lat BETWEEN 0 AND 100),
  lng         float8       NOT NULL CHECK (lng BETWEEN 0 AND 100),
  label       text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(work_id)
);

ALTER TABLE forest_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_read"   ON forest_pins FOR SELECT TO authenticated USING (is_team());
CREATE POLICY "admin_write" ON forest_pins FOR ALL    TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON forest_pins TO authenticated;
