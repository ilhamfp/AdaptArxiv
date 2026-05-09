from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from statistics import mean, median
from typing import Any


PAPER_PREPROCESS_VERSION = "paper_load_data_v1"
PAPER_FEATURE_EXTRACTOR = "xlmr.large_fairseq_cls"
PAPER_HEAD_TYPE = "paper_dropout_linear_sigmoid"
PAPER_METRIC_VARIANT = "macro_f1_threshold_0_5"
PAPER_EXPERIMENT_MODE = "paper_faithful"
PAPER_EXPERIMENT_TYPE = "A"


def paper_preprocess_text(text: Any) -> str:
    value = str(text).lower()
    value = re.sub("[^0-9a-zA-Z]+", " ", value)
    value = re.sub("\n", " ", value)
    value = re.sub(r"((www\.[^\s]+)|(https?://[^\s]+)|(http?://[^\s]+))", " ", value)
    value = re.sub("  +", " ", value)
    return value.strip()


def load_paper_prosa_frames(dataset_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    return (
        load_paper_prosa_file(dataset_dir / "data_train_full.tsv", "train"),
        load_paper_prosa_file(dataset_dir / "data_testing_full.tsv", "test"),
    )


def load_paper_prosa_file(path: Path, split: str) -> list[dict[str, Any]]:
    import pandas as pd

    dataframe = pd.read_csv(path, sep="\t", header=None).rename(
        columns={0: "text", 1: "label"}
    )
    dataframe = dataframe[dataframe["label"] != "neutral"].reset_index(drop=True)
    rows: list[dict[str, Any]] = []
    for index, row in enumerate(dataframe.to_dict("records")):
        label = str(row["label"])
        rows.append(
            {
                "source_id": f"prosa-{split}-{index + 1:05d}",
                "original_text": str(row["text"]),
                "text": paper_preprocess_text(row["text"]),
                "label": label,
                "label_id": 1 if label == "positive" else 0,
            }
        )
    return rows


def split_paper_rows(
    rows: list[dict[str, Any]],
    total_data: int,
    valid_size: float = 0.1,
    data_seed: int = 1,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    import numpy as np
    from sklearn.model_selection import train_test_split

    labels = np.array([row["label_id"] for row in rows])
    train_rows, valid_rows = train_test_split(
        rows,
        test_size=valid_size,
        random_state=data_seed,
        stratify=labels,
    )
    total_valid = int(np.floor(valid_size * total_data))
    total_train = total_data - total_valid
    return list(train_rows[:total_train]), list(valid_rows[:total_valid])


def label_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in rows:
        counts[str(row.get("label", "unknown"))] += 1
    return dict(counts)


def macro_f1_at_threshold(
    y_true: list[int] | Any, y_pred_proba: list[float] | Any, threshold: float = 0.5
) -> float:
    from sklearn.metrics import f1_score

    y_pred = [1 if float(value) >= threshold else 0 for value in y_pred_proba]
    return float(f1_score(y_true, y_pred, average="macro"))


def parse_adaption_completion(
    value: Any, expected_label: str | None = None
) -> dict[str, Any]:
    stripped = str(value or "").strip()
    if not stripped:
        return completion_result("empty", "empty_completion")

    payload_text, shape = strip_fenced_json(stripped)
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        return completion_result("plain_or_malformed", "malformed_completion")

    candidates = payload if isinstance(payload, list) else [payload]
    if not isinstance(payload, (dict, list)):
        return completion_result(shape, "malformed_completion")

    parsed_candidates = [
        candidate_payload(candidate)
        for candidate in candidates
        if isinstance(candidate, dict)
    ]
    parsed_candidates = [
        candidate
        for candidate in parsed_candidates
        if candidate["adapted_text"] or candidate["label"]
    ]

    result = completion_result(shape, "missing_adapted_text")
    result["candidate_count"] = len(parsed_candidates)
    if not parsed_candidates:
        return result

    expected = normalize_label(expected_label) if expected_label else None
    if expected:
        for candidate in parsed_candidates:
            if candidate["label"] == expected and candidate["adapted_text"]:
                return completion_result(
                    shape,
                    "accepted",
                    adapted_text=candidate["adapted_text"],
                    label=expected,
                    generated_label=candidate["label"],
                    candidate_count=len(parsed_candidates),
                )

        first_label = next(
            (candidate["label"] for candidate in parsed_candidates if candidate["label"]),
            "",
        )
        return completion_result(
            shape,
            "label_mismatch" if first_label else "bad_label",
            generated_label=first_label,
            candidate_count=len(parsed_candidates),
        )

    first = next(
        (
            candidate
            for candidate in parsed_candidates
            if candidate["label"] in {"positive", "negative"}
            and candidate["adapted_text"]
        ),
        None,
    )
    if not first:
        return completion_result(
            shape,
            "bad_label",
            generated_label=parsed_candidates[0]["label"],
            candidate_count=len(parsed_candidates),
        )

    return completion_result(
        shape,
        "accepted",
        adapted_text=first["adapted_text"],
        label=first["label"],
        generated_label=first["label"],
        candidate_count=len(parsed_candidates),
    )


def parse_adaption_row(
    row: dict[str, Any], expected_label: str | None = None
) -> dict[str, Any]:
    if row.get("parse_status"):
        return {
            "adapted_text": str(row.get("adapted_text") or ""),
            "label": normalize_label(row.get("label")),
            "generated_label": normalize_label(row.get("generated_label")),
            "shape": str(row.get("completion_shape") or "unknown"),
            "status": str(row.get("parse_status")),
            "candidate_count": int(row.get("candidate_count") or 0),
            "parser_fallback": bool(row.get("parser_fallback")),
        }

    completion = row.get("enhanced_completion") or row.get("completion")
    if completion is not None and str(completion).strip():
        parsed = parse_adaption_completion(completion, expected_label)
    else:
        direct_text = str(row.get("adapted_text") or row.get("rephrased_text") or "").strip()
        label = normalize_label(row.get("label"))
        expected = normalize_label(expected_label) if expected_label else None
        if not direct_text:
            parsed = completion_result("direct", "empty_completion")
        elif expected and label != expected:
            parsed = completion_result("direct", "label_mismatch", generated_label=label)
        else:
            parsed = completion_result(
                "direct",
                "accepted",
                adapted_text=direct_text,
                label=expected or label,
                generated_label=label,
                candidate_count=1,
            )

    parsed["parser_fallback"] = False
    return parsed


def strip_fenced_json(value: str) -> tuple[str, str]:
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", value, flags=re.DOTALL | re.I)
    if fenced:
        inner = fenced.group(1).strip()
        shape = "fenced_array" if inner.startswith("[") else "fenced_object"
        return inner, shape
    if value.startswith("["):
        return value, "array"
    if value.startswith("{"):
        return value, "object"
    return value, "plain_or_malformed"


def candidate_payload(candidate: dict[str, Any]) -> dict[str, str]:
    return {
        "adapted_text": str(
            candidate.get("adapted_text")
            or candidate.get("rephrased_text")
            or candidate.get("text")
            or ""
        ).strip(),
        "label": normalize_label(candidate.get("label")),
    }


def completion_result(
    shape: str,
    status: str,
    *,
    adapted_text: str = "",
    label: str = "",
    generated_label: str = "",
    candidate_count: int = 0,
) -> dict[str, Any]:
    return {
        "adapted_text": adapted_text,
        "label": normalize_label(label),
        "generated_label": normalize_label(generated_label),
        "shape": shape,
        "status": status,
        "candidate_count": candidate_count,
        "parser_fallback": False,
    }


def validate_paper_adapted_rows(
    rows: list[dict[str, Any]],
    source_rows: list[dict[str, Any]],
    test_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int], list[dict[str, Any]]]:
    source_by_id = {row["source_id"]: row for row in source_rows}
    test_texts = {row["text"] for row in test_rows}
    seen: set[str] = set()
    passed: list[dict[str, Any]] = []
    drops: Counter[str] = Counter()
    inspected: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=1):
        source_id = str(row.get("source_id") or "")
        source = source_by_id.get(source_id)
        parsed = parse_adaption_row(row, source.get("label") if source else None)
        raw_text = str(parsed["adapted_text"]).strip()
        text = paper_preprocess_text(raw_text) if raw_text else ""
        label = normalize_label(parsed.get("label") or row.get("label"))
        drop_reason = ""

        if not source:
            drop_reason = "unknown_source"
        elif parsed["status"] != "accepted":
            drop_reason = str(parsed["status"])
        elif not text:
            drop_reason = "empty_text"
        elif label not in {"positive", "negative"}:
            drop_reason = "bad_label"
        elif label != source["label"]:
            drop_reason = "label_mismatch"
        elif text in test_texts:
            drop_reason = "test_duplicate"
        elif text in seen:
            drop_reason = "duplicate"

        inspected_row = {
            "rowIndex": row_index,
            "sourceId": source_id,
            "label": label,
            "originalText": source.get("original_text") if source else row.get("original_text"),
            "preprocessedOriginalText": source.get("text") if source else None,
            "adaptedTextRaw": raw_text or None,
            "preprocessedAdaptedText": text or None,
            "status": "dropped" if drop_reason else "passed",
            "dropReason": drop_reason or None,
            "outputShape": parsed["shape"],
            "parseStatus": parsed["status"],
            "generatedLabel": parsed.get("generated_label") or None,
        }
        inspected.append(inspected_row)

        if drop_reason:
            drops[drop_reason] += 1
            continue

        assert source is not None
        seen.add(text)
        passed.append(
            {
                "source_id": source_id,
                "original_text": source["original_text"],
                "text": text,
                "adapted_text": text,
                "adapted_text_raw": raw_text,
                "label": source["label"],
                "label_id": source["label_id"],
            }
        )

    return passed, dict(drops), inspected


