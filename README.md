# ClipCook

Recipe clipper built with Next.js 16 App Router, React 19, Firebase Admin, and Firestore.

## Architecture

- **Server-first**: All Firestore reads and writes go through `firebase-admin` in Server Components and Server Actions. The browser never talks to Firestore directly.
- **Auth**: Google sign-in via the Firebase Web SDK on `/login` only. The resulting ID token is exchanged for a server-signed session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production). All subsequent requests authenticate via that cookie.
- **Validation**: Every Server Action validates its input with Zod before touching the database.
- **Ownership**: Recipe reads and writes verify `data.uid === session.uid` inside a Firestore transaction — no IDOR.
- **Autoimport**: URL clipper blocks private IPs (DNS + literal), validates redirects, caps the HTML payload at 2 MB and the image at 4 MB, and enforces a 10 s timeout. No `eval()`. It scans every JSON-LD block on the page (not just the first) and matches both bare and full-URL `schema.org/Recipe` types.

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
| `npm run dev`        | Start the dev server (Turbopack; PWA disabled in dev) |
| `npm run build`      | Production build (webpack; Serwist bundles the SW) |
| `npm run start`      | Run the production build             |
| `npm run typecheck`  | `tsc --noEmit`                       |
| `npm run lint`       | Biome lint (`biome.json`)            |
| `npm run format`     | Biome format (writes in place)       |

The build script uses `--webpack` because Serwist 9 does not yet support Turbopack production builds. Dev stays on Turbopack with the service worker disabled.

## PWA

- `public/manifest.json` is served from the root and linked from the root layout.
- Serwist 9 generates `public/sw.js` at production build time from `src/app/sw.ts`.
- `src/components/service-worker-register.tsx` registers the worker on production builds only.

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
  proxy.ts                  # cookie presence → redirect UX (not auth)
```

## Security notes

`proxy.ts` (the Next.js 16 replacement for `middleware.ts`) only checks for the presence of a session cookie. It runs on the Edge runtime where `firebase-admin` is unavailable, so the actual cryptographic verification happens in `getSession()` (Node runtime) inside Server Components and Server Actions. Treat `proxy.ts` as UX only, not as a security boundary.

The autoimport fetcher uses an undici dispatcher whose `connect.lookup` hook validates every resolved IP, so DNS rebinding cannot reach private ranges between the pre-fetch check and the actual TCP connect.
