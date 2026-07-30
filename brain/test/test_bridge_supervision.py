"""Supervision provider — camera frame → coarse percept (Phase 76).

Live cv2 capture is unverifiable here; logic is exercised via an injected frame
source. Frames are plain nested lists (grayscale pixel rows) so no numpy is
needed.
"""

from __future__ import annotations

from noesis_brain.aisthesis.types import PerceptKind
from noesis_brain.bridge import SupervisionProvider


def _frame(value: float, w: int = 4, h: int = 4) -> list[list[float]]:
    return [[value] * w for _ in range(h)]


def test_unavailable_without_source_or_cv2() -> None:
    # No injected source and cv2 absent in this env → unavailable.
    prov = SupervisionProvider(frame_source=None)
    # available() may be True only if cv2 is importable; here it should be False.
    assert prov.available() is False


def test_available_with_injected_source() -> None:
    prov = SupervisionProvider(frame_source=lambda: _frame(100))
    assert prov.available() is True


def test_first_frame_is_baseline() -> None:
    prov = SupervisionProvider(frame_source=lambda: _frame(100))
    assert prov.observe(tick=1) is None  # baseline, not a change


def test_detects_brightening() -> None:
    frames = iter([_frame(50), _frame(200)])
    prov = SupervisionProvider(frame_source=lambda: next(frames))
    assert prov.observe(tick=1) is None  # baseline
    p = prov.observe(tick=2)
    assert p is not None
    assert p.kind is PerceptKind.CHANGED
    assert "brighter" in p.label
    assert 0.0 < p.salience <= 0.6


def test_ignores_tiny_change() -> None:
    frames = iter([_frame(100), _frame(101)])  # ~1% change < motion floor
    prov = SupervisionProvider(frame_source=lambda: next(frames))
    prov.observe(tick=1)
    assert prov.observe(tick=2) is None


def test_digest_is_label_only() -> None:
    frames = iter([_frame(50), _frame(10)])
    prov = SupervisionProvider(frame_source=lambda: next(frames))
    prov.observe(tick=1)
    p = prov.observe(tick=2)
    assert "darker" in prov.digest(p)
    assert prov.digest(None) == "no salient change"
