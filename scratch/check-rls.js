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
  // Query table security
  const { data: tables, error: tableErr } = await supabase.rpc('pg_execute_sql', {
    query_text: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
  });

  // Query policies
  const { data: policies, error: polErr } = await supabase.rpc('pg_execute_sql', {
    query_text: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
  });

  if (tableErr || polErr) {
    // If pg_execute_sql RPC doesn't exist, we can run a direct query using another method or try retrieving columns.
    // Let's try executing standard query via supabase.from SQL runner if available, or just query profiles role.
    console.log('RPC method failed (which is normal if no custom SQL execution function exists). trying fallback...');
    
    // Let's fallback to executing SQL by creating a temporary function if possible or query using a simpler table select
    // Let's print out what is returned or the error
    console.error('Table error:', tableErr?.message);
    console.error('Policy error:', polErr?.message);
  } else {
    console.log('Tables RLS status:', tables);
    console.log('Policies list:', policies);
  }
}

check();
