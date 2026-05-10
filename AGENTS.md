<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Notes |
|---|---|---|
| Next.js dev server | `bun dev` | Runs on port 3000. Works without external credentials (UI degrades gracefully). |
| Vitest (JS tests) | `bun run test` | 7 tests across 3 files. Fast (~300ms). |
| Pytest (Python tests) | `python3 -m pytest modal_app/tests/ -v` | 12 tests. Requires `pandas`, `scikit-learn`, `numpy`, `pytest`. |
| ESLint | `bun run lint` | |
| Next.js build | `bun run build` | |

### Key gotchas

- **Package manager is Bun**, not npm/pnpm. The lockfile is `bun.lock`. Always use `bun install`, `bun dev`, `bun run test`, etc.
- **Bun must be on PATH**: run `export PATH="$HOME/.bun/bin:$PATH"` if `bun` is not found.
- **`.env.local`** must exist (copy from `.env.local.example`). The app starts without real credentials but external features (Convex persistence, Modal ML runner, Adaption Labs, OpenAI, Kaggle) require their respective API keys.
- **Convex and Modal are external hosted services**. `bunx convex dev` and `modal serve modal_app/runner.py` require valid credentials. The frontend works without them — it shows empty states and degraded UI.
- The **`/api/health`** endpoint reports which env vars are missing; `ok: false` is expected when credentials are absent.
- Python test dependencies (`pandas`, `scikit-learn`, `numpy`, `pytest`) are not in a `requirements.txt` — they are installed directly by the update script.
