# Claude Project Context — Yusof Portfolio

## ⚡ Output Rule (read this first)

**Every time you finish making edits, produce a `result.zip`** containing only the modified files with the **full project directory structure preserved**, so that running `unzip -o result.zip` in the project root replaces every file in exactly the right place.

```bash
zip result.zip \
  claude.md \
  src/app/pages/AboutPage.tsx \
  src/app/components/Navigation.tsx
```

List every changed file and the reason for each change when handing the zip to the user.

---

## ⚠️ Supabase Removed

Supabase backend has been removed. All content (projects, skills, about info) is now **hardcoded** directly in the page components. To update content, edit the relevant page file directly:

- `src/app/pages/AboutPage.tsx` — Personal info, experience, values, languages
- `src/app/pages/ProjectsPage.tsx` — Portfolio projects
- `src/app/pages/SkillsPage.tsx` — Skill categories and levels
- `src/app/pages/ContactPage.tsx` — Contact links

The Supabase files (`src/app/supabase/`) are kept in the project but no longer used by content pages.

---

## 🗂️ Frontend Structure

```
src/
  app/
    pages/          ← Route-level pages (hardcoded data from CV)
    components/     ← Shared components & service wrappers
      ui/           ← shadcn/ui primitives
    supabase/       ← UNUSED — kept for reference only
    contexts/       ← React contexts (TourContext)
  styles/           ← Global CSS / theme
```

**Tech stack:** React + Vite + TypeScript, styled-components, Framer Motion, Tailwind (shadcn), React Router v7.

---

## 👤 About Yusof (CV Summary)

- **Name:** Yusof Shokohyan
- **Role:** Full Stack Developer & DevOps Engineer | 4 Years Experience
- **Location:** Kampala, Uganda
- **Email:** yusof.shokohyan4@gmail.com
- **Phone:** +256 751 887 052
- **Languages:** English (Advanced), Persian (Native), Hindi (Proficient)

---

## 🐛 Fixes & changes log

### 2026-04-11 — Mobile nav moved to bottom bar
`Navigation.tsx` mobile nav changed from fixed top bar to fixed bottom bar (phone-style). Animation updated to slide up from bottom. `RootLayout.tsx` padding-bottom updated for mobile to accommodate bottom nav.

### 2026-04-11 — Supabase removed, CV data hardcoded
All content pages now use hardcoded data matching Yusof's CV exactly:
- **AboutPage** — real name, tagline, contact, story, full work experience timeline, values, languages
- **ProjectsPage** — Astra & Smart MegaFon Chatbots, MegaFon Shop, Sawda.com, SwiftType
- **SkillsPage** — 6 categories: Frontend, Backend, Databases, DevOps & Cloud, AI & NLP, Messaging & Architecture
- **ContactPage** — real email and phone number

### 2026-04-11 — Jarvis page reworked to pure Q&A + mobile padding fixed
- `AIIntroPage.tsx` — Removed intro game / name-collection flow entirely. Jarvis now immediately accepts questions about Yusof. Updated welcome text, input placeholder, disclaimer, and simplified returning-user flow. Removed blank top padding on mobile (`padding-top` removed from `Container`; layout's `MainContent` already handles it). Fixed `WelcomeContainer` mobile `margin-top` from `-180px` to `0`.
- `Geminiservice.ts` — Replaced `INTRO_GAME_PROMPT` with a full Yusof Q&A system prompt matching `JARVIS_SYSTEM_PROMPT` scope. Both prompts now serve the same purpose: answer any question about Yusof.
