const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(l => { const [k,...v] = l.split('='); if(k) envVars[k.trim()] = v.join('=').trim().replace(/^"|"$/g, ''); });
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('student_documents').select('*').limit(1);
  console.log(data ? Object.keys(data[0] || {}) : error);
}
check();
