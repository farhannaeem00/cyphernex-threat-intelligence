
import httpx

from app.db.session import settings

URLHAUS_RECENT_URLS_ENDPOINT = (
    "https://urlhaus-api.abuse.ch/v1/urls/recent/"
)


def fetch_recent_urls(limit: int = 5) -> dict:
    """Fetch recent URLhaus records without writing to the database."""

    if not 1 <= limit <= 1000:
        raise ValueError("limit must be between 1 and 1000")

    response = httpx.get(
        f"{URLHAUS_RECENT_URLS_ENDPOINT}limit/{limit}/",
        headers={"Auth-Key": settings.URLHAUS_AUTH_KEY},
        timeout=30.0,
    )
    response.raise_for_status()

    data = response.json()

    if data.get("query_status") not in {"ok", "no_results"}:
        raise RuntimeError(
            f"URLhaus returned status: {data.get('query_status')}"
        )

    return data


def test_urlhaus_connection() -> None:
    """Check authentication and report basic feed information."""

    data = fetch_recent_urls(limit=5)
    records = data.get("urls", [])

    print("URLhaus connection successful.")
    print(f"API status: {data.get('query_status')}")
    print(f"Records received: {len(records)}")

    if records:
        print(f"Latest record ID: {records[0].get('id')}")
        print(f"Latest record date: {records[0].get('date_added')}")
