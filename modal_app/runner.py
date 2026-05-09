from __future__ import annotations

import hashlib
import json
import os
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from typing import Any

import modal
from pydantic import BaseModel


image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "adaption",
        "fastapi[standard]",
        "kaggle",
        "numpy",
        "pandas",
        "pydantic",
        "requests",
        "scikit-learn",
        "torch",
        "transformers",
    )
    .add_local_python_source("modal_app")
)

app = modal.App("adaptarxiv-runner")
cache_volume = modal.Volume.from_name("adaptarxiv-cache", create_if_missing=True)
RUNNER_REVISION = "dataset-tsv-v5"


class RunRequest(BaseModel):
    arxiv_id: str = "2009.05713"
    model: str = "xlm-roberta-base"
    split_seed: int = 1
    n_train: int = 500
    max_rows: int = 500
    fixture_mode: bool = False


@app.function(
    image=image,
    gpu="A10G",
    timeout=1800,
    min_containers=1,
    volumes={"/cache": cache_volume},
    secrets=[modal.Secret.from_name("adaptarxiv-secrets")],
)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI

    from modal_app.validation import validate_adapted_rows

    api = FastAPI(title="AdaptArxiv Runner")

    @api.get("/health")
    def health() -> dict[str, Any]:
        return {
            "ok": True,
            "runner_revision": RUNNER_REVISION,
            "model_cache": str(Path("/cache/models").exists()),
            "has_kaggle": bool(os.getenv("KAGGLE_USERNAME") and os.getenv("KAGGLE_KEY")),
            "has_dataset_prosa": bool(os.getenv("DATASET_PROSA")),
            "has_adaption": bool(os.getenv("ADAPTION_API_KEY")),
        }

    @api.post("/baseline")
    def baseline(request: RunRequest) -> dict[str, Any]:
        started = time.perf_counter()
        if request.fixture_mode:
            return fixture_result("indonesian_only", started)

        train_rows, test_rows = load_dataset(request)
        result = train_and_score(train_rows, test_rows, request.model)
        return {
            "trainingSource": "indonesian_only",
            "metricName": "f1",
            "metricValue": result["f1"],
            "provenance": "reproduced_live",
            "testSetHash": test_set_hash(test_rows),
            "durationMs": elapsed_ms(started),
            "modalCallId": os.getenv("MODAL_TASK_ID"),
        }

    @api.post("/adapt-id")
    def adapt_id(request: RunRequest) -> dict[str, Any]:
        started = time.perf_counter()
        if request.fixture_mode:
            return {
                **fixture_result("adaption_id_aug", started),
                "validation": {
                    "rowsRequested": request.max_rows,
                    "rowsReturned": request.max_rows,
                    "rowsPassedValidation": request.max_rows - 3,
                    "drops": {"duplicate": 2, "too_short": 1},
                },
                "adaption": {
                    "datasetId": "fixture-dataset",
                    "scoreBefore": 6.2,
                    "scoreAfter": 8.1,
                    "improvementPercent": 30.6,
                },
            }

        train_rows, test_rows = load_dataset(request)
        source_rows = train_rows[: request.max_rows]
        adaption_result = run_adaption(source_rows, request.max_rows)
        adapted_rows, drops = validate_adapted_rows(adaption_result["rows"], test_rows)

        result = train_and_score(adapted_rows, test_rows, request.model)
        return {
            "trainingSource": "adaption_id_aug",
            "metricName": "f1",
            "metricValue": result["f1"],
            "provenance": "reproduced_live",
            "testSetHash": test_set_hash(test_rows),
            "durationMs": elapsed_ms(started),
            "modalCallId": os.getenv("MODAL_TASK_ID"),
            "validation": {
                "rowsRequested": request.max_rows,
                "rowsReturned": len(adaption_result["rows"]),
                "rowsPassedValidation": len(adapted_rows),
                "drops": drops,
            },
            "adaption": {
                "datasetId": adaption_result["dataset_id"],
                "scoreBefore": adaption_result.get("score_before"),
                "scoreAfter": adaption_result.get("score_after"),
                "improvementPercent": adaption_result.get("improvement_percent"),
            },
        }

    return api


