# AdaptArxiv Modal Runner

Deploy after creating a Modal secret named `adaptarxiv-secrets` with:

- `KAGGLE_USERNAME`
- `KAGGLE_KEY`
- `DATASET_PROSA`
- `ADAPTION_API_KEY`

Local smoke path:

```bash
modal serve modal_app/runner.py
```

Then POST to `/baseline` with:

```json
{ "fixture_mode": true }
```

Real demo paths use `/baseline` and `/adapt-id` with the default request:

```json
{
  "arxiv_id": "2009.05713",
  "model": "xlm-roberta-base",
  "split_seed": 1,
  "n_train": 500,
  "max_rows": 500
}
```
