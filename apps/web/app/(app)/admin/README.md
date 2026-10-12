# Admin Panel — work area

**All admin-panel work lives in this one folder** (`apps/web/app/(app)/admin/`).
Keeping it self-contained means it merges into the main app with zero conflicts.

## Where things go

```
app/(app)/admin/
├── layout.tsx              # section shell (already wired)
├── page.tsx                # /admin home — replace with the real UI
├── _components/            # all admin components (underscore = not a route)
│   └── admin-stat-card.tsx
├── _lib/                   # admin-only hooks/helpers (create when needed)
└── <feature>/page.tsx      # new sub-pages, e.g. admin/reports/page.tsx → /admin/reports
```

`_components` / `_lib` start with an underscore so Next.js doesn't treat them as
routes — that's how you co-locate everything here.

## Rules (so the merge stays clean)

- **Only edit files inside this folder.** The route, the sidebar "Admin Panel"
  link, and the URL (`ROUTES.admin`) are already wired for you — don't touch
  shared files (`app-sidebar.tsx`, `constants.ts`, `lib/api.ts`, etc.).
- **Reuse what exists:** shared UI from `@/components/ui/*` (shadcn — Button,
  Card, Table, Dialog, Badge…), and data via the `@/lib/api` client.
- **Need a new backend endpoint?** Don't add it to `lib/api.ts`. List it for
  Mojahid (or add a thin fetch in `_lib/` pointing at `NEXT_PUBLIC_API_URL`);
  it gets folded into the shared client at merge time.
- Match the neutral design (`neutral-*` Tailwind, no indigo/purple).

## Run it

You don't need Docker. See [`docs/FRONTEND_ONLY.md`](../../../../docs/FRONTEND_ONLY.md):
point `NEXT_PUBLIC_API_URL` at a running backend, then `pnpm dev`, and open
**http://localhost:3002/admin**.
