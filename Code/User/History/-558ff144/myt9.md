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
































