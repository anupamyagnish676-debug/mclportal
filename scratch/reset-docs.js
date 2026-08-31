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

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !profile) {
    console.error('Error fetching profile:', error);
    return;
  }

  console.log('Profile found:', profile);

  // Check where documents are stored. In MCL it might be documents_url, or a jsonb column
  const docFields = ['aadhar_url', 'passport_url', 'college_id_url', 'undertaking_url', 'noc_url', 'documents', 'documents_json', 'onboarding_docs', 'files'];
  
  let resetProfile = false;
  for (const field of docFields) {
    if (profile.hasOwnProperty(field) && profile[field] !== null) {
      console.log(`Resetting ${field} on profile...`);
      await supabase.from('profiles').update({ [field]: null }).eq('id', profile.id);
      resetProfile = true;
    }
  }
  
  if (profile.documents || profile.onboarding_docs) {
     console.log('Resetting document references in profiles');
  }

  // Internships table
  const { data: internships } = await supabase
    .from('internships')
    .select('*')
    .eq('student_id', profile.id);

  if (internships && internships.length > 0) {
    for (const intern of internships) {
       for (const field of docFields) {
         if (intern.hasOwnProperty(field) && intern[field] !== null) {
            console.log(`Resetting ${field} on internship ${intern.id}...`);
            await supabase.from('internships').update({ [field]: null }).eq('id', intern.id);
         }
       }
    }
  }
  
  // also, in `mcl-supabase`, maybe it's in a separate table like `documents`?
  const { data: docs } = await supabase.from('documents').select('*').eq('student_id', profile.id);
  if (docs && docs.length > 0) {
     console.log(`Deleting ${docs.length} rows from 'documents' table...`);
     await supabase.from('documents').delete().eq('student_id', profile.id);
  } else if (docs && docs.length === 0) {
     console.log(`No rows found in 'documents' table for this student.`);
  }

  console.log('✅ Done resetting docs.');
}

resetDocs();
