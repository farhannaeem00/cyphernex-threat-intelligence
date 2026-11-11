
from app.services.graph.relationship_service import (
    METADATA_EVIDENCE_STRENGTH,
    _indicator_strength,
    _metadata_relationships,
    _parse_datetime,
    _url_path,
)


def test_shared_metadata_extracts_tags_reporter_path_and_date():
    metadata = {
        "tags": ["Mozi", "elf"],
        "reporter": "AnalystA",
        "url": "http://192.0.2.10:8080/bin.sh",
        "date_added": "2026-10-20 08:30:26 UTC",
    }

    found = {
        (kind, value)
        for kind, value, _ in _metadata_relationships(metadata)
    }

    assert ("observed_shared_tag", "mozi") in found
    assert ("observed_shared_tag", "elf") in found
    assert ("observed_shared_reporter", "analysta") in found
    assert ("observed_shared_url_path", "/bin.sh") in found
    assert ("observed_temporal_proximity", "2026-10-20") in found


def test_url_path_does_not_include_host_or_port():
    assert (
        _url_path({"url": "https://example.test:8443/a/b.sh?x=1"})
        == "/a/b.sh"
    )

    assert _url_path({"url": "not a url"}) is None
    assert _url_path({}) is None


def test_indicator_strength_orders_exact_indicators_by_type():
    assert _indicator_strength("sha256") > _indicator_strength("ip")
    assert _indicator_strength("ip") > _indicator_strength("hostname")
    assert _indicator_strength("hostname") > _indicator_strength("url")
    assert _indicator_strength("unknown") == 0.70


def test_metadata_scores_are_low_and_not_attribution_probabilities():
    assert METADATA_EVIDENCE_STRENGTH["observed_shared_tag"] == 0.25
    assert METADATA_EVIDENCE_STRENGTH["observed_shared_reporter"] == 0.10
    assert METADATA_EVIDENCE_STRENGTH["observed_temporal_proximity"] == 0.15


def test_datetime_parser_normalizes_to_utc():
    parsed = _parse_datetime("2026-10-20 08:30:26 UTC")

    assert parsed is not None
    assert parsed.utcoffset().total_seconds() == 0
