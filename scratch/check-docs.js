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
  if (!profile) return console.log('no profile');
  
  const { data: internships } = await supabase.from('internships').select('*').eq('student_id', profile.id);
  
  if (internships) {
    console.log("Internship object keys:", Object.keys(internships[0]));
  }
  
  const { data: docs } = await supabase.from('documents').select('*').eq('internship_id', internships[0]?.id);
  console.log("Documents table rows:", docs?.length);
}

resetDocs();
