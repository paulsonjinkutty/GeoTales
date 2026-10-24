"""add user achievement awards

Revision ID: bda49a6df8e3
Revises: 1d5f20f1d1a3
Create Date: 2026-10-24 03:11:54.947651

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bda49a6df8e3'
down_revision: Union[str, Sequence[str], None] = '1d5f20f1d1a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    achievement_table = sa.table(
        "achievements",
        sa.column("name", sa.String(150)),
        sa.column("description", sa.Text()),
        sa.column("points", sa.Integer()),
    )

    op.bulk_insert(
        achievement_table,
        [
            {
                "name": "First Journey",
                "description": "Complete your first journey.",
                "points": 10,
            },
            {
                "name": "Trailblazer",
                "description": "Complete five journeys.",
                "points": 30,
            },
            {
                "name": "Route Collector",
                "description": "Record ten GPS points across your journeys.",
                "points": 20,
            },
            {
                "name": "Cartographer",
                "description": "Record one hundred GPS points across your journeys.",
                "points": 50,
            },
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DELETE FROM achievements
            WHERE name IN (
                'First Journey',
                'Trailblazer',
                'Route Collector',
                'Cartographer'
            )
            """
        )
    )
