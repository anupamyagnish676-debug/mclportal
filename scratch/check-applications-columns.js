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

async function test() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  // Get a valid referrer id
  const { data: referee } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle();
  if (!referee) {
    console.error("Referee not found");
    return;
  }

  console.log("1. Testing insert with student_id=null...");
  const r1 = await supabase.from('applications').insert({
    student_id: null,
    referred_by: referee.id,
    lor_url: 'https://example.com/test.pdf',
    status: 'pending'
  });
  console.log("Result 1:", r1.error ? r1.error.message : "SUCCESS!");

  console.log("\n2. Testing if student_name and student_email exist as columns...");
  const r2 = await supabase.from('applications').insert({
    student_id: null,
    referred_by: referee.id,
    lor_url: 'https://example.com/test.pdf',
    status: 'pending',
    student_name: 'Test Student',
    student_email: 'test@student.com'
  });
  console.log("Result 2:", r2.error ? r2.error.message : "SUCCESS!");

  console.log("\n3. Testing if employee_code exists as a column in profiles or applications...");
  const r3 = await supabase.from('profiles').select('employee_code').limit(1);
  console.log("Profiles employee_code check:", r3.error ? r3.error.message : "Exists!");

  const r4 = await supabase.from('applications').select('employee_code').limit(1);
  console.log("Applications employee_code check:", r4.error ? r4.error.message : "Exists!");
}

test();
