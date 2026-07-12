"""
Environment configuration. Reads secrets exclusively from .env — nothing
in this codebase should ever contain a hardcoded API key.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# "auto" (default): fast tier -> Groq, strong tier -> OpenRouter.
# Force everything to one provider by setting LLM_PROVIDER_MODE=groq|openrouter.
LLM_PROVIDER_MODE = os.getenv("LLM_PROVIDER_MODE", "auto")

# Both defaults are free-tier models — Groq's API is free (rate-limited), and the
# ":free" suffix on OpenRouter routes to that model's zero-cost pool. Swap either
# via .env if you have paid quota and want a stronger model.
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