def build_adaption_audit(
    *,
    source_rows: list[dict[str, Any]],
    test_rows: list[dict[str, Any]],
    adaption_result: dict[str, Any],
    passed_rows: list[dict[str, Any]],
    drops: dict[str, int],
) -> dict[str, Any]:
    output_rows = list(adaption_result.get("rows") or [])
    source_by_id = {str(row["source_id"]): row for row in source_rows}
    output_ids = {str(row.get("source_id")) for row in output_rows if row.get("source_id")}
    missing_source_ids = sorted(set(source_by_id) - output_ids)

    output_shape_counts: Counter[str] = Counter()
    parse_status_counts: Counter[str] = Counter()
    parser_fallback_count = 0
    exact_raw_matches = 0
    accepted_raw_texts: list[str] = []
    accepted_preprocessed_texts: list[str] = []

    for row in output_rows:
        source = source_by_id.get(str(row.get("source_id") or ""))
        parsed = parse_adaption_row(row, source.get("label") if source else None)
        output_shape_counts[str(parsed["shape"])] += 1
        parse_status_counts[str(parsed["status"])] += 1
        if parsed.get("parser_fallback"):
            parser_fallback_count += 1
        if parsed["status"] == "accepted":
            accepted_raw_texts.append(str(parsed["adapted_text"]))
            preprocessed = paper_preprocess_text(parsed["adapted_text"])
            accepted_preprocessed_texts.append(preprocessed)
            if source and preprocessed == source["text"]:
                exact_raw_matches += 1

    paired_source_by_id = {row["source_id"]: row for row in source_rows}
    length_deltas = [
        len(row["text"].split())
        - len(paired_source_by_id[row["source_id"]]["text"].split())
        for row in passed_rows
        if row["source_id"] in paired_source_by_id
    ]

    return {
        "uploadedRows": int(adaption_result.get("uploaded_rows") or len(source_rows)),
        "ingestedRows": number_or_zero(adaption_result.get("ingested_rows")),
        "requestedRows": number_or_zero(adaption_result.get("rows_requested")),
        "processedRows": number_or_zero(adaption_result.get("processed_rows")),
        "totalRows": number_or_zero(adaption_result.get("total_rows")),
        "downloadedRows": len(output_rows),
        "passedRows": len(passed_rows),
        "missingSourceIds": missing_source_ids,
        "missingSourceCount": len(missing_source_ids),
        "outputShapeCounts": dict(output_shape_counts),
        "parseStatusCounts": dict(parse_status_counts),
        "parserFallbackCount": parser_fallback_count,
        "labelMismatchCount": parse_status_counts.get("label_mismatch", 0),
        "exactRawMatchCount": exact_raw_matches,
        "drops": dict(drops),
        "textDiagnostics": {
            "rawTrain": text_characteristics([row["text"] for row in source_rows]),
            "adaptedRawOutput": text_characteristics(accepted_raw_texts),
            "adaptedAfterPreprocess": text_characteristics(
                [row["text"] for row in passed_rows]
            ),
            "test": text_characteristics([row["text"] for row in test_rows]),
        },
        "lengthDelta": length_delta_summary(length_deltas),
    }


