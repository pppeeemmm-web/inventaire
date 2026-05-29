-- §4.4 preparatory: forest_pins table for the /works map layout.
-- Apply in Supabase SQL Editor when the map layout is ready to implement.
-- Requires: R2 forest panorama asset + per-work lat/lng data population.

CREATE TABLE forest_pins (
  id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id     int8         NOT NULL REFERENCES "Oeuvres"("OeuvreID") ON DELETE CASCADE,
  lat         float8       NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         float8       NOT NULL CHECK (lng BETWEEN -180 AND 180),
  label       text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE forest_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_read"   ON forest_pins FOR SELECT TO authenticated USING (is_team());
CREATE POLICY "admin_write" ON forest_pins FOR ALL    TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON forest_pins TO authenticated;
