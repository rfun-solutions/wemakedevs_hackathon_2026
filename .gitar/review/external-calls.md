# External calls

Scope: every file that makes an outbound network call (api and web).

- Every outbound call has an explicit timeout, an OpenTelemetry span (`kc.<domain>.<op>`) and error handling that degrades gracefully (a visible fallback, never a silent failure or an unhandled rejection).
- No secret is ever read in browser code. The only token allowed in the web bundle is the ingest-only Dash0 token (`VITE_DASH0_INGEST_TOKEN`). `ANTHROPIC_API_KEY` and `DASH0_TOKEN` are server-side only.
- Tests never call live services; mock the SDK or fetch.
