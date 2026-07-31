"""
Pure-function usage parsers for the egress recorder.

The mitmproxy addon (`addon.py`) is a thin event-handler shim around this
module: for every HTTPS response intercepted on a metered model host, the
addon calls one of these parse_* functions with the raw response bytes and
writes the returned dict (if any) to the per-run NDJSON usage log.

Keeping the parsing logic in a stand-alone module without mitmproxy
imports means the tests can exercise it directly with realistic JSON
fixtures, no docker / no network. mitmproxy is only the transport.

Three wire formats are parsed, each with a streaming and a
non-streaming shape:

**Anthropic `/v1/messages`** (`parse_anthropic_messages_response`):

1. **Non-streaming** — request body has `stream != true`, response is a
   single JSON document with a top-level `usage` object (see
   https://docs.anthropic.com/en/api/messages). The dict carries
   `input_tokens`, `output_tokens`, optionally
   `cache_creation_input_tokens` + `cache_read_input_tokens`, and — when
   prompt caching is in play — a `cache_creation` object splitting the
   write into `ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`
   (priced at different TTL rates).

2. **Streaming** — request body has `stream: true`, response is a
   `text/event-stream` body. The model emits a `message_start` event
   whose `message.usage` carries the prompt-side counters with
   `output_tokens: 0`, then a sequence of `content_block_*` events, then
   a `message_delta` event whose `usage.output_tokens` carries the
   COMPLETION-side counter. The final per-request totals are the union
   (input + cache fields from `message_start`, output from
   `message_delta`).

**OpenAI-compatible `/chat/completions`**
(`parse_openai_chat_completions_response`) — shared by OpenAI itself
(`/v1/chat/completions`) and Fireworks
(`/inference/v1/chat/completions`), which serves open-weight models like
MiniMax-M3 behind the same API (see
https://platform.openai.com/docs/api-reference/chat):

1. **Non-streaming** — a single JSON document with a top-level `usage`
   object carrying `prompt_tokens` / `completion_tokens`.

2. **Streaming** — a `text/event-stream` body. Because the assistant
   always sends `stream_options: { include_usage: true }`, the server
   emits a terminal chunk with a populated top-level `usage` object and
   an empty `choices` array just before the `data: [DONE]` sentinel.

**OpenAI Responses API `/v1/responses`**
(`parse_openai_responses_response`) is the wire format the assistant's
`openai` provider speaks against `api.openai.com` (see
`assistant/src/providers/openai/responses-provider.ts`). Its usage object
is `input_tokens` / `output_tokens` with the cached and cache-written
subsets nested under `input_tokens_details.cached_tokens` and
`input_tokens_details.cache_write_tokens`, both counted *inside*
`input_tokens`:

1. **Non-streaming**: a single JSON document with a top-level `usage`
   object.

2. **Streaming**: a `text/event-stream` body whose terminal
   `response.completed` (or `response.incomplete`) event carries the
   final `response.usage`.

`parse_openai_usage_response` dispatches between the chat-completions and
Responses shapes on the request path, so the addon has one entry point
per OpenAI-compatible host regardless of which API that host serves.

All entry points return a normalized dict shaped like the evals
harness's existing `event.message.usage` records (`provider`, `model`,
top-level `input_tokens` / `output_tokens`, plus the raw `usage` object)
— so downstream `summarizeAssistantUsage` and the pricing table can
consume them without any new shape awareness.
"""

from __future__ import annotations

import json
from typing import Any, Optional
from urllib.parse import urlsplit


def _coerce_int(value: Any) -> Optional[int]:
    """Best-effort int coercion that returns None for non-numeric inputs."""
    if isinstance(value, bool):
        # bool is an int subclass in Python; reject it explicitly so a
        # stray `True` in a response body doesn't get summed.
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value == int(value) else None
    return None


