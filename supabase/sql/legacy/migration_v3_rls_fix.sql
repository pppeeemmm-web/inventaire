-- 1. Refactor is_admin()
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN DEFAULT FALSE;
UPDATE "Contact" SET "is_admin" = TRUE WHERE "ContactID" = 13;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Contact"
    WHERE auth_user_id = (select auth.uid())
      AND is_admin = true
  );
$$;

-- 2. Drop overly permissive DEV policies
DROP POLICY IF EXISTS "DEV anon reads oeuvres" ON "Oeuvres";
DROP POLICY IF EXISTS "DEV anon reads contact" ON "Contact";
DROP POLICY IF EXISTS "DEV anon reads oeuvreTheme" ON "OeuvreTheme";
DROP POLICY IF EXISTS "DEV anon reads working_group" ON "working_group";
DROP POLICY IF EXISTS "DEV anon reads wg_work" ON "working_group_work";
DROP POLICY IF EXISTS "DEV anon reads document" ON "document";

DROP POLICY IF EXISTS "DEV debug all Oeuvres" ON "Oeuvres";
DROP POLICY IF EXISTS "DEV debug all Contact" ON "Contact";
DROP POLICY IF EXISTS "DEV debug all contact_addresses" ON "contact_addresses";
DROP POLICY IF EXISTS "DEV debug all work_action" ON "work_action";
DROP POLICY IF EXISTS "DEV debug all work_action_type" ON "work_action_type";

-- 3. Replace broad Authenticated policies with proper Team policies
-- tblImage
DROP POLICY IF EXISTS "auth write tblImage" ON "tblImage";
CREATE POLICY "tblImage: team all" ON "tblImage" FOR ALL TO public USING (is_team());

-- tblPresentation
DROP POLICY IF EXISTS "auth write tblPresentation" ON "tblPresentation";
CREATE POLICY "tblPresentation: team all" ON "tblPresentation" FOR ALL TO public USING (is_team());

-- tblrelations
DROP POLICY IF EXISTS "Allow admin all access" ON "tblrelations";
CREATE POLICY "tblrelations: team all" ON "tblrelations" FOR ALL TO public USING (is_team());

-- contact tables
DROP POLICY IF EXISTS "Authenticated full access" ON "contact_addresses";
CREATE POLICY "contact_addresses: team all" ON "contact_addresses" FOR ALL TO public USING (is_team());

DROP POLICY IF EXISTS "Authenticated full access" ON "contact_emails";
CREATE POLICY "contact_emails: team all" ON "contact_emails" FOR ALL TO public USING (is_team());

DROP POLICY IF EXISTS "Authenticated full access" ON "contact_phones";
CREATE POLICY "contact_phones: team all" ON "contact_phones" FOR ALL TO public USING (is_team());

DROP POLICY IF EXISTS "Authenticated full access" ON "contact_websites";
CREATE POLICY "contact_websites: team all" ON "contact_websites" FOR ALL TO public USING (is_team());

DROP POLICY IF EXISTS "Authenticated full access" ON "contact_socials";
CREATE POLICY "contact_socials: team all" ON "contact_socials" FOR ALL TO public USING (is_team());

-- Other reference tables
DROP POLICY IF EXISTS "Authenticated full access" ON "tblRole";
CREATE POLICY "tblRole: team all" ON "tblRole" FOR ALL TO public USING (is_team());

DROP POLICY IF EXISTS "Authenticated full access" ON "sale_order";
CREATE POLICY "sale_order: team all" ON "sale_order" FOR ALL TO public USING (is_team());

-- Drop redundant auth policies where team policy already exists
DROP POLICY IF EXISTS "auth write Oeuvres" ON "Oeuvres";
DROP POLICY IF EXISTS "auth write tblTheme" ON "tblTheme";
DROP POLICY IF EXISTS "auth write OeuvreTheme" ON "OeuvreTheme";
DROP POLICY IF EXISTS "Authenticated users can manage expenses" ON "expense";
DROP POLICY IF EXISTS "Authenticated full access" ON "work_action";
DROP POLICY IF EXISTS "Authenticated full access" ON "work_action_type";

-- 4. Create trigger to protect admin flags
CREATE OR REPLACE FUNCTION public.protect_admin_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the user is modifying is_admin OR is_team_member
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin) OR 
     (NEW.is_team_member IS DISTINCT FROM OLD.is_team_member) OR
     (NEW."IsTeamMember" IS DISTINCT FROM OLD."IsTeamMember") THEN
     
    -- Check if the person making the change is an admin
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only admins can modify role flags.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_admin_flags_protected ON "Contact";
CREATE TRIGGER ensure_admin_flags_protected
  BEFORE UPDATE ON "Contact"
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_flags();
