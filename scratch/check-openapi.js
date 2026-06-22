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
  if (!url || !anonKey) {
    console.error("Missing env vars");
    return;
  }

  console.log("Fetching OpenAPI schema from:", url);
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const schema = await res.json();
    console.log("Paths available:");
    console.log(Object.keys(schema.paths || {}));
    
    // Specifically log if there is any rpc function
    const rpcs = Object.keys(schema.paths || {}).filter(p => p.startsWith('/rpc/'));
    console.log("\nRPC Functions found:", rpcs);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
