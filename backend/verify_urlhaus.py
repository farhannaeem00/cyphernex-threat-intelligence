
from sqlalchemy import text

from app.db.session import engine


queries = {
    "URLhaus documents": """
        SELECT count(*)
        FROM documents
        WHERE source_name = 'URLhaus'
    """,
    "URL indicators": """
        SELECT count(*)
        FROM indicators
        WHERE indicator_type = 'url'
    """,
    "Hostname indicators": """
        SELECT count(*)
        FROM indicators
        WHERE indicator_type = 'hostname'
    """,
    "Document-indicator links": """
        SELECT count(*)
        FROM document_indicators
    """,
}

with engine.connect() as connection:
    for label, query in queries.items():
        count = connection.execute(text(query)).scalar_one()
        print(f"{label}: {count}")
