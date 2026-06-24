# AOTMS AI Telecaller Upgrade — File Delivery

Companion code to `AI_TELECALLER_MIGRATION_PLAN.md`. Every file below is
**complete and ready to drop into your existing repo** at the path shown —
nothing is a fragment except where `frontend-patches/PATCHES.md` says so.

## Where each file goes (relative to your repo root)

| File in this zip | Destination in your repo | Status |
|---|---|---|
| `backend/src/models/Lead.js` | `backend/src/models/Lead.js` | MODIFIED (additive fields only) |
| `backend/src/models/Campaign.js` | `backend/src/models/Campaign.js` | MODIFIED (additive fields only) |
| `backend/src/models/AiCallOutcome.js` | `backend/src/models/AiCallOutcome.js` | NEW |
| `backend/src/routes/aiCaller.js` | `backend/src/routes/aiCaller.js` | MODIFIED (replace whole file) |
| `backend/src/routes/campaigns.js` | `backend/src/routes/campaigns.js` | MODIFIED (replace whole file) |
| `backend/src/services/aiCaller/outcomeService.js` | `backend/src/services/aiCaller/outcomeService.js` | MODIFIED (replace whole file) |
| `backend/src/services/aiCaller/promptBuilder.js` | `backend/src/services/aiCaller/promptBuilder.js` | MODIFIED (replace whole file) |
| `backend/src/services/aiCaller/leadLock.js` | `backend/src/services/aiCaller/leadLock.js` | NEW |
| `backend/src/services/aiCaller/dialer.js` | `backend/src/services/aiCaller/dialer.js` | NEW |
| `backend/src/services/aiCaller/conversationMemory.js` | `backend/src/services/aiCaller/conversationMemory.js` | NEW |
| `backend/src/services/aiCaller/campaignEngine.js` | `backend/src/services/aiCaller/campaignEngine.js` | NEW |
| `backend/src/services/aiCaller/callbackEngine.js` | `backend/src/services/aiCaller/callbackEngine.js` | NEW |
| `backend/src/server.js` | `backend/src/server.js` | MODIFIED (replace whole file) |
| `runpod/orchestrator/*` | new top-level `runpod/` directory, **not** inside `backend/` — this is a separate deployable that runs on the RunPod pod, not on your Node server | NEW |
| `frontend-patches/api.js` | `frontend/src/services/api.js` | MODIFIED (replace whole file — verified against your actual file, only additive lines) |
| `frontend-patches/PATCHES.md` | *(not a repo file)* | Manual snippets for `CampaignDetail.jsx` and `LeadDetailsPage.jsx` — see why inside |

## NOT touched / NOT included (left exactly as-is in your repo)

- `backend/src/services/aiCaller/openrouterClient.js` — deprecated, not deleted. Stop importing it (already done in the files above); remove only after your rollback window closes.
- `backend/src/services/aiCaller/relayHandler.js` — deprecated, not deleted. Still mounted in the new `server.js` for instant rollback (see plan §9); receives no traffic once the new TwiML is live.
- `backend/src/services/aiCaller/sessionStore.js` — deprecated, not deleted. Superseded by RunPod owning session state in-process per call.
- Every other route, model, service, and all frontend pages not listed above — completely untouched.

## Required new environment variables (add to your existing `.env` / hosting config)

**AOTMS backend:**
```
RUNPOD_WS_URL=wss://<your-pod-id>-8080.proxy.runpod.net/media
AI_CALLER_SERVICE_TOKEN=<generate a long random secret>
RUNPOD_API_KEY=<from RunPod account settings, for pod start/stop scheduling>
RUNPOD_POD_ID=<your pod's ID>
```
Existing `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
`PUBLIC_BASE_URL` stay exactly as they are — unchanged.
`OPENROUTER_API_KEY` can stay set during the parallel-run period; it's simply
no longer read by the new code path.

**RunPod orchestrator (set on the pod):**
```
OPENAI_API_KEY=<your GPT-4.1-mini-compatible API key>
AOTMS_BASE_URL=https://<your-existing-PUBLIC_BASE_URL>
AI_CALLER_SERVICE_TOKEN=<same value as above — shared secret>
PORT=8080
```

## Apply order (matches §12 of the migration plan)

1. Drop in the 3 model files — additive fields only, safe to deploy alone first.
2. Drop in `leadLock.js`, `dialer.js`, `conversationMemory.js` (no behavior change yet, nothing calls them outside the next step).
3. Replace `outcomeService.js`, `promptBuilder.js` — backward compatible, old callers still work.
4. Replace `routes/aiCaller.js`, `routes/campaigns.js`, `server.js`.
5. Build/deploy the RunPod pod from `runpod/orchestrator/` (`docker build` with the included Dockerfile, push, deploy as a Secure Cloud pod).
6. Set the new env vars on both sides.
7. Test with one lead via the existing manual "Call Now" button before enabling any campaign's `aiCallingEnabled`.
8. Apply the two frontend snippets in `frontend-patches/PATCHES.md`.

## Rollback

Revert `routes/aiCaller.js`'s `/twiml` handler to call
`connect.conversationRelay({...})` instead of `connect.stream({...})` — the
old WS mount in `server.js` is still registered and `relayHandler.js` /
`openrouterClient.js` are still present, so this is a one-file change with no
data migration (all new `Lead`/`Campaign` fields are additive and ignored by
old code paths).
