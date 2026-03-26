# DeepAgents MVP Runtime

This worktree contains the streaming/UI/e2e slice of the DeepAgents MVP. The app exposes a chat UI, a newline-delimited JSON streaming route, and a deterministic fake-agent mode for browser and Playwright verification.

## Environment

Copy `.env.example` to `.env.local` and set:

- `AGENT_MODEL` for the runtime adapter
- `DEEPAGENTS_ENABLE_DEEP_MODE=true` to exercise the deep runtime path
- `E2E_USE_FAKE_AGENT=true` to bypass the real runtime in local dev/tests and emit deterministic streaming fixture events (ignored when `NODE_ENV=production`)

## Scripts

- `npm run dev` - start the Next.js app
- `npm test` - run the Vitest unit suite
- `npm run build` - build the production app
- `npm run test:e2e` - run Playwright against the fake-agent mode

## Streaming contract

`POST /api/agent` accepts `{ "prompt": string }` and returns `application/x-ndjson`.

Each line is one JSON event with this shape:

```json
{ "type": "tool_result", "agentName": "main-agent", "message": "..." }
```

Supported event types for the MVP:

- `status`
- `tool_result`
- `response_delta`
- `final`

Blank prompts return `400` before the stream starts. If stream processing fails after the response has started, the route emits a last `final` event with `Request failed`.

## Test coverage

- `tests/unit/lib/agents/stream.test.ts` covers normalization, fake-agent fixtures, and NDJSON parsing
- `tests/unit/app/api/agent-route.test.ts` covers validation, fake mode gating, and post-start failure handling
- `tests/unit/components/chat-shell.test.tsx` covers blank prompts, timeline reset, visible sending state, and failure handling
- `tests/e2e/agent-chat.spec.ts` covers the full browser flow with `E2E_USE_FAKE_AGENT=true`, including a progressive streamed assistant update before the final state
