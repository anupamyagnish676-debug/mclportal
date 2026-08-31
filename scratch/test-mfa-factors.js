const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
env.split('\n').forEach(line => {
  const [k, v] = line.split('=')
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '')
})

const admin = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY)

async function checkMFA() {
  const { data: users, error } = await admin.auth.admin.listUsers()
  if (error) {
    console.error('Error listing users:', error.message)
    return
  }
  for (const u of users.users) {
    const { data: factors, error: fErr } = await admin.auth.admin.mfa.listFactors({ userId: u.id })
    const verified = (factors?.factors || []).filter(f => f.status === 'verified')
    console.log(`User: ${u.email} -> Verified 2FA Factors: ${verified.length}`)
  }
}

checkMFA()
