const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const v = {};
env.split('\n').forEach(l => {
  const [k, ...val] = l.split('=');
  if (k) v[k.trim()] = val.join('=').trim().replace(/^"|"$/g, '');
});

const supabase = createClient(v.NEXT_PUBLIC_SUPABASE_URL, v.SUPABASE_SERVICE_ROLE_KEY);

async function fullReset() {
  const studentId = 'f3a10c6e-1a99-4f67-b240-fa4dd42cc7c1';
  
  const { data: docs } = await supabase.from('student_documents').select('id, doc_type').eq('student_id', studentId);
  console.log('Found:', docs?.length || 0, 'documents');

  if (docs && docs.length > 0) {
    const { error } = await supabase.from('student_documents').delete().eq('student_id', studentId);
    if (error) console.error('Error:', error);
    else console.log('Deleted all records.');
  }

  const { data: check } = await supabase.from('student_documents').select('id').eq('student_id', studentId);
  console.log('Remaining:', check?.length || 0);
  process.exit(0);
}

fullReset();
