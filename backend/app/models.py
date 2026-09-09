from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Residence(Base):
    """A customer. One row per residencia / ELEAM using Quimun."""

    __tablename__ = "residences"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    legal_name: Mapped[str] = mapped_column(String(200))
    rut: Mapped[str] = mapped_column(String(20))
    region: Mapped[str] = mapped_column(String(40), index=True)
    comuna: Mapped[str] = mapped_column(String(80))

    plan: Mapped[str] = mapped_column(String(30), index=True)
    beds: Mapped[int] = mapped_column(Integer)
    residents: Mapped[int] = mapped_column(Integer)
    size_band: Mapped[str] = mapped_column(String(20), index=True)
    licensed_seats: Mapped[int] = mapped_column(Integer)

    onboarded_at: Mapped[date] = mapped_column(Date)
    renewal_at: Mapped[date] = mapped_column(Date)
    mrr_clp: Mapped[int] = mapped_column(Integer)

    owner: Mapped[str] = mapped_column(String(80))
    contact_name: Mapped[str] = mapped_column(String(120))
    contact_role: Mapped[str] = mapped_column(String(60))
    whatsapp_group: Mapped[str] = mapped_column(String(120))
    pipedrive_id: Mapped[str] = mapped_column(String(30))

    users: Mapped[list["StaffUser"]] = relationship(back_populates="residence")


class StaffUser(Base):
    """A named seat inside a residence."""

    __tablename__ = "staff_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[date] = mapped_column(Date)
    deactivated_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    residence: Mapped[Residence] = relationship(back_populates="users")


class UsageDaily(Base):
    """The fact table: one row per residence / module / user / day.

    Keeping the user grain here is what makes single-user-dependency and
    seat-coverage detectable without a second pipeline.
    """

    __tablename__ = "usage_daily"

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("staff_users.id"), index=True)
    module: Mapped[str] = mapped_column(String(40))
    events: Mapped[int] = mapped_column(Integer)
    minutes: Mapped[int] = mapped_column(Integer)


# Deliberately only two composites plus `day` and `user_id`.
#
# Standalone indexes on residence_id and module would be redundant: SQLite can
# use the leftmost prefix of a composite, so ix_usage_res_mod_day already serves
# lookups on residence_id alone. On 224k rows the redundant indexes cost ~10MB
# of file size and buy nothing.
Index("ix_usage_res_day", UsageDaily.residence_id, UsageDaily.day)
Index("ix_usage_res_mod_day", UsageDaily.residence_id, UsageDaily.module, UsageDaily.day)


class Ticket(Base):
    """Support tickets — Quimun already runs a desk at /soporte/tickets/."""

    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id"), index=True)
    opened_at: Mapped[date] = mapped_column(Date, index=True)
    closed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    module: Mapped[str | None] = mapped_column(String(40), nullable=True)
    subject: Mapped[str] = mapped_column(String(200))
    subject_en: Mapped[str] = mapped_column(String(200))
    priority: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20))


class Interaction(Base):
    """Human touchpoints — WhatsApp, calls, visits. Mirrors how Raimundo
    actually stays close to each account today."""

    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    channel: Mapped[str] = mapped_column(String(20))
    direction: Mapped[str] = mapped_column(String(12))
    author: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(Text)
    summary_en: Mapped[str] = mapped_column(Text)


class SignalState(Base):
    """Mutable triage state layered on top of the (recomputed) signal engine.

    Signals themselves are derived, never stored — so the rules can change
    without a migration. Only what a human did about them is persisted.
    """

    __tablename__ = "signal_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id"), index=True)
    signal_key: Mapped[str] = mapped_column(String(60), index=True)
    module: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="abierta")
    assignee: Mapped[str | None] = mapped_column(String(80), nullable=True)
    snoozed_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
