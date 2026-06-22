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
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const publicClient = createClient(url, anonKey);
  const serviceClient = createClient(url, serviceKey);

  // 1. Fetch one internship ID using the service client (which bypasses RLS)
  console.log("Fetching an internship ID using service_role client...");
  const { data: adminData, error: adminErr } = await serviceClient
    .from('internships')
    .select('id, serial_no')
    .limit(1)
    .maybeSingle();

  if (adminErr) {
    console.error("❌ Service role fetch failed:", adminErr.message);
    return;
  }

  if (!adminData) {
    console.log("⚠️ No internships exist in the database. Please create one to test.");
    return;
  }

  const testId = adminData.id;
  console.log(`Found internship ID: ${testId} (Serial: ${adminData.serial_no})`);

  // 2. Try fetching the same ID using the public client (simulating a public visitor)
  console.log("\nFetching the same internship using anon (public) client...");
  const { data: anonData, error: anonErr } = await publicClient
    .from('internships')
    .select('id, start_date, end_date, serial_no, is_active, certificate_url, certificate_approved, student:profiles!internships_student_id_fkey(full_name, roll_no, university, wing)')
    .eq('id', testId)
    .maybeSingle();

  if (anonErr) {
    console.error("❌ Anon fetch failed with error:", anonErr.message);
  } else if (!anonData) {
    console.log("❌ Anon fetch returned NULL (Row Level Security is blocking SELECT!)");
  } else {
    console.log("✅ Anon fetch succeeded! RLS is NOT blocking SELECT on internships.");
    console.log("Returned Data:", anonData);
  }

  // 3. Try fetching the student profile using the public client (since verify page joins profiles)
  console.log("\nFetching profiles table details using anon (public) client...");
  const { data: profData, error: profErr } = await publicClient
    .from('profiles')
    .select('full_name, roll_no, university')
    .limit(1);

  if (profErr) {
    console.error("❌ Profiles anon fetch failed with error:", profErr.message);
  } else if (!profData || profData.length === 0) {
    console.log("❌ Profiles anon fetch returned empty/NULL (RLS is blocking SELECT on profiles!)");
  } else {
    console.log("✅ Profiles anon fetch succeeded! RLS is NOT blocking SELECT on profiles.");
  }
}

run();