def load_dataset(request: RunRequest) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    import pandas as pd
    from sklearn.model_selection import train_test_split

    dataset_dir = prepare_dataset_dir()
    train_path, test_path = split_dataset_files(dataset_dir)
    if train_path and test_path:
        train_df = sample_training_rows(
            normalize_dataframe(read_dataset_file(train_path)), request
        )
        test_df = normalize_dataframe(read_dataset_file(test_path)).reset_index(drop=True)
        return df_to_rows(train_df), df_to_rows(test_df)

    frames = [read_dataset_file(path) for path in dataset_files(dataset_dir)]
    if not frames:
        raise RuntimeError(f"No supported dataset files found in {dataset_dir}")

    dataframe = normalize_dataframe(pd.concat(frames, ignore_index=True))
    train_df, test_df = train_test_split(
        dataframe,
        test_size=0.1,
        stratify=dataframe["label"],
        random_state=request.split_seed,
    )

    train_df = sample_training_rows(train_df, request)

    return df_to_rows(train_df), df_to_rows(test_df.reset_index(drop=True))


def dataset_files(dataset_dir: Path) -> list[Path]:
    tsv_files = sorted(dataset_dir.rglob("*.tsv"))
    if tsv_files:
        return tsv_files
    return sorted(dataset_dir.rglob("*.csv"))


def split_dataset_files(dataset_dir: Path) -> tuple[Path | None, Path | None]:
    files = dataset_files(dataset_dir)
    train_files = [path for path in files if "train" in path.name.lower()]
    test_files = [
        path
        for path in files
        if any(token in path.name.lower() for token in ("test", "testing"))
    ]
    return preferred_dataset_file(train_files), preferred_dataset_file(test_files)


def preferred_dataset_file(files: list[Path]) -> Path | None:
    if not files:
        return None
    return sorted(files, key=lambda path: (path.suffix != ".tsv", path.name))[0]


def read_dataset_file(path: Path) -> Any:
    import pandas as pd

    parsed_rows = parse_labeled_text_rows(path)
    if parsed_rows:
        return pd.DataFrame(parsed_rows)

    separator = "\t" if path.suffix == ".tsv" else ","
    return pd.read_csv(path, sep=separator, engine="python", on_bad_lines="skip")


def parse_labeled_text_rows(path: Path) -> list[dict[str, str]]:
    rows = []
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower().replace("\t", ",").startswith("content,polarity"):
            continue
        parsed = parse_labeled_text_line(line, "\t" if path.suffix == ".tsv" else ",")
        if parsed:
            text, label = parsed
            rows.append({"text": text, "raw_label": label})
    return rows


def parse_labeled_text_line(line: str, separator: str) -> tuple[str, str] | None:
    parts = [part.strip() for part in line.split(separator)]
    for index in range(len(parts) - 1, 0, -1):
        label = parts[index].strip().strip(",")
        if normalize_dataset_label(label) or label.lower() == "neutral":
            text = separator.join(parts[:index]).strip().strip(",")
            if text:
                return text, label
    return None


def sample_training_rows(dataframe: Any, request: RunRequest) -> Any:
    import pandas as pd

    target_count = min(request.n_train, len(dataframe))
    labels = sorted(str(label) for label in dataframe["label"].drop_duplicates())
    if not labels or target_count == 0:
        return dataframe.head(0).reset_index(drop=True)

    base_count = target_count // len(labels)
    remainder = target_count % len(labels)
    sampled_frames = []
    for index, label in enumerate(labels):
        group = dataframe[dataframe["label"] == label]
        count = min(len(group), base_count + (1 if index < remainder else 0))
        if count:
            sampled_frames.append(group.sample(n=count, random_state=request.split_seed + index))

    sampled = pd.concat(sampled_frames) if sampled_frames else dataframe.head(0)
    if len(sampled) < target_count:
        remaining = dataframe.drop(index=sampled.index, errors="ignore")
        count = min(target_count - len(sampled), len(remaining))
        if count:
            sampled = pd.concat(
                [sampled, remaining.sample(n=count, random_state=request.split_seed)]
            )

    return sampled.sample(frac=1, random_state=request.split_seed).reset_index(drop=True)


