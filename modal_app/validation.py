from __future__ import annotations

import re
from collections import Counter
from typing import Any


ALLOWED_LABELS = {"positive", "negative"}
INDONESIAN_MARKERS = {
    "aku",
    "anda",
    "bagus",
    "banget",
    "bersih",
    "dan",
    "dengan",
    "di",
    "dingin",
    "ini",
    "kamar",
    "kembali",
    "keluarga",
    "lambat",
    "makanan",
    "membuat",
    "nyaman",
    "pelayanan",
    "pelayanannya",
    "ramah",
    "sangat",
    "sekali",
    "saya",
    "stafnya",
    "tempat",
    "tidak",
    "untuk",
}


def validate_adapted_rows(
    rows: list[dict[str, Any]], test_rows: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    passed: list[dict[str, Any]] = []
    drops: Counter[str] = Counter()
    seen: set[str] = set()
    test_texts = {normalize_text(row.get("text", "")) for row in test_rows}

    for row in rows:
        text = str(row.get("adapted_text") or row.get("text") or "").strip()
        label = normalize_label(row.get("label"))
        normalized = normalize_text(text)

        if not text:
            drops["empty_text"] += 1
            continue
        if label not in ALLOWED_LABELS:
            drops["bad_label"] += 1
            continue
        if token_count(text) < 8:
            drops["too_short"] += 1
            continue
        if not looks_indonesian(text):
            drops["language_fail"] += 1
            continue
        if normalized in test_texts:
            drops["test_duplicate"] += 1
            continue
        if normalized in seen:
            drops["duplicate"] += 1
            continue

        seen.add(normalized)
        passed.append(
            {
                "original_text": row.get("original_text"),
                "adapted_text": text,
                "label": label,
                "language": "id",
                "source": row.get("source", "adaption"),
            }
        )

    return passed, dict(drops)


def normalize_label(value: Any) -> str:
    label = str(value or "").strip().lower()
    if label in {"positif", "positive", "pos", "1"}:
        return "positive"
    if label in {"negatif", "negative", "neg", "0"}:
        return "negative"
    return label


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def token_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text.lower()))


def looks_indonesian(text: str) -> bool:
    tokens = set(re.findall(r"\b[a-zA-Z]+\b", text.lower()))
    if not tokens:
        return False
    marker_hits = len(tokens & INDONESIAN_MARKERS)
    return marker_hits >= 2 or marker_hits / max(len(tokens), 1) >= 0.18
