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

async function resetDocs() {
  const email = 'anupamyagnish2005@gmail.com';
  console.log(`Looking for user: ${email}`);

  const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
  if (!profile) return console.log('No profile found');

  // Check student_documents table
  const { data: docs } = await supabase.from('student_documents').select('*').eq('student_id', profile.id);
  console.log(`Found ${docs?.length || 0} documents in student_documents table.`);

  if (docs && docs.length > 0) {
     console.log('Deleting them...');
     const { error } = await supabase.from('student_documents').delete().eq('student_id', profile.id);
     if (error) {
       console.error("Error deleting docs:", error);
     } else {
       console.log('Successfully deleted all documents for this student.');
     }
  }
}

resetDocs();