def _usage_record_from_anthropic_usage(
    model: Optional[str],
    usage: dict,
) -> dict:
    """Project an Anthropic `usage` object onto the evals usage record shape.

    The flat token counters (`input_tokens`, `output_tokens`,
    `cache_creation_input_tokens`, `cache_read_input_tokens`) are pulled
    up to the top level so `summarizeAssistantUsage` and the report's
    per-request breakdown can read them without descending into the raw
    object.

    The full `usage` object is also forwarded verbatim under a `usage`
    key. Anthropic prices cache writes by TTL tier — a 5-minute ephemeral
    write costs 1.25x base input, a 1-hour write 2x — and surfaces the
    split in `usage.cache_creation.{ephemeral_5m,ephemeral_1h}_input_tokens`.
    Keeping the whole object means the harness can attribute those tiers
    (and any future usage fields) instead of collapsing every write into a
    single rate.
    """
    record: dict = {"provider": "anthropic", "usage": usage}
    if model:
        record["model"] = model
    input_tokens = _coerce_int(usage.get("input_tokens"))
    output_tokens = _coerce_int(usage.get("output_tokens"))
    cache_creation = _coerce_int(usage.get("cache_creation_input_tokens"))
    cache_read = _coerce_int(usage.get("cache_read_input_tokens"))
    if input_tokens is not None:
        record["input_tokens"] = input_tokens
    if output_tokens is not None:
        record["output_tokens"] = output_tokens
    if cache_creation is not None:
        record["cache_creation_input_tokens"] = cache_creation
    if cache_read is not None:
        record["cache_read_input_tokens"] = cache_read
    cache_creation_breakdown = usage.get("cache_creation")
    if isinstance(cache_creation_breakdown, dict):
        record["cache_creation"] = cache_creation_breakdown
    return record


def _parse_anthropic_non_streaming(response_body: bytes) -> Optional[dict]:
    """Parse a non-streaming /v1/messages response body."""
    try:
        payload = json.loads(response_body)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    model = payload.get("model")
    if not isinstance(model, str):
        model = None
    return _usage_record_from_anthropic_usage(model, usage)


def _parse_sse_events(response_body: bytes) -> list[dict]:
    """Yield parsed JSON payloads from an Anthropic SSE stream.

    Anthropic's stream is `text/event-stream` framed as:

        event: message_start
        data: {"type":"message_start", "message": { ... }}

        event: content_block_start
        data: {"type":"content_block_start", ...}

        event: ping
        data: {"type": "ping"}

        ...

    The parser is forgiving: it skips blank lines, comment lines, and
    `data:` lines that aren't JSON. It does NOT attempt to honor `id:` /
    `retry:` because we only need the `data:` payloads.
    """
    events: list[dict] = []
    try:
        text = response_body.decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001 -- intentional broad: undecodable
        return events
    for chunk in text.split("\n\n"):
        for line in chunk.splitlines():
            if not line.startswith("data:"):
                continue
            payload = line[len("data:"):].strip()
            if not payload or payload == "[DONE]":
                continue
            try:
                parsed = json.loads(payload)
            except (json.JSONDecodeError, ValueError):
                continue
            if isinstance(parsed, dict):
                events.append(parsed)
    return events


def _parse_anthropic_streaming(response_body: bytes) -> Optional[dict]:
    """Combine `message_start` + `message_delta` SSE events into one record."""
    events = _parse_sse_events(response_body)
    if not events:
        return None

    model: Optional[str] = None
    base_usage: dict = {}
    final_output_tokens: Optional[int] = None

    for event in events:
        etype = event.get("type")
        if etype == "message_start":
            message = event.get("message")
            if isinstance(message, dict):
                if isinstance(message.get("model"), str):
                    model = message["model"]
                usage = message.get("usage")
                if isinstance(usage, dict):
                    base_usage = dict(usage)
        elif etype == "message_delta":
            usage = event.get("usage")
            if isinstance(usage, dict):
                output_tokens = _coerce_int(usage.get("output_tokens"))
                if output_tokens is not None:
                    final_output_tokens = output_tokens

    if not base_usage and final_output_tokens is None:
        return None

    if final_output_tokens is not None:
        base_usage["output_tokens"] = final_output_tokens
    return _usage_record_from_anthropic_usage(model, base_usage)


