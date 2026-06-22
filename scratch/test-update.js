const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    if (key && !key.startsWith('#')) {
      process.env[key] = val;
    }
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function check() {
  // 1. Fetch first internship
  const { data: list, error: fetchErr } = await serviceClient.from('internships').select('*').limit(1);
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  if (!list.length) {
    console.log('No internships found in database.');
    return;
  }

  const internship = list[0];
  console.log('Testing with internship ID:', internship.id);
  console.log('Current certificate_approved:', internship.certificate_approved);

  // 2. Try to update using service role client (always bypasses RLS)
  const { error: serviceUpdateErr } = await serviceClient
    .from('internships')
    .update({ certificate_approved: !internship.certificate_approved })
    .eq('id', internship.id);

  if (serviceUpdateErr) {
    console.error('Service role update failed:', serviceUpdateErr);
  } else {
    console.log('Service role update succeeded.');
    // Revert it back
    await serviceClient.from('internships').update({ certificate_approved: internship.certificate_approved }).eq('id', internship.id);
  }

  // 3. Try to update using anon client (simulates client-side update without active user session)
  const { error: anonUpdateErr } = await anonClient
    .from('internships')
    .update({ certificate_approved: !internship.certificate_approved })
    .eq('id', internship.id);

  if (anonUpdateErr) {
    console.error('Anon client update failed (expected if RLS is on and no session):', anonUpdateErr);
  } else {
    console.log('Anon client update succeeded (means RLS is off or permissive)!');
    // Revert it back
    await serviceClient.from('internships').update({ certificate_approved: internship.certificate_approved }).eq('id', internship.id);
  }
}

check();
