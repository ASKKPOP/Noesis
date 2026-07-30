"""Supervision provider (aisthesis bridge) — a real camera frame → a percept.

Bridges the operator's real camera into perception. Privacy-first: a frame is
reduced to a *coarse* descriptor (mean brightness, motion vs the previous
frame, dimensions) and yields a single `CHANGED` `Percept` ("the room got
brighter"). No face identification, no image is ever stored or journaled — only
the descriptor's digest.

Seam: a `frame_source` callable returns a frame (a 2-D sequence of pixel rows,
or any object exposing `.shape`/mean). Real deployments wrap `cv2.VideoCapture`;
tests inject a synthetic frame. `cv2` absent and no injected source ⇒
`available()` is false and the faculty simply never gets a supervision percept.
"""

from __future__ import annotations

from typing import Any, Callable

from noesis_brain.aisthesis.types import Percept, PerceptKind
from noesis_brain.bridge.types import BridgeCapability

FrameSource = Callable[[], Any]


def _cv2_available() -> bool:
    try:
        import cv2  # noqa: F401
        return True
    except Exception:
        return False


def _mean_brightness(frame: Any) -> float:
    """Mean pixel value of a frame, defensively (numpy array or nested lists)."""
    try:
        mean = getattr(frame, "mean", None)
        if callable(mean):
            return float(mean())
    except Exception:
        pass
    # Nested-sequence fallback.
    total = 0.0
    count = 0
    for row in frame or []:
        for px in row if hasattr(row, "__iter__") else [row]:
            if isinstance(px, (int, float)):
                total += float(px)
                count += 1
            elif hasattr(px, "__iter__"):
                for ch in px:
                    total += float(ch)
                    count += 1
    return total / count if count else 0.0


class SupervisionProvider:
    capability = BridgeCapability.SUPERVISION

    # A brightness change of at least this fraction counts as salient motion.
    _MOTION_FLOOR = 0.05

    def __init__(self, frame_source: FrameSource | None = None) -> None:
        self._frame_source = frame_source
        self._last_brightness: float | None = None

    def available(self) -> bool:
        return self._frame_source is not None or _cv2_available()

    def observe(self, tick: int) -> Percept | None:
        """Capture one frame and yield a coarse-change percept, or None."""
        if self._frame_source is None:
            return None  # no live capture wired here (real cv2 source is future)
        try:
            frame = self._frame_source()
        except Exception:
            return None
        if frame is None:
            return None
        brightness = _mean_brightness(frame)
        prev = self._last_brightness
        self._last_brightness = brightness
        if prev is None:
            return None  # first frame is a baseline, not a change (mirrors aisthesis)
        delta = abs(brightness - prev) / max(prev, 1.0)
        if delta < self._MOTION_FLOOR:
            return None
        direction = "brighter" if brightness > prev else "darker"
        salience = min(0.6, 0.2 + delta)
        return Percept(
            kind=PerceptKind.CHANGED,
            subject="camera:operator",
            label=f"the room got {direction}",
            zone="",
            salience=salience,
        )

    def digest(self, percept: Percept | None) -> str:
        """Privacy-safe journal digest — the coarse label only, never the frame."""
        return percept.label if percept is not None else "no salient change"