def parse_anthropic_messages_response(
    request_path: str,
    request_body: bytes,
    response_content_type: str,
    response_body: bytes,
) -> Optional[dict]:
    """Top-level entry point — returns a usage record or `None`.

    `None` means "this response carries no usage record" — either because
    it isn't a /v1/messages response, or because the body is malformed.
    The mitmproxy addon treats `None` as "skip" (no NDJSON line written).
    """
    # Match on the path component only. The Anthropic SDK's beta namespace
    # (`client.beta.messages`) posts to `/v1/messages?beta=true`, which the
    # main agent loop uses for every non-Haiku turn (it always sends a
    # `betas` header). A bare `endswith("/v1/messages")` check fails on that
    # query string, so the dominant model traffic would go unmetered while
    # the auxiliary Haiku calls (plain `/v1/messages`) are recorded. Stripping
    # the query before the suffix check captures both. `count_tokens` paths
    # carry no usage and remain excluded because they don't end in
    # `/v1/messages`.
    path_only = urlsplit(request_path).path
    if not path_only.endswith("/v1/messages"):
        return None
    # SSE streaming responses have content-type "text/event-stream".
    # Non-streaming responses are "application/json".
    if "text/event-stream" in response_content_type.lower():
        return _parse_anthropic_streaming(response_body)
    if "application/json" in response_content_type.lower():
        return _parse_anthropic_non_streaming(response_body)
    # Some intermediate proxies omit the content-type; fall back to
    # inspecting the request body's `stream` flag.
    try:
        req = json.loads(request_body) if request_body else {}
    except (json.JSONDecodeError, ValueError):
        req = {}
    if isinstance(req, dict) and req.get("stream") is True:
        return _parse_anthropic_streaming(response_body)
    return _parse_anthropic_non_streaming(response_body)


def _usage_record_from_openai_usage(
    provider: str,
    model: Optional[str],
    usage: dict,
) -> dict:
    """Project an OpenAI-compatible `usage` object onto the evals record shape.

    OpenAI / Fireworks chat-completions report `prompt_tokens` (the full
    prompt count, with the cached subset already included) and
    `completion_tokens`. Those map onto the evals record's `input_tokens`
    / `output_tokens` — the same flat shape `summarizeAssistantUsage` and
    the pricing table read for Anthropic.

    The cached subset lives in `usage.prompt_tokens_details.cached_tokens`,
    counted inside `prompt_tokens`. It is hoisted to a top-level
    `cache_read_input_tokens` so the pricer can re-price it at a provider's
    discounted cache-read rate when one exists (e.g. Fireworks MiniMax-M3
    at $0.06/1M). `priceUsageRecord` subtracts the cached subset out of the
    inclusive input count before charging it, mirroring the daemon's
    non-Anthropic `calculateUsageCost` branch, so this does not double-bill
    (see `src/lib/pricing.ts`).

    The cache-*written* subset lives alongside it as
    `prompt_tokens_details.cache_write_tokens` on providers that bill
    writes separately (GPT-5.6+ explicit prompt-cache mode) and is hoisted
    to `cache_creation_input_tokens` under the same inclusive-count
    convention.

    `provider` is supplied by the caller (`"openai"` or `"fireworks"`)
    because the wire format is identical across both — only the host the
    addon observed disambiguates them.
    """
    record: dict = {"provider": provider, "usage": usage}
    if model:
        record["model"] = model
    input_tokens = _coerce_int(usage.get("prompt_tokens"))
    output_tokens = _coerce_int(usage.get("completion_tokens"))
    if input_tokens is not None:
        record["input_tokens"] = input_tokens
    if output_tokens is not None:
        record["output_tokens"] = output_tokens
    prompt_details = usage.get("prompt_tokens_details")
    if isinstance(prompt_details, dict):
        _hoist_openai_cache_details(record, prompt_details)
    return record


def _hoist_openai_cache_details(record: dict, details: dict) -> None:
    """Lift an OpenAI token-details object's cache counters to top level.

    Shared by the chat-completions (`prompt_tokens_details`) and Responses
    (`input_tokens_details`) shapes, which name the same two counters
    identically. Both are counted *inside* the inclusive input count, so the
    pricer splits them back out before charging.
    """
    cached_tokens = _coerce_int(details.get("cached_tokens"))
    if cached_tokens is not None:
        record["cache_read_input_tokens"] = cached_tokens
    cache_write_tokens = _coerce_int(details.get("cache_write_tokens"))
    if cache_write_tokens is not None:
        record["cache_creation_input_tokens"] = cache_write_tokens


