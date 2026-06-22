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

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error fetching buckets:', error);
  } else {
    console.log('Existing buckets:', buckets.map(b => b.name));
    const certsBucket = buckets.find(b => b.name === 'certificates');
    if (certsBucket) {
      console.log('certificates bucket is present. Public:', certsBucket.public);
    } else {
      console.log('certificates bucket is MISSING!');
    }
  }
}

check();
