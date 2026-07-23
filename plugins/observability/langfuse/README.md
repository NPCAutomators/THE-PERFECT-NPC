# Langfuse Observability Plugin

This plugin ships bundled with Zorin but is **opt-in** — it only loads when
you explicitly enable it.

## Enable

Pick one:

```bash
# Interactive: walks you through credentials + SDK install + enable
zorin tools  # → Langfuse Observability

# Manual
pip install langfuse
zorin plugins enable observability/langfuse
```

## Required credentials

Set these in `~/.zorin/.env` (or via `zorin tools`):

```bash
ZORIN_LANGFUSE_PUBLIC_KEY=pk-lf-...
ZORIN_LANGFUSE_SECRET_KEY=sk-lf-...
ZORIN_LANGFUSE_BASE_URL=https://cloud.langfuse.com   # or your self-hosted URL
```

Without the SDK or credentials the hooks no-op silently — the plugin fails
open.

## Verify

```bash
zorin plugins list                 # observability/langfuse should show "enabled"
zorin chat -q "hello"              # then check Langfuse for a "Zorin turn" trace
```

## Optional tuning

```bash
ZORIN_LANGFUSE_ENV=production       # environment tag
ZORIN_LANGFUSE_RELEASE=v1.0.0       # release tag
ZORIN_LANGFUSE_SAMPLE_RATE=0.5      # sample 50% of traces
ZORIN_LANGFUSE_MAX_CHARS=12000      # max chars per field (default: 12000)
ZORIN_LANGFUSE_DEBUG=true           # verbose plugin logging
```

## Disable

```bash
zorin plugins disable observability/langfuse
```
