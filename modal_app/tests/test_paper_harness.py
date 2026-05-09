import pandas as pd

from modal_app.paper_harness import (
    build_adaption_audit,
    build_paired_raw_rows,
    load_paper_prosa_frames,
    macro_f1_at_threshold,
    paper_preprocess_text,
    parse_adaption_completion,
    split_paper_rows,
    text_characteristics,
    validate_paper_adapted_rows,
)


def test_paper_preprocess_matches_load_data_kernel():
    text = "Halo-DUNIA!!  Cek https://example.com/a\nBaru..."

    assert paper_preprocess_text(text) == "halo dunia cek https example com a baru"


def test_load_paper_prosa_frames_keeps_duplicates_and_removes_neutral(tmp_path):
    pd.DataFrame(
        [
            ["Bagus sekali!", "positive"],
            ["Bagus sekali!", "positive"],
            ["Buruk banget.", "negative"],
            ["Biasa saja.", "neutral"],
        ]
    ).to_csv(tmp_path / "data_train_full.tsv", sep="\t", header=False, index=False)
    pd.DataFrame(
        [
            ["Test positif!", "positive"],
            ["Test negatif!", "negative"],
            ["Test netral.", "neutral"],
        ]
    ).to_csv(tmp_path / "data_testing_full.tsv", sep="\t", header=False, index=False)

    train_rows, test_rows = load_paper_prosa_frames(tmp_path)

    assert [row["text"] for row in train_rows] == [
        "bagus sekali",
        "bagus sekali",
        "buruk banget",
    ]
    assert [row["label_id"] for row in test_rows] == [1, 0]


def test_split_paper_rows_uses_total_data_validation_semantics():
    rows = [
        {
            "source_id": f"row-{index}",
            "original_text": f"Text {index}",
            "text": f"text {index}",
            "label": "positive" if index % 2 else "negative",
            "label_id": 1 if index % 2 else 0,
        }
        for index in range(100)
    ]

    train_rows, valid_rows = split_paper_rows(
        rows, total_data=50, valid_size=0.1, data_seed=1
    )

    assert len(train_rows) == 45
    assert len(valid_rows) == 5
    assert {row["source_id"] for row in train_rows}.isdisjoint(
        {row["source_id"] for row in valid_rows}
    )


def test_macro_f1_at_threshold_uses_macro_average():
    score = macro_f1_at_threshold([1, 1, 0, 0], [0.9, 0.2, 0.8, 0.1], threshold=0.5)

    assert round(score, 6) == 0.5


def test_parse_adaption_completion_accepts_objects_arrays_and_fenced_json():
    parsed_object = parse_adaption_completion(
        '{"adapted_text": "Makanan ENAK!", "label": "positive"}',
        expected_label="positive",
    )
    parsed_array = parse_adaption_completion(
        """[
          {"adapted_text": "Buruk sekali.", "label": "negative"},
          {"adapted_text": "Pelayanan sangat baik.", "label": "positive"}
        ]""",
        expected_label="positive",
    )
    parsed_fenced = parse_adaption_completion(
        """```json
        [{"adapted_text": "Tempatnya nyaman.", "label": "positive"}]
        ```""",
        expected_label="positive",
    )

    assert parsed_object["status"] == "accepted"
    assert parsed_object["adapted_text"] == "Makanan ENAK!"
    assert parsed_object["shape"] == "object"
    assert parsed_array["status"] == "accepted"
    assert parsed_array["adapted_text"] == "Pelayanan sangat baik."
    assert parsed_array["shape"] == "array"
    assert parsed_array["candidate_count"] == 2
    assert parsed_fenced["status"] == "accepted"
    assert parsed_fenced["shape"] == "fenced_array"


def test_parse_adaption_completion_rejects_bad_outputs_and_label_mismatches():
    malformed = parse_adaption_completion("Negatif", expected_label="negative")
    refusal = parse_adaption_completion(
        "Saya tidak dapat memproses ujaran kebencian ini.",
        expected_label="negative",
    )
    empty = parse_adaption_completion("", expected_label="positive")
    mismatch = parse_adaption_completion(
        '{"adapted_text": "Pelayanan buruk.", "label": "negative"}',
        expected_label="positive",
    )

    assert malformed["status"] == "malformed_completion"
    assert refusal["status"] == "malformed_completion"
    assert empty["status"] == "empty_completion"
    assert mismatch["status"] == "label_mismatch"
    assert mismatch["generated_label"] == "negative"
    assert mismatch["adapted_text"] == ""


