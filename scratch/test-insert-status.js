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
  if (!url || !serviceKey) {
    console.error("Missing credentials");
    return;
  }
  const supabase = createClient(url, serviceKey);

  // 1. Get a valid student profile id
  const { data: student } = await supabase.from('profiles').select('id').eq('role', 'student').limit(1).maybeSingle();
  // 2. Get a valid admin/employee profile id
  const { data: referee } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle();

  if (!student || !referee) {
    console.error("Could not find required profiles for foreign keys in profiles table. Student:", student, "Referee:", referee);
    return;
  }

  const statuses = ['pending', 'pending_hq', 'pending_area', 'approved', 'rejected'];
  
  console.log(`Testing application inserts with Student ID: ${student.id} and Referee ID: ${referee.id}`);
  
  for (const status of statuses) {
    const { data, error } = await supabase
      .from('applications')
      .insert({
        student_id: student.id,
        referred_by: referee.id,
        lor_url: 'https://example.com/test.pdf',
        status: status
      })
      .select();

    if (error) {
      console.log(`Status '${status}': FAILED - Error: ${error.message} (Code: ${error.code})`);
    } else {
      console.log(`Status '${status}': SUCCESS!`);
      // Delete the test row to keep it clean
      await supabase.from('applications').delete().eq('id', data[0].id);
    }
  }
}

test();
