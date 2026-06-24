"""
runpod/orchestrator/gpt_client.py

Wraps the GPT-4.1-mini chat completions calls. Two distinct call shapes, per
the migration plan's "GPT-4.1-mini Orchestration Flow":
  1. get_agent_reply()      — low-latency, short max_tokens, used per turn.
  2. get_call_outcome()     — single call at end-of-call, asks for strict JSON
                              matching the schema in promptBuilder.buildOutcomeExtractionPrompt().
"""

import json
import os
from openai import AsyncOpenAI

_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
_MODEL = "gpt-4.1-mini"


async def get_agent_reply(messages: list[dict]) -> str:
    try:
        resp = await _client.chat.completions.create(
            model=_MODEL,
            messages=messages,
            temperature=0.6,
            max_tokens=120,
        )
        text = (resp.choices[0].message.content or "").strip()
        return text or "Sorry, could you say that again?"
    except Exception as err:
        print(f"[gpt_client] get_agent_reply error: {err}")
        return "Sorry, I'm having a little trouble. Could you repeat that?"


async def get_call_outcome(outcome_extraction_prompt: dict, transcript_messages: list[dict]) -> dict:
    """
    `outcome_extraction_prompt` is the {role, content} system message fetched
    from AOTMS at call start (memory_client.fetch_call_context). Appending the
    full transcript and asking for strict JSON keeps this call cheap and fast
    (single call at the very end, not per-turn).
    """
    try:
        resp = await _client.chat.completions.create(
            model=_MODEL,
            messages=[outcome_extraction_prompt, *transcript_messages],
            temperature=0.2,
            max_tokens=300,
        )
        raw = (resp.choices[0].message.content or "").strip()
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except Exception as err:
        print(f"[gpt_client] get_call_outcome error: {err}")
        # Safe fallback so the lead still gets updated even if extraction/parsing fails.
        return {
            "leadStatus": "Connected",
            "interestLevel": "Unknown",
            "studentIntent": "general_interest",
            "followUpRequired": False,
            "followUpDate": None,
            "demoRequired": False,
            "callbackReason": "",
            "conversationSummary": "AI call completed. Automatic summary unavailable.",
            "nextRecommendedAction": "no_action",
            "confidenceScore": 0.0,
        }