def text_characteristics(texts: list[str]) -> dict[str, Any]:
    token_counts = [len(str(text).split()) for text in texts]
    joined = "\n".join(str(text) for text in texts)
    char_count = max(len(joined), 1)
    uppercase_chars = sum(1 for char in joined if char.isupper())
    punctuation_chars = sum(
        1 for char in joined if re.match(r"[^0-9a-zA-Z\s]", char)
    )

    return {
        "rows": len(texts),
        "meanTokens": round(mean(token_counts), 2) if token_counts else 0,
        "medianTokens": round(median(token_counts), 2) if token_counts else 0,
        "minTokens": min(token_counts) if token_counts else 0,
        "maxTokens": max(token_counts) if token_counts else 0,
        "uppercaseChars": uppercase_chars,
        "punctuationChars": punctuation_chars,
        "uppercasePer1kChars": round(uppercase_chars / char_count * 1000, 2),
        "punctuationPer1kChars": round(punctuation_chars / char_count * 1000, 2),
        "allLowerNoPunct": uppercase_chars == 0 and punctuation_chars == 0,
    }


def length_delta_summary(deltas: list[int]) -> dict[str, Any]:
    return {
        "meanTokens": round(mean(deltas), 2) if deltas else 0,
        "medianTokens": round(median(deltas), 2) if deltas else 0,
        "minTokens": min(deltas) if deltas else 0,
        "maxTokens": max(deltas) if deltas else 0,
        "adaptedLongerPercent": round(
            sum(1 for delta in deltas if delta > 0) / len(deltas) * 100, 2
        )
        if deltas
        else 0,
        "adaptedShorterPercent": round(
            sum(1 for delta in deltas if delta < 0) / len(deltas) * 100, 2
        )
        if deltas
        else 0,
    }


