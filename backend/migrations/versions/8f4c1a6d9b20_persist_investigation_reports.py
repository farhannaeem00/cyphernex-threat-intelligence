"""persist investigation reports and source passages

Revision ID: 8f4c1a6d9b20
Revises: 7d2a91c4e6b8
Create Date: 2026-10-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "8f4c1a6d9b20"
down_revision = "7d2a91c4e6b8"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "investigations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("report", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="completed"),
        sa.Column("evidence_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unverified_source_references", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_investigations_id", "investigations", ["id"])
    op.create_table(
        "investigation_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("investigation_id", sa.Integer(), sa.ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_label", sa.String(length=20), nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_id", sa.Integer(), sa.ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quoted_text", sa.Text(), nullable=False),
        sa.Column("start_offset", sa.Integer(), nullable=False),
        sa.Column("end_offset", sa.Integer(), nullable=False),
        sa.Column("retrieval_score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("investigation_id", "source_label", name="uq_investigation_sources_label"),
    )
    op.create_index("ix_investigation_sources_id", "investigation_sources", ["id"])
    op.create_index("ix_investigation_sources_investigation_id", "investigation_sources", ["investigation_id"])
    op.create_index("ix_investigation_sources_document_id", "investigation_sources", ["document_id"])

def downgrade() -> None:
    op.drop_index("ix_investigation_sources_document_id", table_name="investigation_sources")
    op.drop_index("ix_investigation_sources_investigation_id", table_name="investigation_sources")
    op.drop_index("ix_investigation_sources_id", table_name="investigation_sources")
    op.drop_table("investigation_sources")
    op.drop_index("ix_investigations_id", table_name="investigations")
    op.drop_table("investigations")
