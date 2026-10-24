# Gusty

**Good ideas deserve to move.** Gusty is an AI-native, neuroinclusive platform that helps people turn
ideas into real projects — one small step at a time.

Start with [`CLAUDE.md`](CLAUDE.md) and the [`docs/`](docs) folder.

## Run it locally
Requires Node 22+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local
pnpm dev            # http://localhost:3000
```

## Checks
```bash
pnpm check                      # lint, types, unit tests
pnpm build && pnpm test:e2e     # production build + browser tests (phone, tablet, desktop)
```

## Deploy
Render reads [`render.yaml`](render.yaml): in the Render dashboard choose **New → Blueprint** and select
this repository, then fill in the environment values it asks for. See `docs/ARCHITECTURE.md`.
