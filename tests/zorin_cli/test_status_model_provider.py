"""Tests for zorin_cli.status model/provider display."""

from types import SimpleNamespace

from zorin_cli.npcautomators_account import NpcAutomatorsPaidServiceAccessInfo, NpcAutomatorsPortalAccountInfo
from zorin_cli.npcautomators_subscription import NpcAutomatorsFeatureState, NpcAutomatorsSubscriptionFeatures


def _patch_common_status_deps(monkeypatch, status_mod, tmp_path, *, openai_base_url=""):
    import zorin_cli.auth as auth_mod

    monkeypatch.setattr(status_mod, "get_env_path", lambda: tmp_path / ".env", raising=False)
    monkeypatch.setattr(status_mod, "get_zorin_home", lambda: tmp_path, raising=False)

    def _get_env_value(name: str):
        if name == "OPENAI_BASE_URL":
            return openai_base_url
        return ""

    monkeypatch.setattr(status_mod, "get_env_value", _get_env_value, raising=False)
    monkeypatch.setattr(auth_mod, "get_npcautomators_auth_status", lambda: {}, raising=False)
    monkeypatch.setattr(auth_mod, "get_codex_auth_status", lambda: {}, raising=False)
    monkeypatch.setattr(
        status_mod.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(stdout="inactive\n", returncode=3),
    )


def test_show_status_displays_configured_dict_model_and_provider_label(monkeypatch, capsys, tmp_path):
    from zorin_cli import status as status_mod

    _patch_common_status_deps(monkeypatch, status_mod, tmp_path)
    monkeypatch.setattr(
        status_mod,
        "load_config",
        lambda: {"model": {"default": "anthropic/claude-sonnet-4", "provider": "anthropic"}},
        raising=False,
    )
    monkeypatch.setattr(status_mod, "resolve_requested_provider", lambda requested=None: "anthropic", raising=False)
    monkeypatch.setattr(status_mod, "resolve_provider", lambda requested=None, **kwargs: "anthropic", raising=False)
    monkeypatch.setattr(status_mod, "provider_label", lambda provider: "Anthropic", raising=False)

    status_mod.show_status(SimpleNamespace(all=False, deep=False))

    out = capsys.readouterr().out
    assert "Model:        anthropic/claude-sonnet-4" in out
    assert "Provider:     Anthropic" in out


def test_show_status_displays_legacy_string_model_and_custom_endpoint(monkeypatch, capsys, tmp_path):
    from zorin_cli import status as status_mod

    _patch_common_status_deps(monkeypatch, status_mod, tmp_path, openai_base_url="http://localhost:8080/v1")
    monkeypatch.setattr(status_mod, "load_config", lambda: {"model": "qwen3:latest"}, raising=False)
    monkeypatch.setattr(status_mod, "resolve_requested_provider", lambda requested=None: "auto", raising=False)
    monkeypatch.setattr(status_mod, "resolve_provider", lambda requested=None, **kwargs: "openrouter", raising=False)
    monkeypatch.setattr(status_mod, "provider_label", lambda provider: "Custom endpoint" if provider == "custom" else provider, raising=False)

    status_mod.show_status(SimpleNamespace(all=False, deep=False))

    out = capsys.readouterr().out
    assert "Model:        qwen3:latest" in out
    assert "Provider:     Custom endpoint" in out


