"""
runpod/orchestrator/outcome_client.py

Calls the AOTMS backend's POST /api/ai-caller/outcome once a call ends, handing
off the full transcript + structured GPT-4.1-mini outcome JSON so
outcomeService.applyAiCallOutcome() can update the Lead, release the AI lock,
schedule any callback FollowUp, and write the AiCallOutcome audit record.
"""

import os
import aiohttp

AOTMS_BASE_URL = os.environ.get("AOTMS_BASE_URL", "").rstrip("/")
SERVICE_TOKEN = os.environ.get("AI_CALLER_SERVICE_TOKEN", "")

async def post_call_outcome(
    lead_id: str,
    outcome: dict,
    transcript: str,
    duration_seconds: int,
    call_sid: str = "",
    campaign_id: str | None = None,
    recording_url: str = "",
) -> None:
    url = f"{AOTMS_BASE_URL}/api/ai-caller/outcome"
    headers = {"x-ai-caller-token": SERVICE_TOKEN, "Content-Type": "application/json"}
    body = {
        "leadId": lead_id,
        "campaignId": campaign_id,
        "callSid": call_sid,
        "durationSeconds": duration_seconds,
        "recordingUrl": recording_url,
        "transcript": transcript,
        "outcome": outcome,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=body, headers=headers, timeout=15) as resp:
            if resp.status >= 400:
                text = await resp.text()
                raise RuntimeError(f"outcome callback failed ({resp.status}): {text}")
