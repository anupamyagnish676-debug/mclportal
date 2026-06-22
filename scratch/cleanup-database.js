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

async function cleanup() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const hqAdminEmail = 'admin@mcl.com';

  console.log("-----------------------------------------");
  console.log("STARTING DATABASE CLEANUP");
  console.log("HQ Admin Email to Keep:", hqAdminEmail);
  console.log("-----------------------------------------");

  // 1. Truncate transactional tables containing sample data
  console.log("Clearing all transactional sample data...");
  const tables = ['attendance', 'leaves', 'logbook', 'assignments', 'materials', 'internships', 'applications'];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.log(`⚠️ Note/Error clearing table ${table}:`, error.message);
    } else {
      console.log(`✅ Cleared all records from table: ${table}`);
    }
  }

  // 2. Delete profiles for all users except HQ Admin to avoid foreign key restrict checks
  console.log("\nDeleting profile records (except HQ Admin)...");
  const { error: profDeleteErr } = await supabase
    .from('profiles')
    .delete()
    .neq('email', hqAdminEmail);

  if (profDeleteErr) {
    console.error("❌ Failed to delete profiles:", profDeleteErr.message);
    return;
  }
  console.log("✅ Profiles table cleared (except HQ Admin).");

  // 3. Fetch all users from Supabase Auth
  console.log("\nFetching all users from Supabase Auth...");
  const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("❌ Failed to fetch users list:", listError.message);
    return;
  }

  const users = userData.users || [];
  console.log(`Found ${users.length} total users in Auth.`);

  let deletedCount = 0;
  let keptHqAdmin = false;

  for (const user of users) {
    const email = user.email ? user.email.toLowerCase().trim() : '';
    if (email === hqAdminEmail.toLowerCase().trim()) {
      console.log(`🔑 Keeping HQ Admin user: ${email} (ID: ${user.id})`);
      keptHqAdmin = true;
      
      // Ensure the profile role is admin
      const { error: roleErr } = await supabase
        .from('profiles')
        .update({ role: 'admin', area: 'Headquarters', full_name: 'HQ Admin' })
        .eq('id', user.id);
      
      if (roleErr) {
        console.error("⚠️ Failed to update HQ Admin profile role:", roleErr.message);
      } else {
        console.log("✅ Verified and updated HQ Admin profile in profiles table.");
      }
    } else {
      console.log(`🗑️ Deleting user from Auth: ${email || '[No Email]'} (ID: ${user.id})`);
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) {
        console.error(`❌ Failed to delete user ${email} from Auth:`, delError.message);
      } else {
        deletedCount++;
      }
    }
  }

  console.log("-----------------------------------------");
  console.log("CLEANUP COMPLETE");
  console.log(`Deleted Users: ${deletedCount}`);
  console.log(`HQ Admin '${hqAdminEmail}' kept intact: ${keptHqAdmin ? 'YES' : 'NO'}`);
  console.log("-----------------------------------------");
}

cleanup();