def test_validate_paper_adapted_rows_preprocesses_and_pairs_by_source_id():
    source_rows = [
        {
            "source_id": "train-1",
            "original_text": "Makanan enak!",
            "text": "makanan enak",
            "label": "positive",
            "label_id": 1,
        },
        {
            "source_id": "train-2",
            "original_text": "Pelayanan buruk.",
            "text": "pelayanan buruk",
            "label": "negative",
            "label_id": 0,
        },
    ]
    test_rows = [
        {
            "source_id": "test-1",
            "original_text": "Tempat nyaman",
            "text": "tempat nyaman",
            "label": "positive",
            "label_id": 1,
        }
    ]
    adapted_rows = [
        {
            "source_id": "train-1",
            "adapted_text": "Makanan ENAK, sekali!",
            "label": "positive",
        },
        {
            "source_id": "train-2",
            "adapted_text": "Tempat nyaman.",
            "label": "negative",
        },
    ]

    passed, drops, inspected = validate_paper_adapted_rows(
        adapted_rows, source_rows, test_rows
    )

    assert passed == [
        {
            "source_id": "train-1",
            "original_text": "Makanan enak!",
            "text": "makanan enak sekali",
            "adapted_text": "makanan enak sekali",
            "adapted_text_raw": "Makanan ENAK, sekali!",
            "label": "positive",
            "label_id": 1,
        }
    ]
    assert drops == {"test_duplicate": 1}
    assert inspected[0]["rowIndex"] == 1
    assert inspected[0]["status"] == "passed"
    assert inspected[1]["dropReason"] == "test_duplicate"
    assert build_paired_raw_rows(source_rows, passed)[0]["text"] == "makanan enak"


def test_validate_paper_adapted_rows_never_falls_back_to_raw_text():
    source_rows = [
        {
            "source_id": "train-1",
            "original_text": "Makanan enak!",
            "text": "makanan enak",
            "label": "positive",
            "label_id": 1,
        }
    ]
    adapted_rows = [
        {
            "source_id": "train-1",
            "text": "makanan enak",
            "label": "positive",
            "enhanced_completion": "Positif",
        }
    ]

    passed, drops, inspected = validate_paper_adapted_rows(
        adapted_rows, source_rows, []
    )

    assert passed == []
    assert drops == {"malformed_completion": 1}
    assert inspected[0]["preprocessedAdaptedText"] is None
    assert inspected[0]["dropReason"] == "malformed_completion"


def test_adaption_audit_surfaces_row_accounting_and_text_diagnostics():
    source_rows = [
        {
            "source_id": "train-1",
            "original_text": "Makanan Enak!",
            "text": "makanan enak",
            "label": "positive",
            "label_id": 1,
        },
        {
            "source_id": "train-2",
            "original_text": "Pelayanan buruk.",
            "text": "pelayanan buruk",
            "label": "negative",
            "label_id": 0,
        },
        {
            "source_id": "train-3",
            "original_text": "Tempat nyaman.",
            "text": "tempat nyaman",
            "label": "positive",
            "label_id": 1,
        },
    ]
    test_rows = [
        {
            "source_id": "test-1",
            "original_text": "Test Bersih!",
            "text": "test bersih",
            "label": "positive",
            "label_id": 1,
        }
    ]
    output_rows = [
        {
            "source_id": "train-1",
            "text": "makanan enak",
            "label": "positive",
            "enhanced_completion": '{"adapted_text": "Makanannya sangat lezat!", "label": "positive"}',
        },
        {
            "source_id": "train-2",
            "text": "pelayanan buruk",
            "label": "negative",
            "enhanced_completion": "Negatif",
        },
    ]

    passed, drops, inspected = validate_paper_adapted_rows(
        output_rows, source_rows, test_rows
    )
    audit = build_adaption_audit(
        source_rows=source_rows,
        test_rows=test_rows,
        adaption_result={
            "uploaded_rows": 3,
            "ingested_rows": 2,
            "processed_rows": 1,
            "total_rows": 2,
            "rows_requested": 2,
            "rows": output_rows,
        },
        passed_rows=passed,
        drops=drops,
    )

    assert len(passed) == 1
    assert audit["uploadedRows"] == 3
    assert audit["ingestedRows"] == 2
    assert audit["processedRows"] == 1
    assert audit["downloadedRows"] == 2
    assert audit["passedRows"] == 1
    assert audit["missingSourceIds"] == ["train-3"]
    assert audit["outputShapeCounts"] == {"object": 1, "plain_or_malformed": 1}
    assert audit["parseStatusCounts"] == {
        "accepted": 1,
        "malformed_completion": 1,
    }
    assert audit["parserFallbackCount"] == 0
    assert audit["drops"] == {"malformed_completion": 1}
    assert audit["textDiagnostics"]["rawTrain"]["uppercaseChars"] == 0
    assert audit["textDiagnostics"]["adaptedAfterPreprocess"]["punctuationChars"] == 0
    assert inspected[0]["preprocessedAdaptedText"] == "makanannya sangat lezat"


def test_text_characteristics_match_paper_preprocessed_style():
    stats = text_characteristics(["makanan enak", "pelayanan buruk"])

    assert stats["uppercaseChars"] == 0
    assert stats["punctuationChars"] == 0
    assert stats["allLowerNoPunct"] is True
