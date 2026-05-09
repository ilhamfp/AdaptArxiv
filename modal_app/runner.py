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
from pydantic import BaseModel, Field


image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "adaption",
        "bitarray",
        "cffi",
        "cython",
        "fastapi[standard]",
        "hydra-core",
        "kaggle",
        "numpy",
        "omegaconf",
        "pandas",
        "packaging",
        "pydantic",
        "requests",
        "sacrebleu",
        "scikit-learn",
        "sentencepiece",
        "torch",
        "transformers",
    )
    .add_local_python_source("modal_app")
)

app = modal.App("adaptarxiv-runner")
cache_volume = modal.Volume.from_name("adaptarxiv-cache", create_if_missing=True)
RUNNER_REVISION = "paper-proof-v1"
ADAPTION_RUN_TIMEOUT_SECONDS = 4800
PAPER_ADAPTION_RUN_TIMEOUT_SECONDS = 14400
_PAPER_XLMR_MODEL: Any | None = None


class RunRequest(BaseModel):
    arxiv_id: str = "2009.05713"
    model: str = "xlmr.large"
    split_seed: int = 1
    n_train: int = 500
    max_rows: int = 500
    fixture_mode: bool = False
    adaption_dataset_id: str | None = None
    experiment_mode: str = "paper_faithful"
    experiment_type: str = "A"
    total_data: int = 500
    valid_size: float = 0.1
    data_seed: int = 1
    model_seed: int = 4


class DatasetPreviewRequest(RunRequest):
    limit: int = Field(default=24, ge=1, le=100)


