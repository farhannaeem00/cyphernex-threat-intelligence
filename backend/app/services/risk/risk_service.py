
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models import Citation, Document, Finding


def assess_urlhaus_risk() -> dict[str, int]:
    stats = {
        "documents_checked": 0,
        "findings_created": 0,
        "existing_findings_skipped": 0,
        "documents_skipped": 0,
    }

    with Session(engine) as session:
        with session.begin():
            documents = session.scalars(
                select(Document).where(Document.source_name == "URLhaus")
            ).all()

            for document in documents:
                stats["documents_checked"] += 1
                metadata = document.raw_metadata or {}

                if not isinstance(metadata, dict):
                    stats["documents_skipped"] += 1
                    continue

                threat = metadata.get("threat")
                tags = metadata.get("tags") or []
                url_status = str(
                    metadata.get("url_status") or "unknown"
                ).lower()

                has_threat = bool(threat)
                has_tags = bool(tags)

                # These are source-based triage rules, not proof
                # that a device has been compromised.
                if has_threat and url_status == "online":
                    risk_level = "high"
                elif has_threat or has_tags or url_status == "online":
                    risk_level = "medium"
                else:
                    risk_level = "unrated"

                existing_finding = session.scalar(
                    select(Finding.id).where(
                        Finding.document_id == document.id,
                        Finding.title == "URLhaus source-based risk assessment",
                    )
                )

                if existing_finding is not None:
                    stats["existing_findings_skipped"] += 1
                    continue

                evidence = {
                    "source": document.source_name,
                    "source_url": document.source_url,
                    "external_id": document.external_id,
                    "threat": threat,
                    "tags": tags,
                    "url_status": url_status,
                    "assessment_rule": (
                        "High: source reports a threat and URL status is online; "
                        "Medium: a threat, tags, or online status is reported; "
                        "Unrated: none of these conditions is present."
                    ),
                }

                finding = Finding(
                    document_id=document.id,
                    title="URLhaus source-based risk assessment",
                    description=(
                        f"URLhaus record {document.external_id or document.id} "
                        f"reports URL status '{url_status}', threat "
                        f"{threat or 'not specified'}, and tags "
                        f"{tags or 'not specified'}. "
                        f"The rule-based triage level is '{risk_level}'. "
                        "This is source-reported evidence, not confirmation "
                        "that a system was compromised or that an actor "
                        "has been identified."
                    ),
                    finding_type="evidence",
                    confidence=None,
                    risk_level=risk_level,
                )
                session.add(finding)
                session.flush()

                citation = Citation(
                    finding_id=finding.id,
                    document_id=document.id,
                    quoted_text=json.dumps(evidence, ensure_ascii=False),
                )
                session.add(citation)
                stats["findings_created"] += 1

    return stats
