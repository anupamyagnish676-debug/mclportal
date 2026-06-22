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

async function listAdmins() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  console.log("Fetching all admin profiles...");
  const { data, error } = await supabase
    .from('profiles')
    .select('email, role, area, full_name')
    .eq('role', 'admin');

  if (error) {
    console.error("Error fetching admins:", error.message);
    return;
  }

  console.log("\nRegistered Admins:");
  data.forEach((admin, i) => {
    console.log(`${i + 1}. Name: ${admin.full_name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Office / Area: ${admin.area || 'Central (HQ)'}`);
    console.log(`   Role: ${admin.role}\n`);
  });
}

listAdmins();
