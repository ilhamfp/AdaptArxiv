# AdaptArxiv — PRD v2

**Author:** [you]
**Date:** May 9, 2026
**Hackathon:** AI Engineer Singapore (May 15–17, 2026)
**Target:** Adaption Labs sponsor track ($1,500 USD + 1,500 credits)
**Status:** Draft v2 — scientific guardrails patched
**Build window:** 7 hours, solo

---

## 1. One-liner

**AdaptArxiv takes a published ML paper, recreates a controlled baseline, adapts only the training data with Adaption Labs, and shows whether the unchanged test-set metric improves.**

The demo paper is the author's own: *"Improving Indonesian Text Classification Using Multilingual Language Model"* (arXiv:2009.05713, Putra & Purwarianti, 2020). The paper's premise — *"we don't have enough Indonesian data, so we borrow English"* — is exactly the problem Adaption Labs was founded to obsolete.

AdaptArxiv is not a magic-improvement tool. **AdaptArxiv is an evidence machine: reproduce the paper, adapt the training data, keep the test set fixed, show the delta.**

## 2. Why this wins the Adaption Labs track

- **On-thesis.** Adaption Labs' public mission is malleable, in-language, in-domain data — *"averages erase the exceptional… your country, your language, your industry."* A 2020 Indonesian-NLP paper that explicitly hacks around data scarcity is the most on-thesis demo target available.
- **Falsifiable, not vibes.** A fixed Indonesian test set, a paper-inspired controlled baseline, and Adaption-adapted training data — same runner, same split, same metric. The delta either appears or it doesn't.
- **A narrative no other team has.** *"Six years ago I wrote this paper because Indonesian labels were scarce. Today I'm asking whether Adaption can replace the English-data hack — on my own paper, live."*
- **Sponsor-stack legible.** Adaption (data) + Modal (compute) + OpenAI (paper extraction) + Next.js. Clean, no kitchen-sink.

## 3. Goals & non-goals

**Goals**
- G1: Recreate a controlled, paper-inspired feature-based classification harness — same dataset, same 90:10 stratified split, same single-dense-layer head, same fixed Indonesian test set.
- G2: Adapt only the training data via Adaption Labs (Indonesian-only augmentation and/or English→Indonesian CrossLift). Test set is never touched.
- G3: Report a same-runner, same-test-set delta between baseline and Adaption-adapted training data.
- G4: Show Adaption's own dataset-quality evaluation (`improvement_percent`) as a secondary signal.
- G5: Live-probe a judge-submitted Indonesian example and show whether targeted adaptation improves the model's behavior on *that example*.

**Non-goals**
- Generic arXiv → reproduce-anything pipeline. v1 supports only the demo paper, only binary text classification, only Farhan & Khodra sentiment.
- Exact-number reproduction of the paper's published figures. AdaptArxiv's harness is *paper-inspired*, not bit-exact.
- Full XLM-R Large fine-tuning. Feature-based only.
- Hate speech as a primary demo. Kept only as a label-mismatch warning tab (see §16, Could).
- Multi-user, OAuth, encrypted-at-rest keys. v1 is single-user (`ALLOWED_EMAIL` gate); v2 adds these.

## 4. Users & use cases

**Primary user (demo):** Adaption Labs judge. Wants to see (a) their API doing real work, (b) a number that moves under controlled conditions, (c) a use case worth their landing page.

**Secondary user (post-hackathon):** ML researchers who want to ask *"would Adaption-adapted data improve my own published baseline?"* Same workflow, different paper.

## 5. Scientific guardrails (read this first)

These rules apply to every comparison shown on stage and in the UI.

