# MediDeliver – Pharmacy Prescription Delivery App

A full-stack pharmacy delivery app built with React + TypeScript + Mantine + Supabase.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```

App runs at **http://localhost:5173**

---

## 📁 Project Structure

```
src/
├── main.tsx                    # App entry + providers
├── lib/
│   └── supabase.ts             # Supabase client + typed interfaces
├── shared/
│   ├── constants/index.ts      # Brand colors (SavedColors)
│   └── ui/
│       ├── layout/             # AuthPageWrapper, ContentCard, PageHeader, etc.
│       ├── form/               # FormInput, FormSelect, FormCheckBox, etc.
│       └── typography/         # PageTitle, SectionLabel, BlueDivider, Paragraph
├── features/
│   ├── auth/
│   │   ├── context/AuthContext.tsx       # Auth state + Supabase session
│   │   ├── login-form/model/             # Customer login hook
│   │   └── register-form/model/          # Registration hook
│   ├── profile/
│   │   ├── add-profile-form/model/       # Add family member hook
│   │   └── edit-profile-form/model/      # Edit profile hook
│   ├── pharmacy/login-form/model/        # Pharmacy staff login
│   └── support/login-form/model/         # Support staff login
└── app/
    ├── theme/                  # Mantine theme (lotusCyan, lotusNavy)
    ├── routes.ts               # React Router v6 routes
    ├── mockData.ts             # Legacy mock data (kept for reference)
    ├── types.ts                # TypeScript types
    ├── components/
    │   ├── ChatButton.tsx      # Floating chat widget (Supabase realtime)
    │   └── form/               # Reusable form components
    ├── layouts/
    │   ├── RootLayout.tsx      # Customer routes + auth guard + ChatButton
    │   ├── PharmacyLayout.tsx  # Pharmacy routes + staff role guard
    │   └── SupportLayout.tsx   # Support routes + staff role guard
    └── pages/
        ├── customer/           # Login, Register, Dashboard, Orders, etc.
        ├── pharmacy/           # PharmacyLogin, PharmacyDashboard, PharmacyOrderDetail
        └── support/            # SupportLogin, SupportDashboard
```

---

## 🗄️ Supabase Project

- **URL**: https://zhdagydptxktspovfxhq.supabase.co
- **Project**: insurance-delivery-backend

### Tables
| Table | Description |
|-------|-------------|
| `profiles` | Family member profiles (linked to auth.users) |
| `insurance` | Insurance info per profile |
| `orders` | Prescription orders with full lifecycle status |
| `medications` | Line items per order (set by pharmacist) |
| `chat_messages` | Per-order real-time chat (customer ↔ staff) |
| `order_status_history` | Audit trail of status changes |
| `addresses` | Delivery addresses per user |
| `staff` | Staff accounts with roles |
| `delivery_zones` | Zones + fees |
| `insurance_providers` | Reference list |
| `notifications` | User notifications |

---

## 👥 Roles & Access

| Role | Login URL | Access |
|------|-----------|--------|
| Customer | `/login` | Own orders, profiles, insurance |
| Pharmacist | `/pharmacy/login` | All orders, set pricing, status updates |
| Assistant | `/pharmacy/login` | Same as pharmacist |
| Support | `/support/login` | All orders + live chat + insurance review |
| Admin | Either staff portal | Full access |

---

## 🔄 Order Flow

1. **Customer uploads prescription** → status: `prescription_uploaded`
2. **Support verifies insurance** → `insurance_status: verified`
3. **Pharmacy reviews** → `pharmacy_review`
4. **Pharmacy sets prices** → `pricing_ready` (customer gets notification)
5. **Customer confirms & pays** → `awaiting_confirmation` → `confirmed`
6. **Pharmacy packs & dispatches** → `packing` → `dispatched` → `out_for_delivery`
7. **Delivery completes** → `delivered`

---

## 💬 Chat System

- Real-time chat per order via **Supabase Realtime** (PostgreSQL changes)
- Customers: floating ChatButton widget (bottom-right)
- Support staff: chat modal in SupportDashboard per order
- Pharmacy staff: available in order detail view

---

## 🛡️ Insurance Workflow

1. Customer adds insurance when creating a profile
2. Support team reviews and verifies/rejects in SupportDashboard → Insurance Review tab
3. Verified insurance is applied automatically to future orders
4. Pharmacist marks which medications are covered by insurance

---

## 🔧 Environment Variables (Optional)

Create a `.env` file to override Supabase credentials:
```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

Then update `src/lib/supabase.ts` to read from `import.meta.env`.

---

## 📦 Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **Mantine UI v7** (components + notifications + dates)
- **React Router v6** (file-based routing structure)
- **React Hook Form** + **Yup** (form validation)
- **Supabase** (auth + database + realtime + storage)
- **Styled Components** (CSS-in-JS)
- **Tabler Icons** + **React Icons**
































need to remove multi profile [37m[39;49;00m
insurance staff and instead we [37m[39;49;00m
need to add multi account for [37m[39;49;00m
same insurance provider[37m[39;49;00m
[37m[39;49;00m
need to add the schedule delivery [37m[39;49;00m
logic[37m[39;49;00m
[37m[39;49;00m
i need to set to auto mode by [37m[39;49;00m
default always for darkmode [37m[39;49;00m
feature[37m[39;49;00m
[37m[39;49;00m
[37m[39;49;00m
need to remove the expiring cards [37m[39;49;00m
and chornic refill from alerts [37m[39;49;00m
because they have their own tab [37m[39;49;00m
and change the alert to message [37m[39;49;00m
page that should have ll the [37m[39;49;00m
messages from the all orders [37m[39;49;00m
[37m[39;49;00m
make a good plan to merge [37m[39;49;00m
verifications with customers that [37m[39;49;00m
for new verifications should be [37m[39;49;00m
new and all tab for that page [37m[39;49;00m
[37m[39;49;00m
make a good plan and merge the [37m[39;49;00m
orders and approval because they [37m[39;49;00m
to almost same thing[37m[39;49;00m
[37m[39;49;00m
in the sidebr bottom remove both [37m[39;49;00m
profile nd the user dev andmerge [37m[39;49;00m
them into one [37m[39;49;00m
[37m[39;49;00m
need to show the that insurance [37m[39;49;00m
staff that approved the order the [37m[39;49;00m
contact number in the order [37m[39;49;00m
detail for both customer and [37m[39;49;00m
pharmacist[37m[39;49;00m
[37m[39;49;00m
need to add a full feature of [37m[39;49;00m
medication reminder that they [37m[39;49;00m
could type the medicine and [37m[39;49;00m
dossage and time and this alerts [37m[39;49;00m
them for the customer only [37m[39;49;00m
