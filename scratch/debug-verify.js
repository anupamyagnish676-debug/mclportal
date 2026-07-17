const { createClient } = require('@supabase/supabase-js')
const { createHmac } = require('crypto')
const fs = require('fs')
const path = require('path')

function parseEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
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

const env = parseEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, serviceKey)

async function test() {
  const secret = env.CERT_HMAC_SECRET || ''
  console.log("Secret:", secret ? "defined" : "NOT defined");

  // Fetch all internships
  const { data: internships, error } = await supabase
    .from('internships')
    .select('id, serial_no, certificate_url, certificate_approved')
  
  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Total internships:", internships.length);
  for (const i of internships) {
    const computed = createHmac('sha256', secret).update(String(i.serial_no)).digest('hex');
    console.log(`ID: ${i.id}, Serial: ${i.serial_no}, Approved: ${i.certificate_approved}, Has URL: ${!!i.certificate_url}`);
    console.log(`Computed Token: ${computed}`);
  }
}

test()