def number_or_zero(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def build_paired_raw_rows(
    source_rows: list[dict[str, Any]], adapted_rows: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    source_by_id = {row["source_id"]: row for row in source_rows}
    return [source_by_id[row["source_id"]] for row in adapted_rows if row["source_id"] in source_by_id]


def normalize_label(value: Any) -> str:
    label = str(value or "").strip().lower()
    if label in {"positive", "positif", "pos", "1"}:
        return "positive"
    if label in {"negative", "negatif", "neg", "0"}:
        return "negative"
    return label


def experiment_metadata(
    *,
    total_data: int,
    train_rows: int,
    valid_rows: int,
    test_rows: int,
    data_seed: int = 1,
    model_seed: int = 4,
) -> dict[str, Any]:
    return {
        "experimentMode": PAPER_EXPERIMENT_MODE,
        "experimentType": PAPER_EXPERIMENT_TYPE,
        "totalData": total_data,
        "trainRows": train_rows,
        "validRows": valid_rows,
        "testRows": test_rows,
        "dataSeed": data_seed,
        "modelSeed": model_seed,
        "preprocessVersion": PAPER_PREPROCESS_VERSION,
        "featureExtractor": PAPER_FEATURE_EXTRACTOR,
        "headType": PAPER_HEAD_TYPE,
        "metricVariant": PAPER_METRIC_VARIANT,
    }
