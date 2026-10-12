import httpx

from app.core.config import settings


class AIProviderError(Exception):
    """The AI provider failed to return a usable response."""


class AIProviderNotConfiguredError(AIProviderError):
    """The AI provider has not been configured."""


class AIProviderTimeoutError(AIProviderError):
    """The AI provider exceeded its timeout."""


def generate_ai_text(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
) -> str:
    api_key = settings.AI_API_KEY

    if not api_key:
        raise AIProviderNotConfiguredError(
            "AI provider is not configured."
        )

    url = (
        f"{settings.AI_BASE_URL.rstrip('/')}"
        "/chat/completions"
    )

    payload = {
        "model": settings.AI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        "temperature": temperature,
    }

    try:
        response = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )

        response.raise_for_status()

    except httpx.TimeoutException as exc:
        raise AIProviderTimeoutError(
            "AI provider timed out."
        ) from exc

    except httpx.HTTPError as exc:
        raise AIProviderError(
            "AI provider request failed."
        ) from exc

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]

    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise AIProviderError(
            "AI provider returned an invalid response."
        ) from exc

    if not isinstance(content, str) or not content.strip():
        raise AIProviderError(
            "AI provider returned empty content."
        )

    return content.strip()