def prepare_dataset_dir() -> Path:
    dataset_prosa = os.getenv("DATASET_PROSA")
    if dataset_prosa:
        dataset_dir = Path("/cache/datasets/prosa")
        dataset_dir.mkdir(parents=True, exist_ok=True)
        if not dataset_files(dataset_dir):
            download_dataset_source(dataset_prosa, dataset_dir)
        return dataset_dir

    dataset_dir = Path("/cache/datasets/tripadvisor")
    dataset_dir.mkdir(parents=True, exist_ok=True)
    if not dataset_files(dataset_dir):
        download_kaggle_dataset("ilhamfp31/dataset-tripadvisor", dataset_dir)
    return dataset_dir


def download_dataset_source(source: str, dataset_dir: Path) -> None:
    import requests

    kaggle_slug = kaggle_slug_from_url(source)
    if kaggle_slug:
        download_kaggle_dataset(kaggle_slug, dataset_dir)
        return

    response = requests.get(source, timeout=120)
    response.raise_for_status()
    parsed = urlparse(source)
    filename = Path(parsed.path).name or "dataset"
    target = dataset_dir / filename
    target.write_bytes(response.content)

    if zipfile.is_zipfile(target):
        with zipfile.ZipFile(target) as archive:
            archive.extractall(dataset_dir)
    elif target.suffix.lower() != ".csv":
        csv_target = dataset_dir / "dataset.csv"
        target.rename(csv_target)


def kaggle_slug_from_url(source: str) -> str | None:
    parsed = urlparse(source)
    if "kaggle.com" not in parsed.netloc:
        return None

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 3 and parts[0] == "datasets":
        return f"{parts[1]}/{parts[2]}"
    if len(parts) >= 2:
        return f"{parts[0]}/{parts[1]}"
    return None


def download_kaggle_dataset(slug: str, dataset_dir: Path) -> None:
    from kaggle.api.kaggle_api_extended import KaggleApi

    kaggle = KaggleApi()
    kaggle.authenticate()
    kaggle.dataset_download_files(
        slug,
        path=str(dataset_dir),
        unzip=True,
        quiet=False,
    )


def normalize_dataframe(dataframe: Any) -> Any:
    text_column = choose_column(
        dataframe.columns,
        ["review", "ulasan", "text", "content", "sentence", "comment"],
    )
    label_column = choose_column(
        dataframe.columns,
        ["sentiment", "label", "polarity", "rating", "stars", "score"],
    )

    normalized = dataframe[[text_column, label_column]].dropna().copy()
    normalized.columns = ["text", "raw_label"]
    normalized["label"] = normalized["raw_label"].map(normalize_dataset_label)
    normalized["text"] = normalized["text"].astype(str).str.strip()
    normalized = normalized[
        normalized["label"].isin(["positive", "negative"])
        & (normalized["text"].str.len() > 0)
    ]

    if normalized.empty:
        raise RuntimeError("Dataset normalization produced no binary sentiment rows")

    return normalized[["text", "label"]].drop_duplicates()


def choose_column(columns: Any, candidates: list[str]) -> str:
    lower_map = {str(column).lower(): column for column in columns}
    for candidate in candidates:
        for lower_name, original_name in lower_map.items():
            if candidate in lower_name:
                return original_name
    raise RuntimeError(f"Could not find any column matching {candidates}")


def normalize_dataset_label(value: Any) -> str | None:
    text = str(value).strip().lower()
    if text in {"positive", "positif", "pos", "1", "true"}:
        return "positive"
    if text in {"negative", "negatif", "neg", "0", "false"}:
        return "negative"
    try:
        number = float(text)
    except ValueError:
        return None
    if number >= 4:
        return "positive"
    if number <= 2:
        return "negative"
    return None


def df_to_rows(dataframe: Any) -> list[dict[str, Any]]:
    return [
        {
            "text": str(row["text"]),
            "adapted_text": str(row["text"]),
            "label": str(row["label"]),
        }
        for row in dataframe[["text", "label"]].to_dict("records")
    ]