1. **The Indonesian test set is never adapted. Only the training data changes.** This sentence appears in the product, the demo script, and on the chart.
2. **Same-runner rule.** Every directly comparable bar on the chart uses the same Modal runner, same model, same split, same metric, same fixed test set. The only thing that varies is the training data.
3. **Paper-reported numbers are not directly comparable bars.** They appear as a dotted reference line, clearly labeled *"paper-reported, different runner."*
4. **Every number in the UI carries a provenance badge** (see §13, Numbers Policy): `reported in paper`, `reproduced live`, `cached completed run`, `target, not yet verified`, or `estimated`.
5. **Adapted data is validated before training** (see F4) — schema, language, label preservation, dedup, no test-set leakage.
6. **Reasoning traces are an audit feature, not the F1 mechanism.** For a feature-based classifier, the F1 lift comes from text augmentation (rephrase, dedup, CrossLift), not from CoT. Don't claim otherwise on stage.

## 6. Functional requirements

### F1 — Paper ingest
- Paste arXiv URL or upload PDF.
- gpt-4o-mini extracts: `{title, authors, github_url, dataset_path, baseline_task, baseline_metric}`.
- For arXiv:2009.05713, hardcoded fallback overrides extraction with verified manifest values. **Never fails on the demo paper.**
- UI surfaces a "paper manifest" panel showing what was extracted, with `reported in paper` badges.