def _parse_openai_non_streaming(
    provider: str, response_body: bytes
) -> Optional[dict]:
    """Parse a non-streaming chat-completions response body."""
    try:
        payload = json.loads(response_body)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    model = payload.get("model")
    if not isinstance(model, str):
        model = None
    return _usage_record_from_openai_usage(provider, model, usage)


def _parse_openai_streaming(
    provider: str, response_body: bytes
) -> Optional[dict]:
    """Pull the usage + model out of a chat-completions SSE stream.

    With `stream_options: { include_usage: true }` — which the assistant
    always sends for OpenAI-compatible providers — the server emits a
    terminal chunk carrying a populated top-level `usage` object and an
    empty `choices` array, just before the `data: [DONE]` sentinel. Every
    content chunk carries the resolved `model`. The last populated `usage`
    dict and the last `model` seen are taken so a stray earlier null-usage
    chunk can't shadow the real totals.
    """
    events = _parse_sse_events(response_body)
    if not events:
        return None

    model: Optional[str] = None
    usage: Optional[dict] = None
    for event in events:
        if isinstance(event.get("model"), str):
            model = event["model"]
        candidate = event.get("usage")
        if isinstance(candidate, dict) and candidate:
            usage = candidate

    if usage is None:
        return None
    return _usage_record_from_openai_usage(provider, model, usage)


def parse_openai_chat_completions_response(
    provider: str,
    request_path: str,
    request_body: bytes,
    response_content_type: str,
    response_body: bytes,
) -> Optional[dict]:
    """Top-level entry point for OpenAI-compatible chat-completions.

    Shared by every provider that speaks the OpenAI chat-completions wire
    format — OpenAI itself (`/v1/chat/completions`) and Fireworks
    (`/inference/v1/chat/completions`, which fronts open-weight models like
    MiniMax-M3). `provider` is the label written onto the record so the
    evals pricer can key on `<provider>:<model>`; the caller derives it
    from the observed host.

    Returns `None` when the response carries no usage record — either
    because it isn't a chat-completions response or the body is malformed.
    `None` tells the addon to skip writing an NDJSON line.
    """
    # Match on the path component only, so a `?` query string can't defeat
    # the suffix check. Fireworks posts to `/inference/v1/chat/completions`
    # and OpenAI to `/v1/chat/completions`; both share the trailing
    # `/chat/completions`. Embeddings / models endpoints carry no usable
    # usage record and don't end in `/chat/completions`, so they're skipped.
    path_only = urlsplit(request_path).path
    if not path_only.endswith("/chat/completions"):
        return None
    # SSE streaming responses have content-type "text/event-stream".
    # Non-streaming responses are "application/json".
    if "text/event-stream" in response_content_type.lower():
        return _parse_openai_streaming(provider, response_body)
    if "application/json" in response_content_type.lower():
        return _parse_openai_non_streaming(provider, response_body)
    # Some intermediate proxies omit the content-type; fall back to
    # inspecting the request body's `stream` flag.
    try:
        req = json.loads(request_body) if request_body else {}
    except (json.JSONDecodeError, ValueError):
        req = {}
    if isinstance(req, dict) and req.get("stream") is True:
        return _parse_openai_streaming(provider, response_body)
    return _parse_openai_non_streaming(provider, response_body)


def _usage_record_from_responses_usage(
    provider: str,
    model: Optional[str],
    usage: dict,
) -> dict:
    """Project a Responses API `usage` object onto the evals record shape.

    `input_tokens` is the inclusive prompt count; the cached and
    cache-written subsets are nested under `input_tokens_details` and are
    hoisted to `cache_read_input_tokens` / `cache_creation_input_tokens`,
    matching the chat-completions projection so downstream consumers see
    one shape per provider family.
    """
    record: dict = {"provider": provider, "usage": usage}
    if model:
        record["model"] = model
    input_tokens = _coerce_int(usage.get("input_tokens"))
    output_tokens = _coerce_int(usage.get("output_tokens"))
    if input_tokens is not None:
        record["input_tokens"] = input_tokens
    if output_tokens is not None:
        record["output_tokens"] = output_tokens
    input_details = usage.get("input_tokens_details")
    if isinstance(input_details, dict):
        _hoist_openai_cache_details(record, input_details)
    return record


