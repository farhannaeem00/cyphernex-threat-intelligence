from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func,UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Indicator(Base):
    __tablename__ = "indicators"
    __table_args__ = (
    UniqueConstraint(
        "indicator_type",
        "normalized_value",
        name="uq_indicators_type_normalized_value",
    ),
)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    indicator_type: Mapped[str] = mapped_column(String(30), nullable=False)
    value: Mapped[str] = mapped_column(String(2048), nullable=False, index=True)
    normalized_value: Mapped[str] = mapped_column(
        String(2048), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )