"""
runpod/orchestrator/memory_client.py

Calls the AOTMS backend's GET /api/ai-caller/prompt/:leadId at the start of each
call to fetch the versioned system prompt, welcome greeting, conversation-memory
block, and structured-output extraction prompt. Keeps prompt templates living in
one place (the main repo) instead of duplicated on the RunPod pod.
"""

import os
import aiohttp

AOTMS_BASE_URL = os.environ["AOTMS_BASE_URL"].rstrip("/")
SERVICE_TOKEN = os.environ["AI_CALLER_SERVICE_TOKEN"]


async def fetch_call_context(lead_id: str) -> dict:
    """
    Returns:
      {
        "systemPrompt": str,
        "welcomeGreeting": str,
        "outcomeExtractionPrompt": { "role": "system", "content": str },
        "language": str,
      }
    """
    url = f"{AOTMS_BASE_URL}/api/ai-caller/prompt/{lead_id}"
    headers = {"x-ai-caller-token": SERVICE_TOKEN}

    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, timeout=15) as resp:
            resp.raise_for_status()
            return await resp.json()