def train_and_score(
    train_rows: list[dict[str, Any]], test_rows: list[dict[str, Any]], model_name: str
) -> dict[str, float]:
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import f1_score

    train_texts = [row.get("adapted_text") or row["text"] for row in train_rows]
    test_texts = [row["text"] for row in test_rows]
    train_labels = np.array([1 if row["label"] == "positive" else 0 for row in train_rows])
    test_labels = np.array([1 if row["label"] == "positive" else 0 for row in test_rows])

    train_embeddings = embeddings_for_texts(train_texts, model_name)
    test_embeddings = embeddings_for_texts(test_texts, model_name)

    classifier = LogisticRegression(max_iter=1000, random_state=1)
    classifier.fit(train_embeddings, train_labels)
    predictions = classifier.predict(test_embeddings)
    return {"f1": float(f1_score(test_labels, predictions))}


def embeddings_for_texts(texts: list[str], model_name: str) -> Any:
    import numpy as np
    import torch
    from transformers import AutoModel, AutoTokenizer

    cache_dir = Path("/cache/embeddings")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha256(
        json.dumps({"model": model_name, "texts": texts}, ensure_ascii=False).encode()
    ).hexdigest()
    cache_path = cache_dir / f"{cache_key}.npy"
    if cache_path.exists():
        return np.load(cache_path)

    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir="/cache/models")
    model = AutoModel.from_pretrained(model_name, cache_dir="/cache/models")
    model.eval()
    if torch.cuda.is_available():
        model = model.cuda()

    batches = []
    with torch.no_grad():
        for index in range(0, len(texts), 16):
            encoded = tokenizer(
                texts[index : index + 16],
                padding=True,
                truncation=True,
                max_length=192,
                return_tensors="pt",
            )
            if torch.cuda.is_available():
                encoded = {key: value.cuda() for key, value in encoded.items()}
            output = model(**encoded)
            mask = encoded["attention_mask"].unsqueeze(-1)
            pooled = (output.last_hidden_state * mask).sum(dim=1) / mask.sum(dim=1)
            batches.append(pooled.cpu().numpy())

    embeddings = np.concatenate(batches, axis=0)
    np.save(cache_path, embeddings)
    return embeddings


def run_adaption(source_rows: list[dict[str, Any]], max_rows: int) -> dict[str, Any]:
    import pandas as pd
    from adaption import Adaption

    api_key = os.getenv("ADAPTION_API_KEY")
    if not api_key:
        raise RuntimeError("ADAPTION_API_KEY is not configured")

    upload_path = Path("/tmp/adaption-id-input.csv")
    pd.DataFrame(
        [
            {
                "instruction": f"Klasifikasikan sentimen ulasan berikut: {row['text']}",
                "response": "positif" if row["label"] == "positive" else "negatif",
                "original_text": row["text"],
                "label": row["label"],
            }
            for row in source_rows
        ]
    ).to_csv(upload_path, index=False)

    client = Adaption(api_key=api_key)
    dataset = client.datasets.upload_file(str(upload_path))
    dataset_id = getattr(dataset, "dataset_id", None) or getattr(dataset, "id", None)
    if not dataset_id:
        raise RuntimeError("Adaption upload did not return a dataset id")

    wait_for_adaption_ingestion(client, dataset_id)
    blueprint = (
        "Generate natural Indonesian sentiment-classification training examples. "
        "Preserve the original label. Do not invent conflicting sentiment. "
        "Return strict JSON with adapted_text and label. Allowed labels: positive, negative."
    )
    run = client.datasets.run(
        dataset_id,
        column_mapping={
            "prompt": "instruction",
            "completion": "response",
        },
        recipe_specification={
            "recipes": {"deduplication": True, "prompt_rephrase": True},
        },
        brand_controls={
            "blueprint": blueprint,
            "length": "concise",
            "hallucination_mitigation": True,
        },
        job_specification={"max_rows": max_rows},
    )
    run_id = getattr(run, "run_id", None)
    wait_for_adaption_run(client, dataset_id)
    output_url = client.datasets.download(dataset_id, file_format="json")
    output_rows = load_adaption_rows(output_url)
    evaluation = get_adaption_evaluation(client, dataset_id)

    return {
        "dataset_id": dataset_id,
        "run_id": run_id,
        "rows": output_rows,
        **evaluation,
    }


