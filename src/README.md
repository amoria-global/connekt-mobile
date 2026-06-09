# Connekt Mobile — source layout

Expo + expo-router + TypeScript. Path alias `@/*` → `src/*` (see `tsconfig.json`).

```
src/
├── app/            # expo-router routes (file-based). Each file = a screen/route.
│                   #   _layout.tsx defines navigators; (group) folders group routes.
├── api/            # Shared HTTP layer
│   ├── client.ts   #   typed fetch wrapper (base URL, auth, timeout, errors)
│   └── endpoints/  #   cross-feature endpoint groups (optional)
├── features/       # Feature-first modules — the heart of the app
│   └── auth/       #   each feature owns its api.ts, types.ts, hooks/, components/
├── components/     # Reusable, presentational UI shared across features
│   └── ui/         #   low-level primitives (Button, Card, ...)
├── hooks/          # Generic reusable hooks (not tied to one feature)
├── services/       # Device/platform services (storage, notifications, ...)
├── store/          # Global state (Context / Zustand / Redux — your choice)
├── config/         # env.ts and other build-time configuration
├── constants/      # theme tokens, colors, layout constants
├── types/          # app-wide shared types
├── lib/            # third-party wrappers / pure helpers with deps
└── utils/          # small pure helpers (formatting, validation, ...)
```

## Rules of thumb
- **Feature-first.** A screen's data-fetching, types, and local components live
  under `features/<name>/`. Promote to `components/` or `hooks/` only when reused.
- **Routes stay thin.** Files in `app/` wire navigation + compose feature pieces.
  Business logic belongs in `features/`, not in route files.
- **One API door.** All network calls go through `@/api/client`. Never call
  `fetch` directly from components.
- **No secrets in the bundle.** Config in `@/config/env`; secrets stay on the
  amoria-connect backend.

## Backend
Talks to **amoria-connect** (Spring Boot). Set the API URL via
`EXPO_PUBLIC_API_BASE_URL` or `expo.extra.apiBaseUrl` in `app.json`.
