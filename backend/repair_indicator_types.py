
import ipaddress

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models import Indicator


def repair_indicator_types() -> None:
    changed = 0

    with Session(engine) as session:
        with session.begin():
            indicators = session.scalars(
                select(Indicator).where(
                    Indicator.indicator_type == "hostname"
                )
            ).all()

            for indicator in indicators:
                try:
                    normalized_ip = str(
                        ipaddress.ip_address(indicator.normalized_value)
                    )
                except ValueError:
                    continue

                existing_ip = session.scalar(
                    select(Indicator).where(
                        Indicator.indicator_type == "ip",
                        Indicator.normalized_value == normalized_ip,
                    )
                )

                if existing_ip is not None:
                    raise RuntimeError(
                        f"Duplicate IP indicator already exists: "
                        f"{normalized_ip}. No changes committed."
                    )

                indicator.indicator_type = "ip"
                indicator.normalized_value = normalized_ip
                indicator.value = normalized_ip
                changed += 1

    print(f"Existing IP indicators corrected: {changed}")


if __name__ == "__main__":
    repair_indicator_types()
