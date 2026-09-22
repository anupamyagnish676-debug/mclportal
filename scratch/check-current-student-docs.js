const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) {
    envVars[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkStudentDocs() {
  const email = 'anupamyagnish2005@gmail.com';
  const { data: profile } = await supabase.from('profiles').select('id, full_name, email, area').eq('email', email).single();
  console.log('Profile:', profile);

  if (!profile) return;

  const { data: docs } = await supabase.from('student_documents').select('*').eq('student_id', profile.id);
  console.log('\n--- Current Documents in Database ---');
  docs?.forEach(d => {
    console.log(`Doc Type: ${d.doc_type}`);
    console.log(`File Path: ${d.file_path}`);
    console.log(`File URL: ${d.file_url}`);
    console.log(`Status: ${d.status}`);
    console.log('-----------------------------------');
  });
}

checkStudentDocs();
