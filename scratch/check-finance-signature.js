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

  console.log("Checking finance profiles...");
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, signature_data')
    .eq('role', 'finance');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  for (const p of profiles) {
    console.log(`ID: ${p.id}, Name: ${p.full_name}, Role: ${p.role}`);
    if (p.signature_data) {
      console.log(`Signature data length: ${p.signature_data.length}`);
      console.log(`Signature starts with: ${p.signature_data.substring(0, 100)}`);
    } else {
      console.log("Signature is null or empty");
    }
  }
}

check();
