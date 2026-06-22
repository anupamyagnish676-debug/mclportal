const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Manually load env file
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/)
  if (match) {
    env[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env variables in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
  console.log('Fetching a single internship row to inspect columns...')
  const { data, error } = await supabase
    .from('internships')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching internships:', error)
  } else {
    console.log('Successfully fetched row sample:', data)
    if (data && data.length > 0) {
      console.log('Available columns in schema cache:', Object.keys(data[0]))
    } else {
      console.log('No rows found in internships table.')
    }
  }
}

check()