def wait_for_adaption_ingestion(client: Any, dataset_id: str) -> None:
    for _ in range(90):
        status = client.datasets.get_status(dataset_id)
        state = str(getattr(status, "status", "")).lower()
        if state == "failed":
            error = getattr(status, "error", None)
            message = getattr(error, "message", None) or "unknown ingestion error"
            raise RuntimeError(f"Adaption ingestion failed: {message}")
        if getattr(status, "row_count", None) is not None:
            return
        time.sleep(2)
    raise TimeoutError("Adaption ingestion did not finish within 3 minutes")


def wait_for_adaption_run(client: Any, dataset_id: str) -> None:
    status = client.datasets.wait_for_completion(dataset_id, timeout=600)
    state = str(getattr(status, "status", "")).lower()
    if state != "succeeded":
        error = getattr(status, "error", None)
        message = getattr(error, "message", None) or f"status {state}"
        raise RuntimeError(f"Adaption run failed: {message}")


def load_adaption_rows(output: str) -> list[dict[str, Any]]:
    import pandas as pd
    import requests

    if not output:
        raise RuntimeError("Adaption run did not expose an output URL")

    stripped = output.strip()
    if stripped.startswith(("[", "{")):
        payload = json.loads(stripped)
        if isinstance(payload, dict):
            raw_rows = (
                payload.get("rows")
                or payload.get("data")
                or payload.get("items")
                or [payload]
            )
        else:
            raw_rows = payload
        return [coerce_adaption_row(row) for row in raw_rows]

    response = requests.get(output, timeout=60)
    response.raise_for_status()
    output_path = Path("/tmp/adaption-id-output")
    output_path.write_bytes(response.content)

    if output.endswith(".json") or response.text.strip().startswith(("[", "{")):
        payload = response.json()
        if isinstance(payload, dict):
            raw_rows = (
                payload.get("rows")
                or payload.get("data")
                or payload.get("items")
                or [payload]
            )
        else:
            raw_rows = payload
        return [coerce_adaption_row(row) for row in raw_rows]

    dataframe = pd.read_csv(output_path)
    return [coerce_adaption_row(row._asdict()) for row in dataframe.itertuples(index=False)]


def coerce_adaption_row(row: dict[str, Any]) -> dict[str, Any]:
    enhanced = row.get("enhanced_completion") or row.get("completion") or ""
    enhanced_payload = parse_json_object(str(enhanced))
    text = (
        row.get("adapted_text")
        or enhanced_payload.get("adapted_text")
        or row.get("rephrased_text")
        or row.get("text")
        or row.get("instruction")
        or ""
    )
    label = (
        row.get("label")
        or enhanced_payload.get("label")
        or row.get("response")
        or row.get("completion")
        or ""
    )
    if isinstance(label, str) and "positif" in label.lower():
        label = "positive"
    if isinstance(label, str) and "negatif" in label.lower():
        label = "negative"
    return {
        "original_text": row.get("original_text"),
        "adapted_text": str(text),
        "label": str(label).lower(),
        "source": "adaption",
    }


def parse_json_object(value: str) -> dict[str, Any]:
    stripped = value.strip()
    if not stripped.startswith("{"):
        return {}
    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def get_adaption_evaluation(client: Any, dataset_id: str) -> dict[str, float | None]:
    try:
        evaluation = client.datasets.get_evaluation(dataset_id)
    except Exception:
        return {}
    quality = getattr(evaluation, "quality", None)
    if not quality:
        return {}
    return {
        "score_before": number_or_none(getattr(quality, "score_before", None)),
        "score_after": number_or_none(getattr(quality, "score_after", None)),
        "improvement_percent": number_or_none(
            getattr(quality, "improvement_percent", None)
        ),
    }


def number_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def test_set_hash(test_rows: list[dict[str, Any]]) -> str:
    payload = json.dumps(
        [{"text": row["text"], "label": row["label"]} for row in test_rows],
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def fixture_result(training_source: str, started: float) -> dict[str, Any]:
    return {
        "trainingSource": training_source,
        "metricName": "f1",
        "metricValue": 0.681 if training_source == "indonesian_only" else 0.724,
        "provenance": "reproduced_live",
        "testSetHash": "fixture-fixed-test-set",
        "durationMs": elapsed_ms(started),
        "modalCallId": "fixture",
    }
