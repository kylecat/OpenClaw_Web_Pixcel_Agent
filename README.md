# OpenClaw_Web_Pixcel_Agent

Pixel-agent UI planning space for OpenClaw observability + operations UX.

## Goals
- Visualize Gaia/Astraea runtime status in a pixel scene.
- Provide a clear task board + alert board for assignment and failures.
- Add a dashboard entry point for gateway/session/token/host/IoT visibility.
- Keep initial release low-risk (read-only first, then controlled write actions).

## Suggested Delivery Phases
1. **Phase 1 (MVP / Read-only)**
   - Pixel scene + agent avatars + status emojis
   - Bulletin board (alerts/tasks)
   - Dashboard (gateway/sessions/tokens/host basic)
2. **Phase 2 (Controlled Actions)**
   - Agent profile panel (skills/tools/cron mapping)
   - Safe edit flow with diff + confirm
   - Config write with guards and rollback

## Development Documents
- `DevDocuments/階段_1_UI_PLAN.md`
- `DevDocuments/階段_1_NESTJS_SPEC_DRAFT.md`
- `DevDocuments/階段_1_TASKS.md`

## Reference
- Pixel Agents (inspiration): https://github.com/pablodelucca/pixel-agents
