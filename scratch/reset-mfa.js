const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
env.split('\n').forEach(line => {
  const [k, v] = line.split('=')
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '')
})

const admin = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY)

async function resetMFA(email) {
  console.log('Finding user:', email)
  const { data: users, error } = await admin.auth.admin.listUsers()
  if (error) {
    console.error('Error listing users:', error.message)
    return
  }

  const targetUser = users.users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!targetUser) {
    console.error('User not found:', email)
    return
  }

  console.log('Found user ID:', targetUser.id)
  const { data: factorsData, error: fErr } = await admin.auth.admin.mfa.listFactors({ userId: targetUser.id })
  if (fErr) {
    console.error('Error listing MFA factors:', fErr.message)
    return
  }

  const factors = factorsData?.factors || []
  console.log('Factors found:', factors.length)

  for (const factor of factors) {
    console.log(`Deleting factor ${factor.id} (${factor.friendly_name || factor.factor_type})...`)
    const { error: unenrollErr } = await admin.auth.admin.mfa.deleteFactor({ userId: targetUser.id, id: factor.id })
    if (unenrollErr) {
      console.error(`Failed to delete factor ${factor.id}:`, unenrollErr.message)
    } else {
      console.log(`Successfully deleted factor ${factor.id}`)
    }
  }

  console.log(`MFA reset complete for ${email}!`)
}

resetMFA('yagnishsasmita@gmail.com')
