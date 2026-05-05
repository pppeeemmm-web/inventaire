const { createClient } = require('@supabase/supabase-js');

// Service Role Client to perform DDL
const supabase = createClient(
  'https://mcrzsxrcoexnlwmaunte.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'
);

async function setup() {
  console.log('--- Phase 1: Infrastructure of Privacy ---');
  
  const sql = `
    -- 1. Add Role to Profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'team';
    
    -- 2. Add Privacy flag to Contact
    ALTER TABLE public."Contact" ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
    
    -- 3. Set the first user as Admin (The User)
    -- We assume the first profile created is the owner/admin
    UPDATE public.profiles 
    SET role = 'admin' 
    WHERE id IN (SELECT id FROM public.profiles ORDER BY id LIMIT 1);

    -- 4. Create an RLS Policy for Contacts
    -- If user is admin, see everything. 
    -- If user is team, see only non-private contacts.
    
    ALTER TABLE public."Contact" ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Contacts Visibility" ON public."Contact";
    
    CREATE POLICY "Contacts Visibility" ON public."Contact"
    FOR SELECT
    USING (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      OR 
      (is_private = false)
    );

    -- Also handle Insert/Update/Delete
    DROP POLICY IF EXISTS "Contacts Admin All" ON public."Contact";
    CREATE POLICY "Contacts Admin All" ON public."Contact"
    FOR ALL
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
  `;

  console.log('Executing SQL Migration...');
  const { error } = await supabase.rpc('execute_sql', { sql });

  if (error) {
    console.error('Migration Failed:', error.message);
  } else {
    console.log('Migration Successful: Roles, Privacy columns, and RLS Policies established.');
  }
}

setup();
