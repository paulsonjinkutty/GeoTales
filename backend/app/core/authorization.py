from fastapi import HTTPException, status


def ensure_owner(
    current_user_id: int,
    resource_user_id: int,
) -> None:
    if current_user_id != resource_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this resource.",
        )