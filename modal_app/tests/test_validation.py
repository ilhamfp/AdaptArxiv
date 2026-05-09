from modal_app.validation import validate_adapted_rows


def test_validate_adapted_rows_keeps_good_indonesian_rows():
    rows = [
        {
            "adapted_text": "Hotel ini sangat nyaman dan pelayanannya membuat saya ingin kembali lagi",
            "label": "positive",
        }
    ]
    test_rows = [{"text": "Makanan dingin dan pelayanannya lambat sekali", "label": "negative"}]

    passed, drops = validate_adapted_rows(rows, test_rows)

    assert len(passed) == 1
    assert passed[0]["language"] == "id"
    assert drops == {}


def test_validate_adapted_rows_drops_invalid_rows():
    rows = [
        {"adapted_text": "", "label": "positive"},
        {"adapted_text": "This hotel is great and I will come back soon", "label": "positive"},
        {"adapted_text": "Ulasan ini pendek", "label": "positive"},
        {
            "adapted_text": "Makanan dingin dan pelayanannya lambat sekali sehingga saya kecewa",
            "label": "negative",
        },
        {
            "adapted_text": "Tempat ini bersih nyaman dan stafnya ramah sekali untuk keluarga",
            "label": "neutral",
        },
        {
            "adapted_text": "Tempat ini bersih nyaman dan stafnya ramah sekali untuk keluarga",
            "label": "positive",
        },
        {
            "adapted_text": "Tempat ini bersih nyaman dan stafnya ramah sekali untuk keluarga",
            "label": "positive",
        },
    ]
    test_rows = [
        {
            "text": "Makanan dingin dan pelayanannya lambat sekali sehingga saya kecewa",
            "label": "negative",
        }
    ]

    passed, drops = validate_adapted_rows(rows, test_rows)

    assert len(passed) == 1
    assert drops["empty_text"] == 1
    assert drops["language_fail"] == 1
    assert drops["too_short"] == 1
    assert drops["test_duplicate"] == 1
    assert drops["bad_label"] == 1
    assert drops["duplicate"] == 1
