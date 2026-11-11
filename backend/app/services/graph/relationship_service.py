
import ipaddress
import json
from datetime import datetime, timezone
from itertools import combinations
from urllib.parse import urlsplit

from sqlalchemy import delete, select
from sqlalchemy.orm import sessionmaker

from app.db.session import engine
from app.models import Document, Indicator, Relationship
from app.models.document_indicator import DocumentIndicator


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


# Evidence-strength scores for observed overlap types.
# These are NOT probabilities of common ownership, maliciousness, or attribution.
INDICATOR_EVIDENCE_STRENGTH = {
    "sha256": 0.98,
    "sha1": 0.96,
    "md5": 0.94,
    "hash": 0.94,
    "file_hash": 0.94,
    "ip": 0.90,
    "hostname": 0.85,
    "domain": 0.85,
    "url": 0.80,
}

METADATA_EVIDENCE_STRENGTH = {
    "observed_shared_tag": 0.25,
    "observed_shared_url_path": 0.20,
    "observed_temporal_proximity": 0.15,
    "observed_shared_reporter": 0.10,
}


def _parse_document_metadata(document: Document) -> dict:
    """Extract structured metadata from a document's JSON content."""
    try:
        payload = json.loads(document.content or "")
        return payload if isinstance(payload, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _parse_datetime(value) -> datetime | None:
    """Parse ISO or URLhaus UTC timestamps into aware datetimes."""
    if not isinstance(value, str) or not value.strip():
        return None

    value = value.strip()

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S UTC")
        except ValueError:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _url_path(metadata: dict) -> str | None:
    """Extract the path from a valid HTTP/HTTPS URL."""
    raw_url = metadata.get("url")

    if not isinstance(raw_url, str) or not raw_url.strip():
        return None

    try:
        parsed = urlsplit(raw_url.strip())

        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return None

        path = parsed.path

    except ValueError:
        return None

    # Do not treat a missing path as a shared path.
    return (path.rstrip("/") or "/") if path else None


def _metadata_relationships(metadata: dict) -> list[tuple[str, str, str]]:
    """Return observed metadata overlaps; none imply attribution."""
    results = []

    # Source-reported tags
    tags = metadata.get("tags", [])

    if isinstance(tags, list):
        normalized_tags = {
            str(tag).strip().casefold()
            for tag in tags
            if tag is not None and str(tag).strip()
        }

        for tag in sorted(normalized_tags):
            results.append((
                "observed_shared_tag",
                tag,
                "The source records contain the same tag. This is metadata "
                "overlap only and does not verify payload identity or attribution.",
            ))

    # Source-reported reporter
    reporter = metadata.get("reporter")

    if isinstance(reporter, str) and reporter.strip():
        results.append((
            "observed_shared_reporter",
            reporter.strip().casefold(),
            "The source records list the same reporter. Reporter overlap "
            "does not establish common infrastructure or ownership.",
        ))

    # URL path
    path = _url_path(metadata)

    if path:
        results.append((
            "observed_shared_url_path",
            path,
            "The source URLs contain the same path. A shared path does not "
            "establish identical content or common control.",
        ))

    # Date added
    added = _parse_datetime(metadata.get("date_added"))

    if added:
        # This uses the UTC calendar date, not a rolling 24-hour window.
        results.append((
            "observed_temporal_proximity",
            added.strftime("%Y-%m-%d"),
            "The source records were added on the same UTC date. Temporal "
            "proximity alone does not establish coordination or a campaign.",
        ))

    return results


def _indicator_strength(indicator_type: str) -> float:
    normalized = (indicator_type or "").strip().casefold()
    return INDICATOR_EVIDENCE_STRENGTH.get(normalized, 0.70)


def _upsert_relationship(
    session,
    *,
    document_a_id: int,
    document_b_id: int,
    relationship_type: str,
    description: str,
    confidence: float,
    stats: dict,
    source_indicator_id: int | None = None,
    target_indicator_id: int | None = None,
) -> None:
    """Create or update a deterministic relationship and its evidence score."""

    existing = session.scalar(
        select(Relationship).where(
            Relationship.source_document_id == document_a_id,
            Relationship.target_document_id == document_b_id,
            Relationship.source_indicator_id == source_indicator_id,
            Relationship.target_indicator_id == target_indicator_id,
            Relationship.relationship_type == relationship_type,
        )
    )

    if existing:
        changed = (
            existing.description != description
            or existing.confidence != confidence
        )

        if changed:
            existing.description = description
            existing.confidence = confidence
            stats["relationships_updated"] += 1
        else:
            stats["relationships_skipped"] += 1

        return

    session.add(
        Relationship(
            source_document_id=document_a_id,
            target_document_id=document_b_id,
            source_indicator_id=source_indicator_id,
            target_indicator_id=target_indicator_id,
            relationship_type=relationship_type,
            description=description,
            confidence=confidence,
        )
    )

    stats["relationships_created"] += 1


def discover_shared_indicators() -> dict[str, int]:
    """
    Discover exact shared indicators and cautious metadata overlaps.

    The confidence field stores a documented evidence-strength score.
    It is not a probability and must not be interpreted as attribution.
    """

    stats = {
        "shared_indicator_pairs_found": 0,
        "metadata_relationships_found": 0,
        "shared_tag_values_found": 0,
        "shared_reporter_values_found": 0,
        "shared_url_path_values_found": 0,
        "temporal_overlap_values_found": 0,
        "relationships_created": 0,
        "relationships_updated": 0,
        "relationships_skipped": 0,
        "obsolete_threat_relationships_removed": 0,
    }

    with SessionLocal() as session:
        with session.begin():

            # Remove old generic threat-type relationships.
            # Sharing a broad threat classification is not meaningful
            # evidence that two documents are connected.
            obsolete_result = session.execute(
                delete(Relationship).where(
                    Relationship.relationship_type == "observed_shared_threat_type",
                    Relationship.source_document_id.is_not(None),
                    Relationship.target_document_id.is_not(None),
                    Relationship.source_indicator_id.is_(None),
                    Relationship.target_indicator_id.is_(None),
                )
            )

            stats["obsolete_threat_relationships_removed"] = (
                obsolete_result.rowcount or 0
            )

            # ---------------------------------------------------------
            # 1. Exact shared indicator relationships
            # ---------------------------------------------------------

            first = DocumentIndicator.__table__.alias("first_link")
            second = DocumentIndicator.__table__.alias("second_link")

            statement = (
                select(
                    first.c.document_id.label("document_a"),
                    second.c.document_id.label("document_b"),
                    first.c.indicator_id.label("indicator_id"),
                )
                .select_from(
                    first.join(
                        second,
                        first.c.indicator_id == second.c.indicator_id,
                    )
                )
                .where(first.c.document_id < second.c.document_id)
                .order_by(
                    first.c.indicator_id,
                    first.c.document_id,
                    second.c.document_id,
                )
            )

            pairs = session.execute(statement).all()

            stats["shared_indicator_pairs_found"] = len(pairs)

            for pair in pairs:
                indicator = session.get(Indicator, pair.indicator_id)

                if indicator is None:
                    continue

                kind = (indicator.indicator_type or "indicator").casefold()
                score = _indicator_strength(kind)

                description = (
                    f"Both source documents reference the exact same "
                    f"{kind}: `{indicator.normalized_value}`. "
                    f"Evidence-strength score: {score:.2f}/1.00 "
                    "(type-based heuristic, not a probability). "
                    "This overlap does not by itself prove common ownership, "
                    "compromise, or campaign attribution."
                )

                _upsert_relationship(
                    session,
                    document_a_id=pair.document_a,
                    document_b_id=pair.document_b,
                    source_indicator_id=pair.indicator_id,
                    target_indicator_id=pair.indicator_id,
                    relationship_type="observed_shared_indicator",
                    description=description,
                    confidence=score,
                    stats=stats,
                )

            # ---------------------------------------------------------
            # 2. Metadata-based relationships
            # ---------------------------------------------------------

            documents = session.scalars(
                select(Document).order_by(Document.id)
            ).all()

            metadata_by_id = {
                document.id: _parse_document_metadata(document)
                for document in documents
            }

            for doc_a, doc_b in combinations(documents, 2):
                meta_a = metadata_by_id[doc_a.id]
                meta_b = metadata_by_id[doc_b.id]

                if not meta_a or not meta_b:
                    continue

                observed_a = set(_metadata_relationships(meta_a))
                observed_b = set(_metadata_relationships(meta_b))

                shared = observed_a.intersection(observed_b)

                if not shared:
                    continue

                grouped: dict[str, list[str]] = {}
                explanations: dict[str, str] = {}

                for rel_type, value, explanation in shared:
                    grouped.setdefault(rel_type, []).append(value)
                    explanations[rel_type] = explanation

                for rel_type, values in sorted(grouped.items()):
                    values = sorted(set(values))

                    if rel_type == "observed_shared_tag":
                        stats["shared_tag_values_found"] += len(values)

                    elif rel_type == "observed_shared_reporter":
                        stats["shared_reporter_values_found"] += len(values)

                    elif rel_type == "observed_shared_url_path":
                        stats["shared_url_path_values_found"] += len(values)

                    elif rel_type == "observed_temporal_proximity":
                        stats["temporal_overlap_values_found"] += len(values)

                    score = METADATA_EVIDENCE_STRENGTH[rel_type]

                    description = (
                        f"Shared "
                        f"{rel_type.removeprefix('observed_shared_').removeprefix('observed_')}: "
                        f"{', '.join(values)}. "
                        f"{explanations[rel_type]} "
                        f"Evidence-strength score: {score:.2f}/1.00 "
                        "(type-based heuristic, not a probability). "
                        f"Source documents: {doc_a.title} and {doc_b.title}."
                    )

                    stats["metadata_relationships_found"] += len(values)

                    _upsert_relationship(
                        session,
                        document_a_id=doc_a.id,
                        document_b_id=doc_b.id,
                        relationship_type=rel_type,
                        description=description,
                        confidence=score,
                        stats=stats,
                    )

    return stats
