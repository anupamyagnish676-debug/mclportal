const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function parseEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value.trim();
    }
  });
  return env;
}

async function debugDelete() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  // Get one user to test delete
  const { data: userData } = await supabase.auth.admin.listUsers();
  const users = userData.users || [];
  const testUser = users.find(u => u.email !== 'admin@mcl.com');

  if (!testUser) {
    console.log("No test users found.");
    return;
  }

  console.log(`Attempting to delete user ${testUser.email} (ID: ${testUser.id})...`);
  
  // Try to delete profile first
  console.log("Deleting profile from profiles table...");
  const { error: profErr } = await supabase.from('profiles').delete().eq('id', testUser.id);
  if (profErr) {
    console.error("❌ Profile delete error:", profErr);
  } else {
    console.log("✅ Profile deleted successfully.");
  }

  // Now try to delete auth user
  console.log("Deleting auth user...");
  const { error: authErr } = await supabase.auth.admin.deleteUser(testUser.id);
  if (authErr) {
    console.error("❌ Auth delete error:", JSON.stringify(authErr, null, 2));
    console.error("Auth delete error message:", authErr.message);
  } else {
    console.log("✅ Auth user deleted successfully.");
  }
}

debugDelete();
