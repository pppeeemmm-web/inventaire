-- forest_pins — manual placement of works on the /works "map" layout.
-- Flat composition: each work is positioned, sized and rotated by hand.
--   lng = x% , lat = y%  (0–100 position in the scene box, from top-left)
--   z        = stacking order (higher paints in front)
--   size     = work width as % of scene width / vw (height follows natural aspect ratio)
--   rotation = Y-axis rotation in degrees (−180…180)
-- Reflects live schema as of the flat-map redesign (rotation added, size as vw %).

CREATE TABLE forest_pins (
  id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id     int8         NOT NULL REFERENCES "Oeuvres"("OeuvreID") ON DELETE CASCADE,
  lat         float8       NOT NULL CHECK (lat BETWEEN 0 AND 100),
  lng         float8       NOT NULL CHECK (lng BETWEEN 0 AND 100),
  z           float8       NOT NULL DEFAULT 0   CHECK (z BETWEEN 0 AND 100),
  size        float8       NOT NULL DEFAULT 16  CHECK (size > 0 AND size <= 100),
  rotation    float8       NOT NULL DEFAULT 0,
  label       text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(work_id)
);

ALTER TABLE forest_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_read"   ON forest_pins FOR SELECT TO authenticated USING (is_team());
CREATE POLICY "admin_write" ON forest_pins FOR ALL    TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON forest_pins TO authenticated;

-- Applied incrementally on live (migration add_forest_pin_rotation_size_as_vw):
--   ALTER TABLE forest_pins ADD COLUMN IF NOT EXISTS rotation float8 NOT NULL DEFAULT 0;
--   ALTER TABLE forest_pins DROP CONSTRAINT IF EXISTS forest_pins_size_check;
--   ALTER TABLE forest_pins ADD CONSTRAINT forest_pins_size_check CHECK (size > 0 AND size <= 100);
--   ALTER TABLE forest_pins ALTER COLUMN size SET DEFAULT 16;  -- was a ≤5 multiplier; now vw %
--   UPDATE forest_pins SET size = 16 WHERE size < 2;  -- legacy pins stuck at size=1
