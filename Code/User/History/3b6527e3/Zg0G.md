# CLAUDE.md — Pharmacy Management System

This file contains instructions and conventions for Claude when working on this project.

---

## Project Overview

This is a **React-based Pharmacy Management System** for managing prescriptions, inventory, patients, and dispensing workflows.

---

## General Instructions

### 1. Modified Files — Always Provide a ZIP

At the end of every response where files were created or modified:

- Package **all changed files** into a `.zip` archive
- Preserve the full project structure starting from `/src`
  - Example: `src/components/Inventory/InventoryTable.tsx` must remain at that path inside the zip
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
const handleData = (data: PatientRecord) => { ... }
```

---

## Code Conventions

- **Components**: Functional components only, with typed props using `interface`.
- **State management**: Follow the existing pattern in the project (e.g. Redux / Zustand / Context).
- **Styling**: Follow the existing styling approach in the project (e.g. Tailwind / CSS Modules).
- **File naming**: PascalCase for components (`PrescriptionForm.tsx`), camelCase for utilities (`formatDosage.ts`).
- **Folder structure**: Keep components co-located with their hooks and tests under `src/`.

---

