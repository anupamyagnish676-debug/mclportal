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

async function reset() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = 'anupamyagnish676@gmail.com';
  const newPassword = 'Admin@1234';

  console.log(`Searching for auth user ID of ${email}...`);
  // Get the profile ID
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileErr || !profile) {
    console.error("Profile not found:", profileErr ? profileErr.message : "No matching profile record.");
    return;
  }

  console.log(`Found User ID: ${profile.id}. Resetting password to: ${newPassword}...`);
  
  const { data: user, error: authErr } = await supabase.auth.admin.updateUserById(
    profile.id,
    { password: newPassword }
  );

  if (authErr) {
    console.error("Failed to update password:", authErr.message);
  } else {
    console.log("SUCCESS: Password updated successfully!");
  }
}

reset();