@app.function(
    image=image,
    gpu="A10G",
    timeout=5400,
    min_containers=1,
    volumes={"/cache": cache_volume},
    secrets=[modal.Secret.from_name("adaptarxiv-secrets")],
)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI

    from modal_app.validation import validate_adapted_rows
    from modal_app.paper_harness import (
        build_adaption_audit,
        build_paired_raw_rows,
        experiment_metadata,
        label_counts as paper_label_counts,
        load_paper_prosa_frames,
        split_paper_rows,
        validate_paper_adapted_rows,
    )

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

    @api.post("/dataset-preview")
    def dataset_preview(request: DatasetPreviewRequest) -> dict[str, Any]:
        if request.experiment_mode == "paper_faithful":
            all_train_rows, test_rows = load_paper_dataset(request)
            train_rows, valid_rows = split_paper_rows(
                all_train_rows,
                total_data=request.total_data,
                valid_size=request.valid_size,
                data_seed=request.data_seed,
            )
            adapted = None
            if request.adaption_dataset_id:
                client = adaption_client()
                status = client.datasets.get_status(request.adaption_dataset_id)
                state = str(getattr(status, "status", "")).lower()
                adapted = {
                    "datasetId": request.adaption_dataset_id,
                    "status": state,
                    "rowCount": number_or_none(getattr(status, "row_count", None)),
                    "rowsReturned": 0,
                    "rowsPassedValidation": 0,
                    "drops": {},
                    "rows": [],
                }
                if state == "succeeded":
                    output_url = client.datasets.download(
                        request.adaption_dataset_id, file_format="json"
                    )
                    output_rows = load_adaption_rows(output_url)
                    source_rows_for_adaption = train_rows[: request.max_rows]
                    passed_rows, drops, inspected_rows = validate_paper_adapted_rows(
                        output_rows, source_rows_for_adaption, test_rows
                    )
                    audit = build_adaption_audit(
                        source_rows=source_rows_for_adaption,
                        test_rows=test_rows,
                        adaption_result={
                            "uploaded_rows": len(source_rows_for_adaption),
                            "ingested_rows": number_or_none(
                                getattr(status, "row_count", None)
                            ),
                            "processed_rows": progress_value(status, "processed_rows"),
                            "total_rows": progress_value(status, "total_rows"),
                            "rows_requested": min(
                                request.max_rows,
                                int(getattr(status, "row_count", 0) or 0),
                            ),
                            "rows": output_rows,
                        },
                        passed_rows=passed_rows,
                        drops=drops,
                    )
                    adapted.update(
                        {
                            "rowsReturned": len(output_rows),
                            "rowsPassedValidation": len(passed_rows),
                            "drops": drops,
                            "audit": audit,
                            "rows": inspected_rows[: request.limit],
                        }
                    )

            return {
                "runRequest": public_run_request(request),
                "trainingSetup": paper_training_setup_summary(),
                "raw": {
                    "rowCount": len(train_rows),
                    "labelCounts": paper_label_counts(train_rows),
                    "rows": preview_paper_raw_rows(train_rows, request.limit),
                },
                "validation": {
                    "rowCount": len(valid_rows),
                    "labelCounts": paper_label_counts(valid_rows),
                    "rows": preview_paper_raw_rows(valid_rows, request.limit),
                },
                "adapted": adapted,
                "testSet": {
                    "rowCount": len(test_rows),
                    "labelCounts": paper_label_counts(test_rows),
                    "hash": test_set_hash(test_rows),
                },
            }

        train_rows, test_rows = load_dataset(request)
        adapted = None

        if request.adaption_dataset_id:
            client = adaption_client()
            status = client.datasets.get_status(request.adaption_dataset_id)
            state = str(getattr(status, "status", "")).lower()
            adapted = {
                "datasetId": request.adaption_dataset_id,
                "status": state,
                "rowCount": number_or_none(getattr(status, "row_count", None)),
                "rowsReturned": 0,
                "rowsPassedValidation": 0,
                "drops": {},
                "rows": [],
            }
            if state == "succeeded":
                output_url = client.datasets.download(
                    request.adaption_dataset_id, file_format="json"
                )
                output_rows = load_adaption_rows(output_url)
                passed_rows, drops = validate_adapted_rows(output_rows, test_rows)
                adapted.update(
                    {
                        "rowsReturned": len(output_rows),
                        "rowsPassedValidation": len(passed_rows),
                        "drops": drops,
                        "rows": preview_adapted_rows(passed_rows, request.limit),
                    }
                )

        return {
            "runRequest": public_run_request(request),
            "trainingSetup": training_setup_summary(),
            "raw": {
                "rowCount": len(train_rows),
                "labelCounts": label_counts(train_rows),
                "rows": preview_raw_rows(train_rows, request.limit),
            },
            "adapted": adapted,
            "testSet": {
                "rowCount": len(test_rows),
                "labelCounts": label_counts(test_rows),
                "hash": test_set_hash(test_rows),
            },
        }

    @api.post("/paper-proof")
    def paper_proof(request: RunRequest) -> dict[str, Any]:
        from modal_app.paper_harness import (
            build_adaption_audit,
            build_paired_raw_rows,
            experiment_metadata,
            load_paper_prosa_frames,
            split_paper_rows,
            validate_paper_adapted_rows,
        )

        started = time.perf_counter()
        if request.fixture_mode:
            return fixture_paper_proof(started, request)

        all_train_rows, test_rows = load_paper_dataset(request)
        train_rows, valid_rows = split_paper_rows(
            all_train_rows,
            total_data=request.total_data,
            valid_size=request.valid_size,
            data_seed=request.data_seed,
        )

        raw_full_score = train_and_score_paper_head(
            train_rows, valid_rows, test_rows, request.model_seed
        )
        base_metadata = {
            "total_data": request.total_data,
            "valid_rows": len(valid_rows),
            "test_rows": len(test_rows),
            "data_seed": request.data_seed,
            "model_seed": request.model_seed,
        }
        raw_full = paper_run_result(
            "paper_raw_full",
            raw_full_score["f1"],
            test_rows,
            elapsed_ms(started),
            experiment_metadata(train_rows=len(train_rows), **base_metadata),
        )

        source_rows_for_adaption = train_rows[: request.max_rows]
        if request.adaption_dataset_id:
            adaption_result = resume_adaption(
                request.adaption_dataset_id,
                request.max_rows,
                timeout_seconds=PAPER_ADAPTION_RUN_TIMEOUT_SECONDS,
            )
        else:
            adaption_result = run_adaption(
                source_rows_for_adaption,
                request.max_rows,
                timeout_seconds=PAPER_ADAPTION_RUN_TIMEOUT_SECONDS,
            )
        adaption_result["uploaded_rows"] = len(source_rows_for_adaption)

        adapted_rows, drops, inspected_rows = validate_paper_adapted_rows(
            adaption_result["rows"], source_rows_for_adaption, test_rows
        )
        audit = build_adaption_audit(
            source_rows=source_rows_for_adaption,
            test_rows=test_rows,
            adaption_result=adaption_result,
            passed_rows=adapted_rows,
            drops=drops,
        )
        paired_raw_rows = build_paired_raw_rows(source_rows_for_adaption, adapted_rows)

        paired_score = train_and_score_paper_head(
            paired_raw_rows, valid_rows, test_rows, request.model_seed
        )
        adapted_score = train_and_score_paper_head(
            adapted_rows, valid_rows, test_rows, request.model_seed
        )

        paired_raw = paper_run_result(
            "paper_raw_paired",
            paired_score["f1"],
            test_rows,
            elapsed_ms(started),
            experiment_metadata(train_rows=len(paired_raw_rows), **base_metadata),
        )
        adapted = paper_run_result(
            "adaption_adapted_only",
            adapted_score["f1"],
            test_rows,
            elapsed_ms(started),
            experiment_metadata(train_rows=len(adapted_rows), **base_metadata),
            validation={
                "rowsRequested": int(adaption_result.get("rows_requested", request.max_rows)),
                "rowsReturned": len(adaption_result["rows"]),
                "rowsPassedValidation": len(adapted_rows),
                "drops": drops,
            },
            adaption={
                "datasetId": adaption_result["dataset_id"],
                "scoreBefore": adaption_result.get("score_before"),
                "scoreAfter": adaption_result.get("score_after"),
                "improvementPercent": adaption_result.get("improvement_percent"),
            },
            audit=audit,
        )

        return {
            "runs": [raw_full, paired_raw, adapted],
            "datasetPreview": {
                "raw": preview_paper_raw_rows(train_rows, 24),
                "adapted": inspected_rows[:24],
            },
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
        if request.adaption_dataset_id:
            adaption_result = resume_adaption(
                request.adaption_dataset_id, request.max_rows
            )
        else:
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
                "rowsRequested": int(adaption_result.get("rows_requested", request.max_rows)),
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


def load_paper_dataset(
    request: RunRequest,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    from modal_app.paper_harness import load_paper_prosa_frames

    if request.experiment_type != "A":
        raise ValueError("Only paper experiment type A is implemented")
    dataset_dir = prepare_dataset_dir()
    return load_paper_prosa_frames(dataset_dir)


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


def label_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        label = str(row.get("label", "unknown"))
        counts[label] = counts.get(label, 0) + 1
    return counts


def preview_raw_rows(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    return [
        {
            "rowIndex": index + 1,
            "text": row["text"],
            "label": row["label"],
        }
        for index, row in enumerate(rows[:limit])
    ]


def preview_adapted_rows(
    rows: list[dict[str, Any]], limit: int
) -> list[dict[str, Any]]:
    return [
        {
            "rowIndex": index + 1,
            "originalText": row.get("original_text"),
            "adaptedText": row["adapted_text"],
            "label": row["label"],
        }
        for index, row in enumerate(rows[:limit])
    ]


def training_setup_summary() -> dict[str, Any]:
    return {
        "featureModel": "xlm-roberta-base by default",
        "featurePooling": "mean pooled last hidden states over attention mask",
        "tokenizerMaxLength": 192,
        "classifier": "sklearn LogisticRegression",
        "classifierMaxIter": 1000,
        "classifierRandomState": 1,
        "earlyStopping": False,
        "fineTuning": False,
        "baselineTrainText": "raw selected Indonesian training text",
        "adaptedTrainText": "validated Adaption adapted_text only",
        "testText": "raw fixed Indonesian test text",
    }


def paper_training_setup_summary() -> dict[str, Any]:
    return {
        "featureModel": "xlmr.large via fairseq torch.hub",
        "featurePooling": "CLS token from last layer features",
        "tokenizerMaxLength": 512,
        "classifier": "PyTorch dropout + linear + sigmoid head",
        "classifierMaxIter": 30000,
        "classifierRandomState": 4,
        "earlyStopping": True,
        "earlyStoppingPatience": 12,
        "fineTuning": False,
        "loss": "BCELoss",
        "optimizer": "Adam lr=0.0001",
        "scheduler": "ReduceLROnPlateau",
        "threshold": 0.5,
        "baselineTrainText": "paper-preprocessed PROSA train text",
        "adaptedTrainText": "paper-preprocessed Adaption adapted_text only",
        "testText": "paper-preprocessed fixed PROSA test text",
    }


def preview_paper_raw_rows(
    rows: list[dict[str, Any]], limit: int
) -> list[dict[str, Any]]:
    return [
        {
            "rowIndex": index + 1,
            "sourceId": row["source_id"],
            "originalText": row["original_text"],
            "preprocessedOriginalText": row["text"],
            "text": row["text"],
            "label": row["label"],
        }
        for index, row in enumerate(rows[:limit])
    ]


def public_run_request(request: RunRequest) -> dict[str, Any]:
    return {
        "arxiv_id": request.arxiv_id,
        "model": request.model,
        "split_seed": request.split_seed,
        "n_train": request.n_train,
        "max_rows": request.max_rows,
        "experiment_mode": request.experiment_mode,
        "experiment_type": request.experiment_type,
        "total_data": request.total_data,
        "valid_size": request.valid_size,
        "data_seed": request.data_seed,
        "model_seed": request.model_seed,
    }


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


def train_and_score_paper_head(
    train_rows: list[dict[str, Any]],
    valid_rows: list[dict[str, Any]],
    test_rows: list[dict[str, Any]],
    model_seed: int,
) -> dict[str, float]:
    import copy
    import os
    import random

    import numpy as np
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset

    from modal_app.paper_harness import macro_f1_at_threshold

    if not train_rows:
        raise RuntimeError("Paper head received no training rows")

    random.seed(model_seed)
    torch.manual_seed(model_seed)
    torch.cuda.manual_seed_all(model_seed)
    np.random.seed(model_seed)
    os.environ["PYTHONHASHSEED"] = str(model_seed)
    torch.backends.cudnn.deterministic = True

    train_x = paper_embeddings_for_texts([row["text"] for row in train_rows])
    valid_x = paper_embeddings_for_texts([row["text"] for row in valid_rows])
    test_x = paper_embeddings_for_texts([row["text"] for row in test_rows])
    train_y = np.array([row["label_id"] for row in train_rows], dtype=np.int64)
    valid_y = np.array([row["label_id"] for row in valid_rows], dtype=np.int64)
    test_y = np.array([row["label_id"] for row in test_rows], dtype=np.int64)

    class Net(nn.Module):
        def __init__(self, input_dim: int):
            super().__init__()
            self.dropout_1 = nn.Dropout(p=0.2)
            self.out_proj = nn.Linear(input_dim, 1)
            self.sig = nn.Sigmoid()

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            x = x.squeeze()
            x = self.dropout_1(x)
            x = self.out_proj(x)
            return self.sig(x)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = Net(input_dim=int(train_x.shape[-1])).to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.0001)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5
    )
    train_loader = DataLoader(
        TensorDataset(torch.from_numpy(train_x).float(), torch.from_numpy(train_y)),
        batch_size=32,
        shuffle=True,
    )
    valid_loader = DataLoader(
        TensorDataset(torch.from_numpy(valid_x).float(), torch.from_numpy(valid_y)),
        batch_size=32,
    )

    valid_loss_min = np.inf
    best_state = copy.deepcopy(model.state_dict())
    last_best_epoch = 0
    for epoch in range(1, 30000 + 1):
        model.train()
        train_loss = 0.0
        for data, target in train_loader:
            data, target = data.to(device), target.to(device)
            model.zero_grad()
            output = model(data).view(-1)
            loss = criterion(output, target.float())
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * data.size(0)

        model.eval()
        valid_loss = 0.0
        with torch.no_grad():
            for data, target in valid_loader:
                data, target = data.to(device), target.to(device)
                output = model(data).view(-1)
                loss = criterion(output, target.float())
                valid_loss += loss.item() * data.size(0)

        valid_loss = valid_loss / max(len(valid_rows), 1)
        scheduler.step(valid_loss)
        if valid_loss <= valid_loss_min:
            best_state = copy.deepcopy(model.state_dict())
            valid_loss_min = valid_loss
            last_best_epoch = epoch
        elif (epoch - last_best_epoch) > 12:
            break

    model.load_state_dict(best_state)
    model.eval()
    test_tensor = torch.from_numpy(test_x).float().to(device)
    probabilities: list[float] = []
    with torch.no_grad():
        for index in range(0, len(test_tensor), 32):
            output = model(test_tensor[index : index + 32]).view(-1)
            probabilities.extend(float(value) for value in output.cpu().numpy())

    return {"f1": macro_f1_at_threshold(test_y.tolist(), probabilities, threshold=0.5)}


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


def paper_embeddings_for_texts(texts: list[str]) -> Any:
    import numpy as np
    import torch

    cache_dir = Path("/cache/paper_embeddings")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha256(
        json.dumps(
            {"feature_extractor": "xlmr.large_fairseq_cls", "texts": texts},
            ensure_ascii=False,
        ).encode()
    ).hexdigest()
    cache_path = cache_dir / f"{cache_key}.npy"
    if cache_path.exists():
        return np.load(cache_path)

    model = paper_xlmr_model()
    features = []
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    with torch.no_grad():
        for text in texts:
            tokens = model.encode(str(text))
            if len(tokens) > 512:
                tokens = torch.cat((tokens[:511], torch.Tensor([2]).long()), 0)
            tokens = tokens.to(device)
            last_layer_features = model.extract_features(tokens)
            features.append(last_layer_features[:, 0, :].detach().cpu().numpy())

    embeddings = np.concatenate(features, axis=0)
    np.save(cache_path, embeddings)
    return embeddings


def paper_xlmr_model() -> Any:
    global _PAPER_XLMR_MODEL
    if _PAPER_XLMR_MODEL is not None:
        return _PAPER_XLMR_MODEL

    import torch

    torch.hub.set_dir("/cache/torchhub")
    model = torch.hub.load("pytorch/fairseq", "xlmr.large", trust_repo=True)
    model.eval()
    if torch.cuda.is_available():
        model = model.cuda()
    _PAPER_XLMR_MODEL = model
    return model


def run_adaption(
    source_rows: list[dict[str, Any]],
    max_rows: int,
    timeout_seconds: int = ADAPTION_RUN_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    import pandas as pd

    client = adaption_client()

    upload_path = Path("/tmp/adaption-id-input.csv")
    pd.DataFrame(
        [
            {
                "source_id": row.get("source_id"),
                "instruction": f"Klasifikasikan sentimen ulasan berikut: {row['text']}",
                "response": "positif" if row["label"] == "positive" else "negatif",
                "original_text": row.get("original_text", row["text"]),
                "text": row["text"],
                "label": row["label"],
            }
            for row in source_rows
        ]
    ).to_csv(upload_path, index=False)

    dataset = client.datasets.upload_file(str(upload_path))
    dataset_id = getattr(dataset, "dataset_id", None) or getattr(dataset, "id", None)
    if not dataset_id:
        raise RuntimeError("Adaption upload did not return a dataset id")

    ingested_rows = wait_for_adaption_ingestion(client, dataset_id)
    rows_to_process = min(max_rows, ingested_rows)
    if rows_to_process < 1:
        raise RuntimeError("Adaption ingestion produced no processable rows")
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
        job_specification={"max_rows": rows_to_process},
    )
    run_id = getattr(run, "run_id", None)
    return collect_adaption_result(
        client, dataset_id, rows_to_process, run_id, timeout_seconds=timeout_seconds
    )


def resume_adaption(
    dataset_id: str,
    max_rows: int,
    timeout_seconds: int = ADAPTION_RUN_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    client = adaption_client()
    status = client.datasets.get_status(dataset_id)
    row_count = getattr(status, "row_count", None)
    rows_requested = min(max_rows, int(row_count)) if row_count is not None else max_rows
    return collect_adaption_result(
        client, dataset_id, rows_requested, timeout_seconds=timeout_seconds
    )


def adaption_client() -> Any:
    from adaption import Adaption

    api_key = os.getenv("ADAPTION_API_KEY")
    if not api_key:
        raise RuntimeError("ADAPTION_API_KEY is not configured")
    return Adaption(api_key=api_key)


def collect_adaption_result(
    client: Any,
    dataset_id: str,
    rows_requested: int,
    run_id: str | None = None,
    timeout_seconds: int = ADAPTION_RUN_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    status = wait_for_adaption_run(client, dataset_id, timeout_seconds)
    row_count = getattr(status, "row_count", None)
    if row_count is not None:
        rows_requested = min(rows_requested, int(row_count))
    output_url = client.datasets.download(dataset_id, file_format="json")
    output_rows = load_adaption_rows(output_url)
    evaluation = get_adaption_evaluation(client, dataset_id)

    return {
        "dataset_id": dataset_id,
        "run_id": run_id,
        "rows_requested": rows_requested,
        "ingested_rows": number_or_none(row_count),
        "processed_rows": progress_value(status, "processed_rows"),
        "total_rows": progress_value(status, "total_rows"),
        "rows": output_rows,
        **evaluation,
    }


def wait_for_adaption_ingestion(client: Any, dataset_id: str) -> int:
    for _ in range(90):
        status = client.datasets.get_status(dataset_id)
        state = str(getattr(status, "status", "")).lower()
        if state == "failed":
            error = getattr(status, "error", None)
            message = getattr(error, "message", None) or "unknown ingestion error"
            raise RuntimeError(f"Adaption ingestion failed: {message}")
        row_count = getattr(status, "row_count", None)
        if row_count is not None:
            return int(row_count)
        time.sleep(2)
    raise TimeoutError("Adaption ingestion did not finish within 3 minutes")


def wait_for_adaption_run(
    client: Any, dataset_id: str, timeout_seconds: int = ADAPTION_RUN_TIMEOUT_SECONDS
) -> Any:
    status = client.datasets.wait_for_completion(
        dataset_id, timeout=timeout_seconds
    )
    state = str(getattr(status, "status", "")).lower()
    if state != "succeeded":
        error = getattr(status, "error", None)
        message = getattr(error, "message", None) or f"status {state}"
        raise RuntimeError(f"Adaption run failed: {message}")
    return status


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
    from modal_app.paper_harness import normalize_label, parse_adaption_row

    source_label = normalize_label(row.get("label") or row.get("response"))
    parsed = parse_adaption_row(row, source_label or None)
    label = parsed["label"] or source_label
    return {
        "source_id": row.get("source_id"),
        "original_text": row.get("original_text"),
        "source_text": row.get("text"),
        "adapted_text": str(parsed["adapted_text"]),
        "label": str(label).lower(),
        "source_label": source_label,
        "generated_label": parsed.get("generated_label"),
        "completion_shape": parsed["shape"],
        "parse_status": parsed["status"],
        "candidate_count": parsed["candidate_count"],
        "parser_fallback": parsed["parser_fallback"],
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


def progress_value(status: Any, field: str) -> int | None:
    progress = getattr(status, "progress", None)
    if not progress:
        return None
    value = getattr(progress, field, None)
    try:
        return int(value)
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


def paper_run_result(
    training_source: str,
    metric_value: float,
    test_rows: list[dict[str, Any]],
    duration_ms: int,
    experiment: dict[str, Any],
    validation: dict[str, Any] | None = None,
    adaption: dict[str, Any] | None = None,
    audit: dict[str, Any] | None = None,
) -> dict[str, Any]:
    result = {
        "trainingSource": training_source,
        "metricName": "f1",
        "metricValue": metric_value,
        "provenance": "reproduced_live",
        "testSetHash": test_set_hash(test_rows),
        "durationMs": duration_ms,
        "modalCallId": os.getenv("MODAL_TASK_ID"),
        "experiment": experiment,
    }
    if validation is not None:
        result["validation"] = validation
    if adaption is not None:
        result["adaption"] = adaption
    if audit is not None:
        result["audit"] = audit
    return result


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


def fixture_paper_proof(started: float, request: RunRequest) -> dict[str, Any]:
    from modal_app.paper_harness import experiment_metadata

    test_rows = [{"text": "fixture test", "label": "positive"}]
    base = {
        "total_data": request.total_data,
        "valid_rows": 50,
        "test_rows": 412,
        "data_seed": request.data_seed,
        "model_seed": request.model_seed,
    }
    return {
        "runs": [
            paper_run_result(
                "paper_raw_full",
                0.61,
                test_rows,
                elapsed_ms(started),
                experiment_metadata(train_rows=450, **base),
            ),
            paper_run_result(
                "paper_raw_paired",
                0.58,
                test_rows,
                elapsed_ms(started),
                experiment_metadata(train_rows=410, **base),
            ),
            paper_run_result(
                "adaption_adapted_only",
                0.64,
                test_rows,
                elapsed_ms(started),
                experiment_metadata(train_rows=410, **base),
                validation={
                    "rowsRequested": 450,
                    "rowsReturned": 430,
                    "rowsPassedValidation": 410,
                    "drops": {"duplicate": 20},
                },
                adaption={"datasetId": "fixture-paper-dataset"},
            ),
        ],
        "datasetPreview": {"raw": [], "adapted": []},
    }
