# ClipCook

Recipe clipper built with Next.js 16 App Router, React 19, Firebase Admin, and Firestore.

## Architecture

- **Server-first**: All Firestore reads and writes go through `firebase-admin` in Server Components and Server Actions. The browser never talks to Firestore directly.
- **Auth**: Google sign-in via the Firebase Web SDK on `/login` only. The resulting ID token is exchanged for a server-signed session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production). All subsequent requests authenticate via that cookie.
- **Validation**: Every Server Action validates its input with Zod before touching the database.
- **Ownership**: Recipe reads and writes verify `data.uid === session.uid` inside a Firestore transaction — no IDOR.
- **Autoimport**: URL clipper blocks private IPs (DNS + literal), rejects redirects, caps the HTML payload at 2 MB and the image at 4 MB, and enforces a 10 s timeout. No `eval()`.

## Setup

1. Rotate the Firebase service account key (the one previously committed must be revoked). Download a fresh key from [Google Cloud IAM](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Copy `.env.example` to `.env.local` and fill in every variable.
3. Review `firestore.rules` — client access should be denied. All access is via Admin SDK.
4. Install:

```bash
npm install
npm run dev
```

## Scripts

| Command              | Purpose                              |
|----------------------|--------------------------------------|
| `npm run dev`        | Start the dev server                 |
| `npm run build`      | Production build                     |
| `npm run start`      | Run the production build             |
| `npm run typecheck`  | `tsc --noEmit`                       |
| `npm run lint`       | ESLint (flat config, Next + strict TS) |

## Project layout

```
src/
  app/
    layout.tsx              # root layout, fonts, metadata
    login/                  # sign-in page + session server action
    (app)/                  # protected group; verifies session in layout
      page.tsx              # home (lists recipes)
      create/
      recipe/[id]/          # view (server) + RecipeView client
      recipe/[id]/edit/
      actions.ts            # create/update/delete/import server actions
  components/               # client UI (all marked 'use client')
  lib/
    firebase-client.ts      # client SDK, used only on /login
  server/                   # server-only code
    firebase-admin.ts       # env-driven admin init (cached)
    auth.ts                 # session cookie create/verify/destroy
    recipes.ts              # cached CRUD with ownership checks
    autoimport.ts           # SSRF-safe recipe importer
    schemas.ts              # Zod input schemas
  styles/                   # SCSS modules + Material You tokens
  middleware.ts             # cookie presence → redirect UX (not auth)
```

## Security notes

The middleware only checks for the presence of a session cookie. It runs on the Edge runtime where `firebase-admin` is unavailable, so the actual cryptographic verification happens in `getSession()` (Node runtime) inside Server Components and Server Actions. Treat the middleware as UX only, not as a security boundary.
