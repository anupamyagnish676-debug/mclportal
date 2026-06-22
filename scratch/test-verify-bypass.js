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
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const adminClient = createClient(url, serviceKey);

  // 1. Fetch one internship using service_role (simulating what the verification page will do now)
  console.log("Simulating verification page load using createAdminClient...");
  
  // Get first internship record
  const { data: oneRecord } = await adminClient.from('internships').select('id').limit(1).maybeSingle();
  if (!oneRecord) {
    console.log("No internship records exist to verify.");
    return;
  }

  const { data: internship, error } = await adminClient
    .from('internships')
    .select('id, start_date, end_date, serial_no, is_active, certificate_url, certificate_approved, student:profiles!internships_student_id_fkey(full_name, roll_no, university, wing)')
    .eq('id', oneRecord.id)
    .maybeSingle();

  if (error) {
    console.error("❌ Verification fetch failed:", error.message);
  } else if (!internship) {
    console.log("❌ Internship not found.");
  } else {
    console.log("✅ Verification query succeeded!");
    console.log("Internship Record Details:");
    console.log(JSON.stringify(internship, null, 2));
  }
}

run();
