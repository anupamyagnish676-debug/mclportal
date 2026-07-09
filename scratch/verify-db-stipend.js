const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
let env = {};
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        env[key] = val;
      }
    }
  }
} catch (e) {
  console.error("Failed to parse .env.local", e);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars. Check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("Checking database for stipend and payments schema...");
  
  // 1. Check internships table columns
  const { data: internships, error: internError } = await supabase
    .from('internships')
    .select('id, internship_type, stipend_amount, stipend_frequency')
    .limit(1);

  if (internError) {
    console.error("❌ Error querying stipend columns on internships table:", internError.message);
  } else {
    console.log("✅ internships table has stipend columns!");
    console.log("Sample row:", internships);
  }

  // 2. Check stipend_payments table
  const { data: payments, error: paymentsError } = await supabase
    .from('stipend_payments')
    .select('*')
    .limit(1);

  if (paymentsError) {
    console.error("❌ Error querying stipend_payments table:", paymentsError.message);
  } else {
    console.log("✅ stipend_payments table exists and is accessible!");
    console.log("Sample payment:", payments);
  }
}

verify();