def _parse_responses_non_streaming(
    provider: str, response_body: bytes
) -> Optional[dict]:
    """Parse a non-streaming /v1/responses body."""
    try:
        payload = json.loads(response_body)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    model = payload.get("model")
    if not isinstance(model, str):
        model = None
    return _usage_record_from_responses_usage(provider, model, usage)


def _parse_responses_streaming(
    provider: str, response_body: bytes
) -> Optional[dict]:
    """Pull usage + model out of a Responses API SSE stream.

    The stream carries one JSON envelope per `data:` line, each with a
    `type` (`response.created`, `response.output_text.delta`, …). Only the
    terminal `response.completed` / `response.incomplete` envelopes carry a
    populated `response.usage`; earlier envelopes either omit it or carry
    `null`. The last envelope with a usage object wins so a truncated
    stream still yields whatever the server did report.
    """
    events = _parse_sse_events(response_body)
    if not events:
        return None

    model: Optional[str] = None
    usage: Optional[dict] = None
    for event in events:
        response = event.get("response")
        if not isinstance(response, dict):
            continue
        if isinstance(response.get("model"), str):
            model = response["model"]
        candidate = response.get("usage")
        if isinstance(candidate, dict) and candidate:
            usage = candidate

    if usage is None:
        return None
    return _usage_record_from_responses_usage(provider, model, usage)


def parse_openai_responses_response(
    provider: str,
    request_path: str,
    request_body: bytes,
    response_content_type: str,
    response_body: bytes,
) -> Optional[dict]:
    """Top-level entry point for the OpenAI Responses API.

    Returns `None` when the response carries no usage record, either
    because it isn't a `/v1/responses` response or the body is malformed.
    `None` tells the addon to skip writing an NDJSON line.
    """
    # Match on the path component only so a query string can't defeat the
    # suffix check. Sub-resources like `/v1/responses/<id>/input_items`
    # carry no usage and don't end in `/responses`.
    path_only = urlsplit(request_path).path
    if not path_only.endswith("/responses"):
        return None
    if "text/event-stream" in response_content_type.lower():
        return _parse_responses_streaming(provider, response_body)
    if "application/json" in response_content_type.lower():
        return _parse_responses_non_streaming(provider, response_body)
    # Some intermediate proxies omit the content-type; fall back to
    # inspecting the request body's `stream` flag.
    try:
        req = json.loads(request_body) if request_body else {}
    except (json.JSONDecodeError, ValueError):
        req = {}
    if isinstance(req, dict) and req.get("stream") is True:
        return _parse_responses_streaming(provider, response_body)
    return _parse_responses_non_streaming(provider, response_body)


def parse_openai_usage_response(
    provider: str,
    request_path: str,
    request_body: bytes,
    response_content_type: str,
    response_body: bytes,
) -> Optional[dict]:
    """Dispatch an OpenAI-family response to the parser its path implies.

    One host can serve both APIs (`api.openai.com` exposes
    `/v1/chat/completions` and `/v1/responses`), and the assistant's
    `openai` provider uses the Responses API while Fireworks and OpenRouter
    use chat-completions. Keying on the path rather than the host keeps the
    addon a one-line dispatch and lets a host move between APIs without a
    recorder change.
    """
    path_only = urlsplit(request_path).path
    if path_only.endswith("/responses"):
        return parse_openai_responses_response(
            provider=provider,
            request_path=request_path,
            request_body=request_body,
            response_content_type=response_content_type,
            response_body=response_body,
        )
    return parse_openai_chat_completions_response(
        provider=provider,
        request_path=request_path,
        request_body=request_body,
        response_content_type=response_content_type,
        response_body=response_body,
    )
