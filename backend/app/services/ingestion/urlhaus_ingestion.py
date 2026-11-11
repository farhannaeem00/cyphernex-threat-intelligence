
import json
from datetime import datetime, timezone
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import engine
from app.integrations.urlhaus_client import fetch_recent_urls
from app.models import Document, Indicator
from app.models.document_indicator import DocumentIndicator

import ipaddress
from urllib.parse import urlsplit


SOURCE_NAME = "URLhaus"


def parse_source_datetime(value: str | None) -> datetime | None:
    """Parse a URLhaus timestamp into a timezone-aware datetime."""
    if not value:
        return None

    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S UTC")
        return parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None





def extract_indicators(url: str) -> list[dict[str, str]]:
    indicators = [
        {
            "indicator_type": "url",
            "value": url,
            "normalized_value": url.strip().lower(),
        }
    ]

    host = urlsplit(url).hostname

    if not host:
        return indicators

    try:
        ipaddress.ip_address(host)
        indicator_type = "ip"
    except ValueError:
        indicator_type = "hostname"

    normalized_host = host.lower().rstrip(".")

    indicators.append(
        {
            "indicator_type": indicator_type,
            "value": host,
            "normalized_value": normalized_host,
        }
    )

    return indicators



def ingest_urlhaus_records(limit: int = 5) -> dict[str, int]:
    """
    Import real URLhaus records.
    Repeated runs skip existing source records and indicators.
    """
    feed = fetch_recent_urls(limit=limit)
    records = feed.get("urls", [])

    stats = {
        "records_received": len(records),
        "documents_created": 0,
        "documents_skipped": 0,
        "indicators_created": 0,
        "indicator_links_created": 0,
        "records_skipped_invalid": 0,
    }

    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

    with SessionLocal() as session:
        with session.begin():
            for record in records:
                external_id = record.get("id")
                reported_url = record.get("url")

                if external_id is None or not reported_url:
                    stats["records_skipped_invalid"] += 1
                    continue

                external_id = str(external_id)

                existing_document_id = session.scalar(
                    select(Document.id).where(
                        Document.source_name == SOURCE_NAME,
                        Document.external_id == external_id,
                    )
                )

                if existing_document_id is None:
                    document_data = {
                        "title": f"URLhaus URL record {external_id}",
                        "source_name": SOURCE_NAME,
                        "external_id": external_id,
                        "original_filename": f"urlhaus-{external_id}.json",
                        "file_type": "urlhaus_record",
                        "content": json.dumps(
                            record, ensure_ascii=False, sort_keys=True
                        ),
                        "source_url": (
                            f"https://urlhaus.abuse.ch/url/{external_id}/"
                        ),
                        "published_at": parse_source_datetime(
                            record.get("date_added")
                        ),
                        "raw_metadata": record,
                        "status": "ingested",
                    }

                    inserted_id = session.scalar(
                        insert(Document)
                        .values(**document_data)
                        .on_conflict_do_nothing(
                            constraint="uq_documents_source_external_id"
                        )
                        .returning(Document.id)
                    )

                    if inserted_id is not None:
                        document_id = inserted_id
                        stats["documents_created"] += 1
                    else:
                        # Handles an existing record or a concurrent import.
                        document_id = session.scalar(
                            select(Document.id).where(
                                Document.source_name == SOURCE_NAME,
                                Document.external_id == external_id,
                            )
                        )
                        stats["documents_skipped"] += 1
                else:
                    document_id = existing_document_id
                    stats["documents_skipped"] += 1

                if document_id is None:
                    raise RuntimeError(
                        f"Could not resolve document for URLhaus record "
                        f"{external_id}"
                    )

                for indicator_data in extract_indicators(reported_url):
                    inserted_indicator_id = session.scalar(
                        insert(Indicator)
                        .values(**indicator_data)
                        .on_conflict_do_nothing(
                            constraint="uq_indicators_type_normalized_value"
                        )
                        .returning(Indicator.id)
                    )

                    if inserted_indicator_id is not None:
                        indicator_id = inserted_indicator_id
                        stats["indicators_created"] += 1
                    else:
                        indicator_id = session.scalar(
                            select(Indicator.id).where(
                                Indicator.indicator_type
                                == indicator_data["indicator_type"],
                                Indicator.normalized_value
                                == indicator_data["normalized_value"],
                            )
                        )

                    if indicator_id is None:
                        raise RuntimeError(
                            "Could not resolve indicator: "
                            f"{indicator_data['normalized_value']}"
                        )

                    link_id = session.scalar(
                        insert(DocumentIndicator)
                        .values(
                            document_id=document_id,
                            indicator_id=indicator_id,
                        )
                        .on_conflict_do_nothing(
                            constraint=(
                                "uq_document_indicators_document_indicator"
                            )
                        )
                        .returning(DocumentIndicator.id)
                    )

                    if link_id is not None:
                        stats["indicator_links_created"] += 1

    return stats
