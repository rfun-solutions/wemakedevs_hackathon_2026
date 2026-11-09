## ADDED Requirements

### Requirement: GenAI-traced LLM calls
Every threading LLM call SHALL produce a span carrying GenAI semantic-convention attributes: operation name, system, request model, input and output token counts, plus a cost estimate and latency, and SHALL NOT include note text in attributes.

#### Scenario: Span visible in Dash0
- **WHEN** a run uses the LLM
- **THEN** a `kc.threads.llm` span exists under `kc.threads.run` with `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` and `kc.threads.cost_usd`

#### Scenario: Privacy
- **WHEN** a span is exported
- **THEN** no attribute contains note body text

### Requirement: Metrics for threading
The service SHALL emit `kc_threads_runs_total`, `kc_threads_llm_cost_usd_total`, `kc_threads_llm_tokens_total` and `kc_threads_run_duration_seconds`.

#### Scenario: Fallback counted
- **WHEN** a run falls back because of the cap
- **THEN** `kc_threads_runs_total{mode="heuristic",reason="cap"}` increments

### Requirement: Trace summary in the product
The Threads view SHALL show the latest run's model, tokens, cost and latency behind a "How this works" disclosure, and SHALL link to the trace when `DASH0_TRACE_URL_TEMPLATE` is configured.

#### Scenario: Summary shown
- **WHEN** a run finished using the LLM and Kay opens "How this works"
- **THEN** the trace card shows model, tokens in/out, cost and latency in text readable by screen readers

#### Scenario: No link configured
- **WHEN** the template is unset
- **THEN** the card shows numbers without a link
