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

  console.log("Checking applications table columns...");
  const { data: appData, error: appErr } = await supabase
    .from('applications')
    .select('roll_no, university')
    .limit(1);

  if (appErr) {
    console.log("❌ applications table check failed:", appErr.message);
  } else {
    console.log("✅ applications table has roll_no and university columns!");
  }

  console.log("Checking profiles table columns...");
  const { data: profData, error: profErr } = await supabase
    .from('profiles')
    .select('signature_data')
    .limit(1);

  if (profErr) {
    console.log("❌ profiles table check failed:", profErr.message);
  } else {
    console.log("✅ profiles table has signature_data column!");
  }
}

check();
