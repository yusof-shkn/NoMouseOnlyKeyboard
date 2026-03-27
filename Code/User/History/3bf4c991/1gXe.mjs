// ─── Run once to create staff accounts ───────────────────────────────────────
// Usage: node create-staff-accounts.mjs
//
// Requirements: Node 18+, internet access
// Get your SERVICE_ROLE_KEY from:
//   Supabase Dashboard → Settings → API → service_role (secret)

const SUPABASE_URL = 'https://zhdagydptxktspovfxhq.supabase.co'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZGFneWRwdHhrdHNwb3ZmeGhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk5ODcyNiwiZXhwIjoyMDg4NTc0NzI2fQ.0JxRklrjkmoDyBzrNnV-g0RYIAGnzFMKDj6kDlnKwEg'

const GA_INSURANCE_PROVIDER_ID = '3db304e1-f7ba-4834-a7c1-1a1da8749ffc'

const accounts = [
  {
    phone: '+256700000001',
    password: 'Test1234!',
    name: 'Test Pharmacist',
    role: 'pharmacist',
    email: 'pharmacist@medideliverysos.com',
    insurance_provider_id: null,
  },
  {
    phone: '+256700000002',
    password: 'Test1234!',
    name: 'GA Insurance Staff',
    role: 'insurance_staff',
    email: 'ga.insurance@medideliverysos.com',
    insurance_provider_id: GA_INSURANCE_PROVIDER_ID,
  },
  {
    phone: '+256700000002',
    password: 'Test1234!',
    name: 'GA Insurance Staff',
    role: 'insurance_staff',
    email: 'ga.insurance@medideliverysos.com',
    insurance_provider_id: GA_INSURANCE_PROVIDER_ID,
  },
  {
    phone: '+256700000003',
    password: 'Test1234!',
    name: 'Test Rider',
    role: 'delivery',
    email: 'rider@medideliverysos.com',
    insurance_provider_id: null,
  },
]

async function createUser(account) {
  // 1. Create user via GoTrue admin API
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      phone: account.phone,
      password: account.password,
      phone_confirm: true,
      user_metadata: { full_name: account.name },
    }),
  })

  const user = await res.json()
  if (!res.ok || !user.id) {
    console.error(`❌ Failed to create ${account.name}:`, user)
    return
  }

  console.log(`✅ Auth user created: ${account.phone} (id: ${user.id})`)

  // 2. Insert into staff table
  const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: user.id,
      name: account.name,
      role: account.role,
      phone: account.phone,
      email: account.email,
      is_active: true,
      insurance_provider_id: account.insurance_provider_id,
    }),
  })

  if (!staffRes.ok) {
    const err = await staffRes.text()
    console.error(`❌ Failed to insert staff for ${account.name}:`, err)
    return
  }

  console.log(`✅ Staff record created: ${account.name} (${account.role})`)
}

if (SERVICE_ROLE_KEY === 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error(
    '❌ Please replace SERVICE_ROLE_KEY with your actual service role key!',
  )
  process.exit(1)
}

console.log('Creating staff accounts...\n')
for (const account of accounts) {
  await createUser(account)
}
console.log('\nDone! Try logging in with phone + password.')

