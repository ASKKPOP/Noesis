"""Sim-use provider — allowlist + money-guard + dry-run + live arm (Phase 76)."""

from __future__ import annotations

from typing import Any

from noesis_brain.bridge import SimUseProvider


class RecordingController:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def dispatch(self, verb: str, params: dict[str, Any]) -> None:
        self.calls.append((verb, params))


def test_rejects_verb_outside_allowlist() -> None:
    r = SimUseProvider().execute("rm_rf", {}, tick=1)
    assert r.ok is False and r.reason == "not_allowed"


def test_money_named_verb_is_blocked() -> None:
    # A money-named verb is not in the allowlist, so it is rejected outright
    # (allowlist is the tighter gate; money can never be driven either way).
    r = SimUseProvider().execute("transfer", {}, tick=1)
    assert r.ok is False and r.reason == "not_allowed"


def test_money_axiom_guard_on_params() -> None:
    r = SimUseProvider().execute("type_text", {"text": "open my wallet app"}, tick=1)
    assert r.ok is False and r.reason == "money_axiom"


def test_dry_run_by_default_touches_nothing() -> None:
    ctrl = RecordingController()
    # Granted-but-not-armed: even with a controller, execution is dry-run.
    prov = SimUseProvider(live=False, controller=ctrl)
    r = prov.execute("click", {"x": 10, "y": 20}, tick=1)
    assert r.ok is True and r.dry_run is True
    assert ctrl.calls == []  # nothing dispatched


def test_live_arm_dispatches_to_controller() -> None:
    ctrl = RecordingController()
    prov = SimUseProvider(live=True, controller=ctrl)
    r = prov.execute("type_text", {"text": "hello world"}, tick=1)
    assert r.ok is True and r.dry_run is False
    assert ctrl.calls == [("type_text", {"text": "hello world"})]


def test_live_without_controller_degrades_to_dry_run() -> None:
    # Armed but no controller (pyautogui absent) → honest dry-run, never crashes.
    prov = SimUseProvider(live=True, controller=None)
    # Only true if pyautogui is genuinely absent (it is, in this env).
    r = prov.execute("click", {"x": 1, "y": 2}, tick=1)
    assert r.ok is True and r.dry_run is True
    assert r.reason == "controller_unavailable"


def test_dispatch_failure_reported() -> None:
    class Boom:
        def dispatch(self, verb: str, params: dict[str, Any]) -> None:
            raise RuntimeError("screen locked")

    prov = SimUseProvider(live=True, controller=Boom())
    r = prov.execute("screenshot", {}, tick=1)
    assert r.ok is False and r.reason == "dispatch_failed"