### F2 — Controlled baseline harness (Modal)
- One Modal function, GPU-backed, pre-baked image.
- Loads Farhan & Khodra CSV from the paper's GitHub: `https://github.com/ilhamfp/indonesian-text-classification-multilingual/tree/master/data`.
- Stratified 90:10 train/val split, seed=1 (matches paper protocol; paper averages over seeds 1–6, we use seed=1 for demo speed and document this).
- Subsample training to N=500 (paper's lowest-N condition, where the largest gains were reported).
- Test set: the paper's published test split. **Frozen for the entire demo.**
- Two implementation paths (decide at hour 2):

  **Path A (safer fast demo)** — mBERT-base or XLM-R-base features.
  - Labeled in UI as *"paper-inspired fast harness."*
  - Does not claim exact paper-best reproduction.
  - Compared only against same-runner sibling bars.

  **Path B (stronger faithful demo)** — XLM-R Large feature-based.
  - Cache embeddings to a Modal Volume *before* the demo (hour 4).
  - Train lightweight dense head live.
  - Faithful to the paper's strongest-result configuration.
  - **Recommendation: Path B if rehearsal time permits.** Avoid mBERT if any chart bar references XLM-R paper numbers as a comparison anchor.

- Head: single dense + dropout(0.2) + sigmoid, binary cross-entropy, mirroring the paper's feature-based setup.

### F3 — Adaption integration

**Adaption-facing schema (sent to API):**
```json
{
  "prompt": "Klasifikasikan sentimen ulasan berikut: {text}",
  "completion": "positif" | "negatif",
  "context": []
}
```

**Endpoints:**
- `POST /api/v1/datasets` — create
- `POST /api/v1/datasets/{id}/run` with:
  - `recipe_specification.recipes`: `{deduplication: true, prompt_rephrase: true}` (hero recipes for feature-based F1)
  - `recipe_specification.recipes.reasoning_traces`: optional, surfaced in UI as audit/explainability only — *not* claimed as the F1 mechanism
  - `brand_controls`: `{length: "concise", hallucination_mitigation: true}`
  - **Blueprint specification (sent as recipe instruction):** *"Generate natural Indonesian sentiment-classification training examples. Preserve the original label. Do not invent conflicting sentiment. Return strict JSON with adapted_text and label. Allowed labels: positive, negative."*
  - `job_specification.max_rows: 500`
- `GET /api/v1/datasets/{id}/evaluation` — pull `score_before`, `score_after`, `improvement_percent` for the secondary signal.

**Two supported variants (system supports both; demo picks the rehearsal winner):**

- **Variant A — Indonesian-only adaptation.** 500 Indonesian training rows in → cleaned, deduped, rephrased Indonesian rows out. Hero story: *"Adaption makes scarce Indonesian data better."*
- **Variant B — English-to-Indonesian CrossLift.** Yelp English rows in → natural Indonesian rows with preserved sentiment labels out. Hero story: *"Adaption turns raw source-language supervision into target-language training data — without the multilingual-model crutch."*

If both variants land cleanly in rehearsal, both appear in the chart.

### F4 — Adapted data validation (gate before training)

After pulling Adaption results, validate every row:

- JSON parses cleanly
- `label` field is one of `{"positive", "negative"}`
- `adapted_text` is non-empty and ≥ 8 tokens
- `adapted_text` language detection returns `id` (use `langdetect` or `fasttext-langid`)
- For Variant B (CrossLift): label is preserved against the source row's label
- No exact or near-duplicate of any row in the fixed test set (cosine similarity < 0.95 on TF-IDF or sentence embeddings)
- No exact duplicates within the adapted set

Rows that fail validation are dropped, counted, and surfaced in the UI as a *"data validation"* panel — *"487 of 500 adapted rows passed validation."* This panel is part of what makes the demo feel honest.

### F5 — Adapted reproduction (Modal, same runner)
- Same Modal function as F2, same model, same head, same hyperparameters.
- Training set replaced with the validated adapted set; conversion to model-facing schema:

```json
{
  "original_text": "...",
  "adapted_text": "...",
  "label": "positive" | "negative",
  "language": "id",
  "source": "adaption" | "yelp_crosslift" | "original"
}
```

The classifier trains only on `(adapted_text, label)`.

- Reports F1 on the **same fixed Indonesian test set**.

### F6 — Results UI

**Headline chart** — bar chart with same-runner bars only:
- *Indonesian only (controlled baseline)* — `reproduced live` or `cached completed run`
- *Indonesian + raw English (paper-style augmentation)* — `reproduced live`
- *Indonesian + Adaption-adapted Indonesian* — `reproduced live`
- *Indonesian + Adaption-adapted Yelp→ID (CrossLift)* — `reproduced live` (if Variant B lands)
- **Dotted reference line:** *paper-reported XLM-R best (~0.79 at N=500, multilingual)* — labeled `reported in paper, different runner`. Not a comparable bar.

**Secondary panels:**
- Adaption's own evaluation: `score_before` / `score_after` / `improvement_percent` — labeled `from Adaption Labs evaluator`.
- Validation panel: row counts, drops, language check pass-rate.
- Specification panel (Blueprint-style): the recipes and Blueprint instruction used.

### F7 — Live probe (replaces "global F1 from one row")

- Judge enters a hard Indonesian example (sarcasm, code-switch, Singlish-Indonesian, regional slang, etc.).
- Current model predicts: shown with **probability/confidence**, not just the label.
- AdaptArxiv pipeline:
  1. Send the failure example as a Blueprint-style seed to Adaption.
  2. Adaption generates a small adapted batch (~20 rows) around that failure mode.
  3. Validation gate runs on the new batch.
  4. Lightweight dense head retrains on `original_train ∪ new_adapted_batch`.
  5. UI shows: did *this specific example* flip from wrong→right? Did confidence improve? Did F1 on the fixed test set move (and by how much, with rehearsed expectation framing)?

**Honesty rule for the live probe:** global test-set F1 is *not* casually animated from one row. The probe is framed as *"can targeted adaptation improve behavior on this failure pattern?"* Test-set F1 may move slightly because the new batch is ~20 rows, not 1; if it moves, label it as such. If it doesn't, that's still a clean result.

### F8 — Single-user mode + persistent keys (Supabase)

**Auth model (v1):** single user, hardcoded. No Google login, no OAuth, no multi-tenancy.

- `ALLOWED_EMAIL=ilhamfirdausiputra@gmail.com` set in `.env`.
- Settings page is gated by a single password (`SETTINGS_PASSWORD` in `.env`) — typed once per session, persisted via httpOnly cookie. Anyone hitting `/` without the cookie sees the read-only demo page.
- All server routes that touch keys check `email === ALLOWED_EMAIL` from the session cookie before reading them.

**Key storage:** plain columns in a Supabase `user_secrets` table, gated by the `ALLOWED_EMAIL` check at the API layer. No pgsodium/Vault for v1 — explicitly accepted as v1 trade-off.

```sql
create table user_secrets (
  email           text primary key,
  openai_api_key  text,
  adaption_api_key text,
  modal_token_id  text,
  modal_token_secret text,
  updated_at      timestamptz default now()
);
```

- Supabase Row Level Security: enabled, service role only. No anon access. App uses `SUPABASE_SERVICE_ROLE_KEY` server-side; client never touches keys.
- Settings page UI: four fields (`OPENAI_API_KEY`, `ADAPTION_API_KEY`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`), each shown masked (`sk-…abc4`) with a "rotate" button.
- Server reads keys per-request from Supabase. Optional in-memory cache with 60s TTL for demo speed.

**Why this is fine for v1:** single hardcoded user, single keyholder, demo-only deployment, no judges typing keys, no public signups. v2 adds Google OAuth + pgsodium.

### F9 — Persistence layer (Supabase)

Every run, dataset, and probe lands in Supabase. This serves three goals: (a) demo-day caching (rehearsal runs become "cached completed run" fallbacks), (b) provenance (every number on stage traces back to a row), (c) post-demo write-up.

**Schema:**

```sql
-- Already defined in F8
create table user_secrets (...);

-- One row per ingested paper
create table papers (
  id              uuid primary key default gen_random_uuid(),
  arxiv_id        text unique,
  title           text,
  manifest        jsonb,           -- {github_url, dataset_path, baseline_metric, ...}
  source          text,            -- 'extracted' | 'hardcoded_fallback'
  created_at      timestamptz default now()
);

-- One row per Modal training run (baseline or adapted)
create table runs (
  id              uuid primary key default gen_random_uuid(),
  paper_id        uuid references papers(id),
  runner_config   jsonb,           -- {model, split_seed, n_train, head_config, ...}
  training_source text,            -- 'indonesian_only' | 'indonesian_plus_yelp'
                                   -- | 'adaption_id_aug' | 'adaption_yelp_crosslift'
  adapted_dataset_id uuid references adapted_datasets(id),  -- null for baselines
  test_set_hash   text,            -- sha256 of fixed test set; must match across runs
  metric_name     text,            -- 'f1'
  metric_value    numeric,
  provenance      text,            -- 'reproduced_live' | 'cached_completed_run'
  modal_call_id   text,
  duration_ms     int,
  created_at      timestamptz default now()
);

-- One row per Adaption job
create table adapted_datasets (
  id                    uuid primary key default gen_random_uuid(),
  paper_id              uuid references papers(id),
  adaption_dataset_id   text,      -- Adaption Labs' own ID
  variant               text,      -- 'id_aug' | 'yelp_crosslift'
  recipes               jsonb,     -- {deduplication, prompt_rephrase, ...}
  blueprint_instruction text,
  rows_requested        int,
  rows_returned         int,
  rows_passed_validation int,
  validation_drops      jsonb,     -- {language_fail: n, label_drift: n, ...}
  score_before          numeric,   -- from Adaption evaluator
  score_after           numeric,
  improvement_percent   numeric,
  storage_path          text,      -- Supabase Storage URL for the adapted Parquet
  created_at            timestamptz default now()
);

-- Live probe history
create table probe_history (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references runs(id),
  input_text          text,
  before_label        text,
  before_confidence   numeric,
  adapted_batch_id    uuid references adapted_datasets(id),
  after_label         text,
  after_confidence    numeric,
  flipped             boolean,
  test_set_f1_before  numeric,
  test_set_f1_after   numeric,
  created_at          timestamptz default now()
);
```

**Storage rules:**
- The fixed test set lives in Supabase Storage at a known path; its sha256 is stamped onto every `runs` row. Any run with a different `test_set_hash` cannot appear on the same chart.
- Adapted datasets (Parquet) live in Supabase Storage; row in `adapted_datasets` carries the URL.
- `runs` rows are immutable. Demo-day "cached completed run" reads the latest valid row matching `(paper_id, runner_config, training_source, test_set_hash)`.
- RLS: all tables service-role-only. App reads via `SUPABASE_SERVICE_ROLE_KEY` server-side after `email === ALLOWED_EMAIL` check.

**Demo-day fallback logic** (per chart bar):
1. Attempt live run.
2. On timeout/error, fetch most recent matching `runs` row from Supabase.
3. UI badge automatically reads `provenance` field and shows the correct label.

## 7. Non-functional requirements

- **Demo latency:** baseline reproduction ≤ 60s (cached embeddings if Path B), Adaption run ≤ 3min (use cached completed run for headline), adapted reproduction ≤ 60s.
- **Pre-warmed Modal:** `min_containers=1` for 30 min around demo.
- **Failure resilience:** every async call has a real cached fallback from a verified rehearsal run. **Cached results must be from actual completed runs, not fabricated.**
- **30-second backup video:** ready on desktop.

## 8. Architecture

```
[Browser] ── Next.js (Vercel)
   │
   ├── /api/extract     → OpenAI gpt-4o-mini       # F1
   ├── /api/baseline    → Modal function (GPU)     # F2, F5
   ├── /api/adapt       → Adaption Labs API        # F3
   ├── /api/validate    → Modal or local           # F4
   ├── /api/probe       → Adaption + Modal         # F7
   └── /api/settings    → Supabase                 # F8
   │
   └── all server routes ─→ Supabase (keys, runs, history)

[Modal]
   └── adaptarxiv-runner (pre-baked image; XLM-R weights + cached
                     test-set embeddings in a Volume)

[Supabase — Postgres + RLS service-role-only]
   ├── user_secrets         (F8: keys, single-user)
   ├── papers               (paper manifests, cached extractions)
   ├── runs                 (every Modal/Adaption run + result + provenance)
   ├── adapted_datasets     (Adaption job IDs, validation stats, row counts)
   └── probe_history        (live probe inputs + before/after predictions)

[Storage]
   └── Supabase (keys, runs, results, probe history)
       Modal Volume (embeddings, checkpoints, model weights)
       In-memory cache (60s TTL on keys for request speed)
```

## 9. Stack

- Next.js 15 + Tailwind on Vercel
- **Supabase (Postgres + Storage)** — keys, run history, cached results, probe log
- Modal (one function, GPU, pre-baked image, embeddings cached in a Volume)
- Adaption Labs Adaptive Data API
- OpenAI gpt-4o-mini (extraction)
- `langdetect` or `fasttext-langid` for validation

## 10. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Adaption `run` exceeds 3min on stage | Med | High | Pre-completed full run cached; show progress live, cut to cached headline if needed |
| Baseline harness drifts from paper numbers | High | Med | Don't claim exact reproduction. Label as `paper-inspired fast harness`. Compare only same-runner siblings. |
| `improvement_percent` is small/negative | Low–Med | Med | Pre-test multiple recipe combos and both variants A/B; lock the rehearsal winner |
| Adapted F1 is below baseline | Low–Med | High | This is a real possible outcome. Rehearse with both variants; if one wins, lead with it. If neither wins cleanly, lead with `improvement_percent` and the live probe; frame the chart as *"the controlled experiment ran; here's what we learned."* Honesty > spin. |
| Modal cold start | Med | Med | `min_containers=1`; warm path rehearsed |
| OpenAI extraction hallucinates | Low | Low | Hardcoded manifest fallback for demo paper |
| Adaption API outage | Low | High | Cached real run; recorded video as last resort |
| Test-set leakage from adapted data | Med | High | F4 validation gate enforces near-duplicate check against test set |
| Validation drops too many rows | Low | Med | Surface drop count in UI; if >30%, fall back to cached rehearsal run |
| Supabase outage on demo day | Low | High | Local SQLite mirror of `runs` + `adapted_datasets` synced before stage; app can fall back to read-only file. Keys also kept in `.env` as ultimate backup. |
| Plain-text key columns leaked | Low | High | Service-role-only access; RLS on; `ALLOWED_EMAIL` gate at API layer; v2 migrates to pgsodium. Documented v1 trade-off. |
| `test_set_hash` mismatch silently breaks chart | Low | Med | App refuses to render bars with mismatched hash; surfaces error in dev panel. |

## 11. Out of scope (post-hackathon)

- General-purpose arXiv → reproduce-anything
- Other task types (regression, generation, multi-class)
- Other paper sources beyond arXiv
- Multi-user / Google OAuth / pgsodium-encrypted keys (v2)
- Cost dashboards, project history UI

## 12. Success criteria

**Must:**
- Working live demo
- Adaption API call succeeds on stage *or* cached real run is shown with clear `cached completed run` labeling
- Fixed-test-set comparison is visible with same-runner bars and provenance badges
- At least one Adaption dataset-quality improvement is shown (`improvement_percent`)
- At least one downstream metric delta is shown (same-runner F1, baseline vs adapted)

**Should:**
- Adaption-adapted variant beats raw/source baseline on the fixed test set
- Judge-submitted example improves on the local probe (flip or confidence gain)

**Could:**
- Publish adapted dataset to Hugging Face during the close
- Show the hate-speech label-mismatch warning tab as a "what doesn't work" honesty moment

## 13. Numbers Policy

Every number on screen and in the deck carries one of these provenance badges:

| Badge | Meaning | Example |
|---|---|---|
| `reported in paper` | Lifted directly from the paper's text/tables. Not a AdaptArxiv result. | Paper's XLM-R N=500 multilingual ~0.79 |
| `reproduced live` | Computed by the AdaptArxiv runner during the demo, on the fixed test set | Baseline F1 from F2 |
| `cached completed run` | From a real completed run during rehearsal, replayed on stage. Never fabricated. | Adapted-data F1 if API is slow |
| `from Adaption evaluator` | Output of Adaption's own quality evaluator (`improvement_percent` etc.) | "+47% data quality" |
| `target, not yet verified` | Aspirational rehearsal target; only used internally pre-build | Internal docs only — never on stage |
| `estimated` | Quote from `estimate=true` API call (credits/minutes) | Adaption cost preview |

Rules:
- No bar on a comparison chart can be `reported in paper` — those become dotted reference lines instead.
- No number on stage can be `target, not yet verified`. If a number isn't reproduced or cached from a real run by demo time, it doesn't appear.
- `cached completed run` is always sourced from a verified rehearsal run, with timestamp recorded internally. Nothing is fabricated.

## 14. Remaining assumptions to validate during rehearsal

1. **The paper's Farhan & Khodra train/test split** is fully recoverable from the GitHub repo. (Confirm by hour 1.)
2. **Path B feasibility** — XLM-R Large embedding extraction on 500 train + full test set fits in <5 min on Modal A10G/T4. (Confirm by hour 4.)
3. **Adaption recipe winner** — one of `{deduplication, prompt_rephrase, both}` produces a non-trivial F1 lift on the fixed test set with the controlled baseline. (Confirm by rehearsal night.)
4. **CrossLift quality (Variant B)** — Adaption-rewritten Yelp→Indonesian rows pass language and label-preservation validation at >70% rate. (Confirm by rehearsal night.)
5. **Live probe behavior** — a 20-row targeted batch around a failure pattern produces a flip or confidence gain on the seed example >50% of the time across rehearsed examples. (Confirm by rehearsal night.)
6. **Adaption async latency** — full `run` on 500 rows completes in <3 min consistently. (Confirm during recipe testing; if not, demo always uses cached completed run.)
7. **Validation drop rate** — F4 gate keeps ≥80% of rows in the typical case. (Confirm during rehearsal.)
8. **Hate speech tab** — the label-mismatch failure mode is reproducible and visually clear within 30s. (Optional; only build if time allows.)

## 15. Demo flow (3:00)

**Pre-stage setup**
- Browser open to AdaptArxiv, demo paper manifest already loaded.
- Modal warm. Embeddings cached in Volume.
- One pre-completed Adaption run cached for the headline.
- Backup video on desktop, one keystroke away.

---

**0:00–0:25 — Hook**

> *"Six years ago, in grad school, I co-wrote this paper on Indonesian sentiment classification. We didn't have enough Indonesian data, so we hacked around it by borrowing English — Yelp reviews, multilingual models, the whole stack. That was 2020.*
>
> *Today, Adaption Labs claims they make that hack obsolete. AdaptArxiv asks the question scientifically: reproduce the paper, adapt only the training data, keep the test set fixed, show the delta. On my own paper, live."*

Show arXiv page; author name matches name badge.

---

**0:25–0:55 — Baseline**

Show paper manifest (badged `reported in paper`). Show fixed-test-set setup with the *"The Indonesian test set is never adapted"* line under the chart.

Click *Run controlled baseline*. Modal runner produces a number on the fixed test set, badged `reproduced live`. The first bar lands on the chart, labeled *"Indonesian only — same runner."*

> *"This is our controlled baseline. Same model, same split, same metric, same test set as the paper, but a faster head we can iterate on live. Paper-inspired, not bit-exact — and that's why every comparison from here uses this exact same runner."*

---

**0:55–1:35 — Adaption**

Click into the Specification panel. Show the Blueprint instruction:

> *"Generate natural Indonesian sentiment-classification training examples. Preserve the original label. Do not invent conflicting sentiment."*

Show the active recipes: `deduplication`, `prompt_rephrase`. (Reasoning traces visible in an "audit" tab.)

Click *Adapt*. While Adaption runs (or cuts to cached completed run), narrate:

> *"Only the training data changes. The test set is frozen. The runner is the same. If F1 moves, it's because of the data."*

Adaption evaluator result lands: `improvement_percent` badged `from Adaption evaluator`. Validation panel lights up: *"487 of 500 rows passed validation — language check, label preservation, no test-set leakage."*

---

**1:35–2:15 — Results**

Re-run the same runner on the validated adapted set. New bar lands on the chart, badged `reproduced live`:

- Indonesian only — `reproduced live`
- Indonesian + raw English (paper-style) — `reproduced live`
- Indonesian + Adaption-adapted Indonesian — `reproduced live`
- *(if Variant B lands)* Indonesian + Adaption Yelp→ID CrossLift — `reproduced live`
- *(dotted reference line)* Paper-reported XLM-R best — `reported in paper, different runner`

> *"Same runner across every bar. The only thing that changed is the training data. The dotted line is the paper's reported number — different runner, so I'm not pretending it's a fair comparison. The fair comparison is bar-to-bar, and that's the delta from Adaption."*

Read the actual delta out loud. Don't oversell. If CrossLift wins, lead with it. If Indonesian-only adaptation wins, lead with that.

---

**2:15–2:45 — Live probe**

> *"One more thing. Hooker says everything intelligent adapts. Not by retraining the world — by adapting around the failure. Watch."*

Hand to judge:

> *"Type a hard Indonesian review — sarcastic, code-switched, regional slang, whatever you'd expect this to fail on."*

Judge types. Show current prediction with confidence. Click *Adapt around this*.

- Adaption generates ~20 adapted rows around the failure pattern.
- Validation gate runs visibly.
- Head retrains on the small batch.
- Show after: did *this example* flip? Did confidence improve? *"Targeted adaptation, not magic."*

---

**2:45–3:00 — Close**

> *"AdaptArxiv turns 'better data' from a marketing claim into a falsifiable experiment: reproduce, adapt, test, report. Same runner, fixed test set, every number badged with where it came from.*
>
> *Code is open. The first author of the paper is me. Built solo in 7 hours on Adaption + Modal. Thank you."*

GitHub URL on screen. End.

---

## 16. Appendix: paper facts to anchor against

From Putra & Purwarianti (2020), Farhan & Khodra dataset, feature-based, averaged over seeds 1–6:

- **Table III, average F1 gain from adding English data** at N=500: ~0.176 (XLM-R), ~0.129 (mBERT). Largest gains at smallest N — exactly the regime where Adaption's per-row improvements should also dominate.
- The paper's strongest configuration is XLM-R Large feature-based + multilingual training data. mBERT consistently weaker.
- Hate speech is excluded from the demo because of the documented label-mismatch issue (Indonesian normal/abusive/hate speech vs Jigsaw normal/toxic). Optional "what doesn't work" tab only.