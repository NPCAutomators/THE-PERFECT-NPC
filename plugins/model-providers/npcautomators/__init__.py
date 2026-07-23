"""NPCAUTOMATORS Portal provider profile."""

from typing import Any

from agent.portal_tags import npcautomators_portal_tags
from providers import register_provider
from providers.base import ProviderProfile


class NpcAutomatorsProfile(ProviderProfile):
    """NPCAUTOMATORS Portal — product tags, reasoning with NpcAutomators-specific omission."""

    def build_extra_body(
        self, *, session_id: str | None = None, **context
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"tags": npcautomators_portal_tags(session_id=session_id)}
        if session_id:
            # Top-level session_id → provider sticky routing key. Pins every
            # turn of a session to the same upstream endpoint so explicit
            # Anthropic cache_control breakpoints stay warm instead of
            # cold-writing a fresh cache on each reroute (Anthropic/Vertex/
            # Bedrock caches are instance-local). Mirrors the OpenRouter
            # profile; without it the portal falls back to hashing the opening
            # messages, which breaks pinning whenever those shift.
            body["session_id"] = session_id
        provider_preferences = context.get("provider_preferences")
        if provider_preferences:
            body["provider"] = provider_preferences
        return body

    def build_api_kwargs_extras(
        self,
        *,
        reasoning_config: dict | None = None,
        supports_reasoning: bool = False,
        **context,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """NpcAutomators: passes full reasoning_config, but OMITS when disabled."""
        extra_body = {}
        if supports_reasoning:
            if reasoning_config is not None:
                rc = dict(reasoning_config)
                if rc.get("enabled") is False:
                    pass  # NpcAutomators omits reasoning when disabled
                else:
                    extra_body["reasoning"] = rc
            else:
                extra_body["reasoning"] = {"enabled": True, "effort": "medium"}
        return extra_body, {}


npcautomators = NpcAutomatorsProfile(
    name="npcautomators",
    aliases=("npcautomators-portal", "npcautomators"),
    env_vars=("NPCAUTOMATORS_API_KEY",),
    display_name="NPCAUTOMATORS",
    description="NPCAUTOMATORS — Zorin model family",
    signup_url="https://npcautomators.com/",
    fallback_models=(
        "zorin-3-405b",
        "zorin-3-70b",
    ),
    base_url="https://inference-api.npcautomators.com/v1",
    auth_type="oauth_device_code",
)

register_provider(npcautomators)
