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

async function run() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(url, anonKey);

  console.log("Testing password reset for deleted user: anupamyagnish676@gmail.com...");
  const { error: err1 } = await supabase.auth.resetPasswordForEmail('anupamyagnish676@gmail.com', {
    redirectTo: 'http://localhost:3001/reset-password'
  });
  console.log("Error object keys:", err1 ? Object.keys(err1) : 'None');
  console.log("Error JSON:", JSON.stringify(err1, null, 2));

  console.log("\nTesting password reset for existing HQ Admin: admin@mcl.com...");
  const { error: err2 } = await supabase.auth.resetPasswordForEmail('admin@mcl.com', {
    redirectTo: 'http://localhost:3001/reset-password'
  });
  console.log("Error JSON:", JSON.stringify(err2, null, 2));
}

run();
