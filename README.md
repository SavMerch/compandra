# compandra.

Mobile-first family event planning: create an event, invite family, plan every detail, then use the same app while it happens.

React, TypeScript, Vite, Tailwind, shadcn-style components, Supabase, Netlify, installable PWA.

- **Set it up:** [docs/SETUP.md](docs/SETUP.md)
- **How it's built:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Running tests:** [docs/TESTING.md](docs/TESTING.md)
- **What's done and what isn't:** [docs/CHECKLIST.md](docs/CHECKLIST.md)

```bash
npm install
cp .env.example .env.local   # add your Supabase URL and publishable key
npm run dev
```

**Rebranding:** set `VITE_BRAND_NAME` and `VITE_BRAND_THEME_COLOR`, edit colors in `src/index.css`, and edit then run `npm run icons`.
