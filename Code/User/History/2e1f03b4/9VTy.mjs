// ─── Run once to create insurance customer service accounts ──────────────────
// Usage: node create-insurance-customer-accounts.mjs
//
// Creates ONE shared customer account per insurance provider.
// Insurance staff use these accounts to place orders on behalf of
// patients who do not have a smartphone.
//
// Requirements: Node 18+, internet access
const SUPABASE_URL = 'https://zhdagydptxktspovfxhq.supabase.co'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZGFneWRwdHhrdHNwb3ZmeGhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk5ODcyNiwiZXhwIjoyMDg4NTc0NzI2fQ.0JxRklrjkmoDyBzrNnV-g0RYIAGnzFMKDj6kDlnKwEg'

const customerAccounts = [
  {
    phone: '+256700000010',
    password: 'Customer1234!',
    name: 'GA Insurance – Service Account',
    email: 'ga.customer@medideliverysos.com',
    insurance_provider: 'GA Insurance',
  },
  {
    phone: '+256700000011',
    password: 'Customer1234!',
    name: 'Jubilee – Service Account',
    email: 'jubilee.customer@medideliverysos.com',
    insurance_provider: 'Jubilee Health Insurance Uganda',
  },
  {
    phone: '+256700000012',
    password: 'Customer1234!',
    name: 'AAR – Service Account',
    email: 'aar.customer@medideliverysos.com',
    insurance_provider: 'AAR General Insurance Uganda',
  },
]

async function createCustomerAccount(account) {
  console.log(`\n▶ Creating account for ${account.insurance_provider}...`)

  // 1. Create auth user
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
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

  const user = await authRes.json()
  if (!authRes.ok || !user.id) {
    // Try by email if phone already exists
    if (user.message?.includes('already')) {
      console.log(
        `  ⚠ User may already exist for ${account.phone}, skipping auth creation.`,
      )
    } else {
      console.error(`  ❌ Failed to create auth user:`, user)
      return
    }
  } else {
    console.log(`  ✅ Auth user created: ${account.phone} (id: ${user.id})`)
  }

  const userId = user.id

  // 2. Create profile (main account)
  if (userId) {
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        name: account.name,
        phone: account.phone,
      }),
    })

    if (!profileRes.ok) {
      const err = await profileRes.text()
      console.error(`  ❌ Failed to create profile:`, err)
    } else {
      console.log(`  ✅ Profile created for ${account.name}`)
    }

    // 3. Register in insurance_service_accounts table
    const trackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/insurance_service_accounts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          insurance_provider: account.insurance_provider,
          user_id: userId,
          phone: account.phone,
          email: account.email,
          display_name: account.name,
        }),
      },
    )

    if (!trackRes.ok) {
      const err = await trackRes.text()
      console.error(`  ❌ Failed to track service account:`, err)
    } else {
      console.log(`  ✅ Registered in insurance_service_accounts`)
    }
  }

  console.log(`\n  📋 Credentials for ${account.insurance_provider}:`)
  console.log(`     Phone:    ${account.phone}`)
  console.log(`     Password: ${account.password}`)
}

console.log('═══════════════════════════════════════════════════════')
console.log('  Creating Insurance Customer Service Accounts')
console.log('═══════════════════════════════════════════════════════')

for (const account of customerAccounts) {
  await createCustomerAccount(account)
}

console.log('\n\n✅ All done!')
console.log('Insurance staff can now sign in to the customer portal')
console.log('using the credentials above to order on behalf of patients.')

