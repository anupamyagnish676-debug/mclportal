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

async function check() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  console.log("Checking profiles table schema...");
  const { data: profiles, error: err1 } = await supabase.from('profiles').select('*').limit(1);
  if (err1) {
    console.error("Profiles error:", err1.message);
  } else {
    console.log("Profiles columns:", profiles.length > 0 ? Object.keys(profiles[0]) : "empty");
    console.log("Sample profile:", profiles[0]);
  }

  console.log("\nChecking applications table schema...");
  const { data: apps, error: err2 } = await supabase.from('applications').select('*').limit(1);
  if (err2) {
    console.error("Applications error:", err2.message);
  } else {
    console.log("Applications columns:", apps.length > 0 ? Object.keys(apps[0]) : "empty");
    console.log("Sample application:", apps[0]);
  }
}

check();
