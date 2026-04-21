// ─── Run once to create insurance customer service accounts ──────────────────
// Usage: node create-insurance-customer-accounts.mjs
//
// Creates ONE shared customer account per insurance provider.
// Insurance staff use these accounts to place orders on behalf of
// patients who do not have a smartphone.
//
// Safe to re-run — looks up existing users instead of failing.
//
// Requirements: Node 18+, internet access
const SUPABASE_URL = 'https://zhdagydptxktspovfxhq.supabase.co'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZGFneWRwdHhrdHNwb3ZmeGhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk5ODcyNiwiZXhwIjoyMDg4NTc0NzI2fQ.0JxRklrjkmoDyBzrNnV-g0RYIAGnzFMKDj6kDlnKwEg'

const customerAccounts = [
  {
    phone: '+256700000010',
    password: 'Customer1234!',
    name: 'GA Insurance \u2013 Service Account',
    email: 'ga.customer@medideliverysos.com',
    insurance_provider: 'GA Insurance',
  },
  {
    phone: '+256700000011',
    password: 'Customer1234!',
    name: 'Jubilee \u2013 Service Account',
    email: 'jubilee.customer@medideliverysos.com',
    insurance_provider: 'Jubilee Health Insurance Uganda',
  },
  {
    phone: '+256700000012',
    password: 'Customer1234!',
    name: 'AAR \u2013 Service Account',
    email: 'aar.customer@medideliverysos.com',
    insurance_provider: 'AAR General Insurance Uganda',
  },
]

const headers = {
  'Content-Type': 'application/json',
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
}

/** Normalize phone for comparison — strip leading + so both sides match */
const normalizePhone = (p) => p.replace(/^\+/, '')

/** Try to create an auth user; if phone already exists, find the existing user. */
async function getOrCreateAuthUser(account) {
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone: account.phone,
      password: account.password,
      phone_confirm: true,
      user_metadata: { full_name: account.name },
    }),
  })
  const created = await createRes.json()

  if (createRes.ok && created.id) {
    console.log(`  \u2705 Auth user created: ${account.phone} (id: ${created.id})`)
    return created.id
  }

  if (created.error_code === 'phone_exists') {
    console.log(`  \u26a0\ufe0f  Phone already registered, locating existing user...`)

    const normalised = normalizePhone(account.phone)

    let page = 1
    while (true) {
      const listRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`,
        { headers },
      )
      if (!listRes.ok) {
        console.error(`  \u274c Admin users list failed (HTTP ${listRes.status})`)
        return null
      }
      const listData = await listRes.json()
      const users = listData.users ?? []

      const match = users.find(u => normalizePhone(u.phone ?? '') === normalised)
      if (match) {
        console.log(`  \u2705 Found existing user: ${account.phone} (id: ${match.id})`)
        return match.id
      }
      // Stop when we've seen fewer results than the page size
      if (users.length < 1000) break
      page++
    }

    console.error(`  \u274c Could not locate existing user for ${account.phone}`)
    return null
  }

  console.error(`  \u274c Failed to create auth user:`, created)
  return null
}

async function createCustomerAccount(account) {
  console.log(`\n\u25b6 Processing account for ${account.insurance_provider}...`)

  const userId = await getOrCreateAuthUser(account)
  if (!userId) return

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: userId,
      name: account.name,
      phone: account.phone,
      is_main_account: true,
    }),
  })

  if (!profileRes.ok) {
    const err = await profileRes.text()
    console.log(`  \u26a0\ufe0f  Profile note (may already exist): ${err}`)
  } else {
    const body = await profileRes.text()
    console.log(body && body !== '[]' ? `  \u2705 Profile created` : `  \u2705 Profile already exists`)
  }

  // Upsert into insurance_service_accounts — safe to re-run
  const trackRes = await fetch(`${SUPABASE_URL}/rest/v1/insurance_service_accounts`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      insurance_provider: account.insurance_provider,
      user_id: userId,
      phone: account.phone,
      email: account.email,
      display_name: account.name,
    }),
  })

  if (!trackRes.ok) {
    const err = await trackRes.text()
    console.error(`  \u274c Failed to upsert service account:`, err)
  } else {
    console.log(`  \u2705 Service account record upserted`)
  }

  console.log(`\n  \ud83d\udccb Credentials for ${account.insurance_provider}:`)
  console.log(`     Phone:    ${account.phone}`)
  console.log(`     Password: ${account.password}`)
}

console.log('\u2550'.repeat(55))
console.log('  Creating Insurance Customer Service Accounts')
console.log('\u2550'.repeat(55))

for (const account of customerAccounts) {
  await createCustomerAccount(account)
}

console.log('\n\n\u2705 All done!')
console.log('Insurance staff can now sign in to the customer portal')
console.log('using the credentials above to order on behalf of patients.')
