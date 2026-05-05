const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

const sql = `
-- 1. Create vault_folder table
CREATE TABLE IF NOT EXISTS vault_folder (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES vault_folder(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, parent_id)
);

-- 2. Add folder_id to document table
ALTER TABLE document ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES vault_folder(id);
`;

async function setup() {
  console.log('Running SQL setup...');
  const { error } = await supabase.rpc('execute_sql', { sql });
  if (error) {
    console.error('SQL Error:', error);
    process.exit(1);
  }
  console.log('Tables created or already exist.');

  // Migration logic
  console.log('Starting migration of folder strings to table...');
  const { data: docs, error: fetchErr } = await supabase.from('document').select('id, folder').not('folder', 'is', null);
  
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    process.exit(1);
  }

  const folderMap = new Map(); // path -> id

  async function getOrCreateFolder(path) {
    if (!path) return null;
    if (folderMap.has(path)) return folderMap.get(path);

    const parts = path.split('/');
    let parentId = null;
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (folderMap.has(currentPath)) {
        parentId = folderMap.get(currentPath);
        continue;
      }

      // Check if exists in DB
      const { data: existing } = await supabase
        .from('vault_folder')
        .select('id')
        .eq('name', part)
        .eq('parent_id', parentId)
        .maybeSingle();

      if (existing) {
        parentId = existing.id;
      } else {
        // Create new
        const { data: newFolder, error: insErr } = await supabase
          .from('vault_folder')
          .insert({ name: part, parent_id: parentId })
          .select('id')
          .single();
        
        if (insErr) throw insErr;
        parentId = newFolder.id;
      }
      folderMap.set(currentPath, parentId);
    }
    return parentId;
  }

  for (const doc of docs) {
    try {
      const folderId = await getOrCreateFolder(doc.folder);
      if (folderId) {
        await supabase.from('document').update({ folder_id: folderId }).eq('id', doc.id);
        console.log(`Migrated doc ${doc.id} to folder ${doc.folder} (ID: ${folderId})`);
      }
    } catch (e) {
      console.error(`Error migrating doc ${doc.id}:`, e);
    }
  }

  console.log('Migration complete.');
}

setup();
