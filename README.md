# AdaptArxiv

**Replicate, adapt, compare.**

AdaptArxiv turns research papers into rerunnable adaptation experiments. Drop in
an arXiv link, let the system recover the experimental setup, adapt the training
data, and rerun the research to see how the results change.

The product is built for researchers, ML engineers, and data teams who want to
move beyond "this should improve the model" and actually measure the delta.
AdaptArxiv keeps the evaluation honest: the test set stays frozen, comparable
runs use the same runner and metric, and every result carries provenance.

## How It Works

1. **Replicate** - Extract the paper manifest, identify the dataset and metric,
   and recreate the baseline on a controlled runner.
2. **Adapt** - Send training rows through Adaption Labs recipes such as
   deduplication and prompt rephrasing while preserving labels.
3. **Validate** - Check adapted rows for shape, label consistency, duplicates,
   parser status, and test-set leakage.
4. **Compare** - Rerun the experiment and chart same-runner F1 deltas against a
   frozen test set.

## Reference Paper

The first supported research story is
[*Improving Indonesian Text Classification Using Multilingual Language Model*](https://arxiv.org/abs/2009.05713)
by Putra and Purwarianti. The original paper used multilingual transfer because
Indonesian labeled data was scarce. AdaptArxiv revisits that setup with adaptive
data: same task, same evaluation discipline, better training rows.

## Stack

- Next.js 16, React 19, Bun, Tailwind, shadcn/ui, Recharts
- Convex for paper jobs, stage events, run history, dataset metadata, and cached fallbacks
- Modal ASGI runner for dataset loading, XLM-R embeddings, Adaption jobs, validation, and F1 scoring
- Cursor Cloud for paper-manifest extraction
- Adaption Labs for training-data adaptation

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
CONVEX_ADMIN_SECRET=
CURSOR_API_KEY=
CURSOR_AGENT_MODEL=composer-2
CURSOR_CLOUD_REPO_URL=https://github.com/ilhamfp/AdaptArxiv.git
CURSOR_CLOUD_STARTING_REF=main
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