def test_show_status_reports_managed_npcautomators_features(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr("zorin_cli.status.managed_npcautomators_tools_enabled", lambda: True)
    from zorin_cli import status as status_mod

    _patch_common_status_deps(monkeypatch, status_mod, tmp_path)
    monkeypatch.setattr(
        status_mod,
        "load_config",
        lambda: {"model": {"default": "claude-opus-4-6", "provider": "npcautomators"}},
        raising=False,
    )
    monkeypatch.setattr(status_mod, "resolve_requested_provider", lambda requested=None: "npcautomators", raising=False)
    monkeypatch.setattr(status_mod, "resolve_provider", lambda requested=None, **kwargs: "npcautomators", raising=False)
    monkeypatch.setattr(status_mod, "provider_label", lambda provider: "NPCAUTOMATORS Portal", raising=False)
    monkeypatch.setattr(
        status_mod,
        "get_npcautomators_subscription_features",
        lambda config: NpcAutomatorsSubscriptionFeatures(
            subscribed=True,
            npcautomators_auth_present=True,
            provider_is_npcautomators=True,
            features={
                "web": NpcAutomatorsFeatureState("web", "Web tools", True, True, True, True, False, True, "firecrawl"),
                "image_gen": NpcAutomatorsFeatureState("image_gen", "Image generation", True, True, True, True, False, True, "NpcAutomators Subscription"),
                "video_gen": NpcAutomatorsFeatureState("video_gen", "Video generation", False, False, False, False, False, False, ""),
                "tts": NpcAutomatorsFeatureState("tts", "OpenAI TTS", True, True, True, True, False, True, "OpenAI TTS"),
                "stt": NpcAutomatorsFeatureState("stt", "Speech-to-text", True, True, True, True, False, True, "OpenAI Whisper"),
                "browser": NpcAutomatorsFeatureState("browser", "Browser automation", True, True, True, True, False, True, "Browser Use"),
                "modal": NpcAutomatorsFeatureState("modal", "Modal execution", False, True, False, False, False, True, "local"),
            },
        ),
        raising=False,
    )

    status_mod.show_status(SimpleNamespace(all=False, deep=False))

    out = capsys.readouterr().out
    assert "NpcAutomators Tool Gateway" in out
    assert "Browser automation" in out
    assert "active via NPCAUTOMATORS subscription" in out


def test_show_status_hides_npcautomators_subscription_section_when_feature_flag_is_off(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr("zorin_cli.status.managed_npcautomators_tools_enabled", lambda: False)
    from zorin_cli import status as status_mod

    _patch_common_status_deps(monkeypatch, status_mod, tmp_path)
    monkeypatch.setattr(
        status_mod,
        "load_config",
        lambda: {"model": {"default": "claude-opus-4-6", "provider": "npcautomators"}},
        raising=False,
    )
    monkeypatch.setattr(status_mod, "resolve_requested_provider", lambda requested=None: "npcautomators", raising=False)
    monkeypatch.setattr(status_mod, "resolve_provider", lambda requested=None, **kwargs: "npcautomators", raising=False)
    monkeypatch.setattr(status_mod, "provider_label", lambda provider: "NPCAUTOMATORS Portal", raising=False)

    status_mod.show_status(SimpleNamespace(all=False, deep=False))

    out = capsys.readouterr().out
    assert "NpcAutomators Tool Gateway" not in out


def test_show_status_reports_exhausted_npcautomators_credits(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr("zorin_cli.status.managed_npcautomators_tools_enabled", lambda: False)
    from zorin_cli import status as status_mod
    import zorin_cli.auth as auth_mod

    _patch_common_status_deps(monkeypatch, status_mod, tmp_path)
    monkeypatch.setattr(
        auth_mod,
        "get_npcautomators_auth_status",
        lambda: {
            "logged_in": False,
            "access_token": "jwt",
            "portal_base_url": "https://portal.example.test",
            "error": "credits exhausted",
            "error_code": "insufficient_credits",
        },
        raising=False,
    )
    monkeypatch.setattr(
        status_mod,
        "get_npcautomators_portal_account_info",
        lambda: NpcAutomatorsPortalAccountInfo(
            logged_in=True,
            source="account_api",
            fresh=True,
            paid_service_access=False,
            portal_base_url="https://portal.example.test",
            paid_service_access_info=NpcAutomatorsPaidServiceAccessInfo(
                allowed=False,
                reason="no_usable_credits",
                has_active_subscription=True,
                active_subscription_is_paid=True,
                subscription_credits_remaining=0,
                purchased_credits_remaining=0,
                total_usable_credits=0,
            ),
        ),
        raising=False,
    )
    monkeypatch.setattr(status_mod, "load_config", lambda: {"model": {"provider": "npcautomators"}}, raising=False)
    monkeypatch.setattr(status_mod, "resolve_requested_provider", lambda requested=None: "npcautomators", raising=False)
    monkeypatch.setattr(status_mod, "resolve_provider", lambda requested=None, **kwargs: "npcautomators", raising=False)
    monkeypatch.setattr(status_mod, "provider_label", lambda provider: "NPCAUTOMATORS Portal", raising=False)

    status_mod.show_status(SimpleNamespace(all=False, deep=False))

    out = capsys.readouterr().out
    assert "NpcAutomators Tool Gateway" in out
    assert "credits are exhausted" in out
    assert "https://portal.example.test/billing" in out
    assert "free-tier NPCAUTOMATORS account" not in out


def test_show_status_reports_empty_lmstudio_listing_as_reachable(monkeypatch, capsys, tmp_path):
    from zorin_cli import status as status_mod

    _patch_common_status_deps(monkeypatch, status_mod, tmp_path)
    monkeypatch.setattr(
        status_mod,
        "load_config",
        lambda: {
            "model": {
                "default": "qwen/qwen3-coder-30b",
                "provider": "lmstudio",
                "base_url": "http://127.0.0.1:1234/v1",
            }
        },
        raising=False,
    )
    monkeypatch.setattr(status_mod, "resolve_requested_provider", lambda requested=None: "lmstudio", raising=False)
    monkeypatch.setattr(status_mod, "resolve_provider", lambda requested=None, **kwargs: "lmstudio", raising=False)
    monkeypatch.setattr(status_mod, "provider_label", lambda provider: "LM Studio", raising=False)
    monkeypatch.setattr(
        "zorin_cli.models.probe_lmstudio_models",
        lambda api_key=None, base_url=None, timeout=5.0: [],
    )

    status_mod.show_status(SimpleNamespace(all=False, deep=False))

    out = capsys.readouterr().out
    assert "LM Studio" in out
    assert "reachable (0 model(s)) at http://127.0.0.1:1234/v1" in out
