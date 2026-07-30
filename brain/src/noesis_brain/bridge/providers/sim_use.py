"""Sim-use provider (praxis bridge) — drive real apps on operator hardware.

The highest-risk provider: it can move the operator's mouse and type on the
operator's keyboard. Every safeguard is layered here:

1. **Closed verb allowlist** — only `screenshot / move_to / click / type_text /
   key`. Anything else is rejected.
2. **Money-axiom guard** — any verb or parameter matching
   `trade|transfer|wallet|treasury|account` is rejected. The real machine must
   never be driven to move money (mirrors the `ToolRegistry` tool-name guard).
3. **Dry-run by default** — even when `sim_use` is granted, execution is dry-run
   (validate + journal the *intended* act, touch nothing) until the operator
   *also* arms `sim_use_live: true`. Dry-run is a real safety mode, not a stub.
4. **Controller seam** — live dispatch goes to a `Controller` (real: `pyautogui`;
   tests: a recording fake). `pyautogui` absent ⇒ no live controller ⇒ every
   call degrades to dry-run, honestly reported.
"""

from __future__ import annotations

import re
from typing import Any, Protocol

from noesis_brain.bridge.types import BridgeCapability, BridgeResult

ALLOWED_VERBS: frozenset[str] = frozenset(
    {"screenshot", "move_to", "click", "type_text", "key"}
)

# Same money-axiom class the ToolRegistry forbids — never drive money on the box.
_MONEY_RE = re.compile(r"trade|transfer|wallet|treasury|account", re.IGNORECASE)


class Controller(Protocol):
    """Minimal real-input surface (a subset of pyautogui)."""

    def dispatch(self, verb: str, params: dict[str, Any]) -> None: ...


def _pyautogui_controller() -> Controller | None:
    try:
        import pyautogui
    except Exception:
        return None

    class _PyAutoGui:
        def dispatch(self, verb: str, params: dict[str, Any]) -> None:
            if verb == "screenshot":
                pyautogui.screenshot()
            elif verb == "move_to":
                pyautogui.moveTo(params.get("x", 0), params.get("y", 0))
            elif verb == "click":
                pyautogui.click(params.get("x"), params.get("y"))
            elif verb == "type_text":
                pyautogui.typewrite(str(params.get("text", "")))
            elif verb == "key":
                pyautogui.press(str(params.get("key", "")))

    return _PyAutoGui()


class SimUseProvider:
    capability = BridgeCapability.SIM_USE

    def __init__(self, *, live: bool = False, controller: Controller | None = None) -> None:
        self._live = bool(live)
        # A test may inject a controller; otherwise try the real one (absent here).
        self._controller = controller if controller is not None else _pyautogui_controller()

    def available(self) -> bool:
        # Always usable: dry-run validation is a legitimate, always-safe capability.
        # Live execution additionally needs the arm flag AND a controller.
        return True

    def _money_tainted(self, verb: str, params: dict[str, Any]) -> bool:
        if _MONEY_RE.search(verb):
            return True
        for v in params.values():
            if isinstance(v, str) and _MONEY_RE.search(v):
                return True
        return False

    def execute(self, verb: str, params: dict[str, Any] | None, tick: int) -> BridgeResult:
        params = params or {}
        if verb not in ALLOWED_VERBS:
            return BridgeResult(ok=False, reason="not_allowed", digest=verb)
        if self._money_tainted(verb, params):
            return BridgeResult(ok=False, reason="money_axiom", digest=verb)
        # Dry-run unless explicitly armed AND a real controller exists.
        if not self._live or self._controller is None:
            reason = "dry_run" if self._live else ""
            if self._live and self._controller is None:
                reason = "controller_unavailable"
            return BridgeResult(ok=True, dry_run=True, reason=reason, digest=verb)
        try:
            self._controller.dispatch(verb, params)
        except Exception:
            return BridgeResult(ok=False, reason="dispatch_failed", digest=verb)
        return BridgeResult(ok=True, dry_run=False, digest=verb)
