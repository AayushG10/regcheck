"""
Provider-router: a single call_llm() interface that can be backed by
either Groq (fast/cheap — used for extraction drafts) or OpenRouter
(stronger models — used when higher-quality reasoning is worth the
latency). Switch providers globally via LLM_PROVIDER_MODE in .env, or
force a specific tier per-call.

Both providers speak the OpenAI-compatible chat-completions schema, so a
single httpx call shape handles both — the only difference is the base
URL, API key, and model name.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

import httpx

from app import config

Tier = Literal["fast", "strong"]


@dataclass
class LLMResponse:
    content: str
    provider: str
    model: str


class LLMConfigError(RuntimeError):
    """Raised when the requested provider has no API key configured."""


def _resolve_provider(tier: Tier) -> str:
    if config.LLM_PROVIDER_MODE in ("groq", "openrouter"):
        return config.LLM_PROVIDER_MODE
    return "groq" if tier == "fast" else "openrouter"


def call_llm(prompt: str, system: str = "", tier: Tier = "fast", temperature: float = 0.1) -> LLMResponse:
    """Synchronous single-shot chat completion, routed by tier/provider mode."""
    provider = _resolve_provider(tier)

    if provider == "groq":
        api_key, url, model = config.GROQ_API_KEY, config.GROQ_API_URL, config.GROQ_MODEL
    else:
        api_key, url, model = config.OPENROUTER_API_KEY, config.OPENROUTER_API_URL, config.OPENROUTER_MODEL

    if not api_key:
        raise LLMConfigError(
            f"No API key configured for provider '{provider}'. "
            f"Set {'GROQ_API_KEY' if provider == 'groq' else 'OPENROUTER_API_KEY'} in backend/.env."
        )

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://regcheck.local"
        headers["X-Title"] = "RegCheck"

    body = {"model": model, "messages": messages, "temperature": temperature}

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    return LLMResponse(content=content, provider=provider, model=model)


def parse_json_response(content: str) -> dict:
    """Best-effort JSON extraction — strips markdown code fences if the model added them."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
