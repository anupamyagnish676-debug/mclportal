const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, ''); // strip quotes
    if (key && !key.startsWith('#')) {
      process.env[key] = val;
    }
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
  const { data, error } = await supabase.from('submissions').select('*').limit(1);
  if (error) {
    console.error('Error fetching submissions:', error);
  } else {
    console.log('Submissions table columns:', data.length > 0 ? Object.keys(data[0]) : 'empty table');
  }
}

check();
