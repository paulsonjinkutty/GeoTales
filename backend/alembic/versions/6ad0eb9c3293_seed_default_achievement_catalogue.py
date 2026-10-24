"""seed default achievement catalogue

Revision ID: 6ad0eb9c3293
Revises: bda49a6df8e3
Create Date: 2026-10-24 12:25:58.776440

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ad0eb9c3293'
down_revision: Union[str, Sequence[str], None] = 'bda49a6df8e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
