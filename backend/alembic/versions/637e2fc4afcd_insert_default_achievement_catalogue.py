"""insert default achievement catalogue

Revision ID: 637e2fc4afcd
Revises: 6ad0eb9c3293
Create Date: 2026-10-24 12:36:23.607404

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '637e2fc4afcd'
down_revision: Union[str, Sequence[str], None] = '6ad0eb9c3293'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO achievements (name, description, points)
            VALUES
                (
                    'First Journey',
                    'Complete your first journey.',
                    10
                ),
                (
                    'Trailblazer',
                    'Complete five journeys.',
                    30
                ),
                (
                    'Route Collector',
                    'Record ten GPS points across your journeys.',
                    20
                ),
                (
                    'Cartographer',
                    'Record one hundred GPS points across your journeys.',
                    50
                )
            ON CONFLICT (name) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DELETE FROM achievements AS a
            WHERE a.name IN (
                'First Journey',
                'Trailblazer',
                'Route Collector',
                'Cartographer'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM user_achievements AS ua
                WHERE ua.achievement_id = a.id
            )
            """
        )
    )
