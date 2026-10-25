# Gusty

**Good ideas deserve to move.** Gusty is an AI-native, neuroinclusive platform that helps people turn
ideas into real projects — one small step at a time.

Start with [`CLAUDE.md`](CLAUDE.md) and the [`docs/`](docs) folder.

## Run it locally
Requires Node 22+ and pnpm (`corepack enable`).

```bash
pnpm install
npx supabase start  # local database (needs Docker); prints the URL and publishable key
cp .env.example .env.local   # then paste the publishable key into it
pnpm dev            # http://localhost:3000
```

Sign-in emails sent locally appear at http://127.0.0.1:54324.

## Checks
```bash
pnpm check                      # lint, types, unit tests
pnpm test:db                    # database privacy rules (needs local Supabase)
pnpm build && E2E_SUPABASE=1 pnpm test:e2e   # browser tests incl. the saving journey
```

## Deploy
Render reads [`render.yaml`](render.yaml): in the Render dashboard choose **New → Blueprint** and select
this repository, then fill in the environment values it asks for. See `docs/ARCHITECTURE.md`.
