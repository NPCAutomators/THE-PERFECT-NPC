"""ACP auth helpers — detect and advertise Zorin authentication methods."""

from __future__ import annotations

from typing import Any, Optional


TERMINAL_SETUP_AUTH_METHOD_ID = "zorin-setup"


def detect_provider() -> Optional[str]:
    """Resolve the active Zorin runtime provider, or None if unavailable.

    Treats a ``Callable`` ``api_key`` (Azure Foundry Entra ID bearer
    token provider — see :mod:`agent.azure_identity_adapter`) as a valid
    credential. Without this, ACP sessions for Entra-configured Foundry
    deployments silently default to ``"openrouter"`` and the ACP auth
    handshake rejects the legitimate provider.
    """
    try:
        from zorin_cli.runtime_provider import resolve_runtime_provider
        runtime = resolve_runtime_provider()
        api_key = runtime.get("api_key")
        provider = runtime.get("provider")
        if not isinstance(provider, str) or not provider.strip():
            return None
        is_string_key = isinstance(api_key, str) and api_key.strip()
        is_callable_provider = callable(api_key) and not isinstance(api_key, str)
        if is_string_key or is_callable_provider:
            return provider.strip().lower()
    except Exception:
        return None
    return None


def has_provider() -> bool:
    """Return True if Zorin can resolve any runtime provider credentials."""
    return detect_provider() is not None


def build_auth_methods() -> list[Any]:
    """Return registry-compatible ACP auth methods for Zorin.

    The official ACP registry validates that agents advertise at least one
    usable auth method during the initial handshake. A fresh Zed install may
    not have Zorin provider credentials configured yet, so Zorin always
    advertises a terminal setup method. When credentials are already present,
    it also advertises the resolved provider as the default agent-managed
    runtime credential method.
    """
    from acp.schema import AuthMethodAgent, TerminalAuthMethod

    methods: list[Any] = []
    provider = detect_provider()
    if provider:
        methods.append(
            AuthMethodAgent(
                id=provider,
                name=f"{provider} runtime credentials",
                description=(
                    "Authenticate Zorin using the currently configured "
                    f"{provider} runtime credentials."
                ),
            )
        )

    methods.append(
        TerminalAuthMethod(
            id=TERMINAL_SETUP_AUTH_METHOD_ID,
            name="Configure Zorin provider",
            description=(
                "Open Zorin' interactive model/provider setup in a terminal. "
                "Use this when Zorin has not been configured on this machine yet."
            ),
            type="terminal",
            args=["--setup"],
        )
    )
    return methods
