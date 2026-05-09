# AdaptArxiv

AdaptArxiv is a hackathon demo that recreates a controlled Indonesian sentiment baseline, adapts only the training data with Adaption Labs, and compares F1 on the same frozen test set.

## Stack

- Next.js 16, React 19, Bun, Tailwind, shadcn/ui, Recharts
- Convex for run persistence and cached fallbacks
- Modal ASGI runner for Kaggle dataset loading, XLM-R embeddings, Adaption jobs, validation, and F1 scoring

## Local Setup

Create secrets:

```bash
cp .env.local.example .env.local
```

Fill `.env.local`:

```bash
CONVEX_DEPLOYMENT=
CONVEX_DEPLOY_KEY=
NEXT_PUBLIC_CONVEX_URL=
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
MODAL_RUNNER_URL=
ADAPTION_API_KEY=
KAGGLE_USERNAME=
KAGGLE_KEY=
DATASET_PROSA=
DEMO_ADMIN_PASSWORD=
OPENAI_API_KEY=
```

Run the app:

```bash
bun install
bun dev
```

## Convex

Convex functions live in `convex/`.

For local development, run:

```bash
bunx convex dev
```

This writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.
For Vercel production, create a Convex deploy key and set `CONVEX_DEPLOY_KEY`.

## Modal

Create the Modal secret:

```bash
modal secret create adaptarxiv-secrets \
  KAGGLE_USERNAME="$KAGGLE_USERNAME" \
  KAGGLE_KEY="$KAGGLE_KEY" \
  DATASET_PROSA="$DATASET_PROSA" \
  ADAPTION_API_KEY="$ADAPTION_API_KEY"
```

Smoke test with fixture mode:

```bash
modal serve modal_app/runner.py
```

Deploy:

```bash
modal deploy modal_app/runner.py
```

Set `MODAL_RUNNER_URL` to the deployed Modal web URL.

## Verification

```bash
bun run test
python3 -m pytest modal_app/tests/test_validation.py
bun run lint
bun run build
```
