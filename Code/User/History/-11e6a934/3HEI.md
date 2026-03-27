# CLAUDE.md — MediDeliver

This file contains instructions and conventions for Claude when working on this project.

---

## Project Overview

This is a **React-based medicine delivery platform** called **MediDeliver**. It serves three user roles:

- **Customers** — upload prescriptions, manage insurance, track orders and deliveries, manage family profiles
- **Pharmacy staff** — review prescriptions, manage orders, verify insurance, handle pricing and dispensing
- **Support staff** — handle escalations, user management, and platform oversight

Key domain concepts: prescription uploads, insurance verification, order lifecycle (`prescription_uploaded` → `delivered`), OTP-based delivery confirmation, MTN MoMo / Airtel Money / COD payments, and family profile management.

---

## General Instructions

### 1. Modified Files — Always Provide a ZIP

At the end of every response where files were created or modified:

- Package **all changed files** into a `.zip` archive
- Preserve the full project structure starting from `/src`
  - Example: `src/app/pages/customer/OrderTracking.tsx` must remain at that path inside the zip
- **Always name the zip file `done.zip`** — no exceptions, regardless of what was changed.
- Present the zip as a downloadable file for the user

### 2. TypeScript — Strict Mode, No `any`

- **Never use `any` as a type.** Use proper types, interfaces, or generics instead.
- Prefer `unknown` over `any` when the type is truly uncertain, and narrow it before use.
- Define explicit return types on all functions and components.
- Use `interface` for object shapes and `type` for unions, intersections, and aliases.
- Enable and respect `strict: true` in `tsconfig.json`.

```ts
// ❌ Never do this
const handleData = (data: any) => { ... }

// ✅ Do this instead
const handleData = (data: DbOrder) => { ... }
```

### 3. Backend — Supabase (MediDeliver)

This project uses **Supabase** as the backend. The connected project is **MediDeliver**.

- **Project ID**: `zhdagydptxktspovfxhq`
- **Supabase URL**: `https://zhdagydptxktspovfxhq.supabase.co`
- **Host**: `db.zhdagydptxktspovfxhq.supabase.co`

When working on any backend-related task (schema changes, queries, migrations, RLS policies, Edge Functions, etc.):

1. Always connect to the MediDeliver project using the project ID above.
2. Use `apply_migration` for all DDL changes (CREATE, ALTER, DROP) — never raw `execute_sql` for schema changes.
3. Before making any schema change, inspect the current state with `list_tables` or `execute_sql` to avoid conflicts.
4. Migration names must be in `snake_case` and descriptive (e.g. `add_refund_method_to_sales_returns`).
5. Never hardcode auto-generated IDs in data migrations.

---

## Code Conventions

- **Components**: Functional components only, with typed props using `interface`.
- **State management**: Context API (see `src/features/auth/context/AuthContext.tsx` for pattern).
- **Styling**: Mantine UI v7 + styled-components. Follow existing component patterns.
- **Forms**: `react-hook-form` + `yup` for validation. Use shared form components from `src/app/components/form/`.
- **File naming**: PascalCase for components (`OrderTracking.tsx`), camelCase for utilities and hooks (`useLoginForm.ts`).
- **Folder structure**: Feature-based under `src/features/` for logic/hooks; pages under `src/app/pages/`; shared UI under `src/shared/ui/`.
- **Routing**: React Router v6, routes defined in `src/app/routes.ts`.
- **Types**: Domain DB types are defined in `src/lib/supabase.ts` — always extend from there.

---

