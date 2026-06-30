import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * usePanZoom — pan + zoom for an SVG map, without trapping page scroll:
 *   • mouse:    ⌘/Ctrl+wheel to zoom, drag to pan (plain wheel scrolls the page)
 *   • trackpad: pinch to zoom (sends ctrl+wheel), click-drag to pan
 *   • touch:    one finger scrolls the PAGE; two fingers pinch-zoom + pan the map
 *
 * Zoom only engages with a modifier / second finger, so a normal scroll always
 * passes through to the page (the map is full-width and must not scroll-jack).
 *
 * The returned `transform` goes on a <g> wrapping the map content; `bind` is
 * spread onto the <svg>. All math runs in the SVG's viewBox coordinate space
 * (via getScreenCTM). Pure helpers (clampTransform / zoomToward / wheelZoomFactor)
 * are exported for unit testing.
 */

export interface Transform {
  k: number;
  x: number;
  y: number;
}

export const MIN_K = 1;
// High enough to separate dense city clusters (e.g. the GTA) when drilling in.
export const MAX_K = 20;

// How far the scaled content may be dragged past the viewport edge, as a
// fraction of the viewport.
const ALLOW = 0.3;

const clampK = (k: number, minK: number, maxK: number) => Math.max(minK, Math.min(maxK, k));

export function clampTransform(
  t: Transform,
  vbW: number,
  vbH: number,
  minK = MIN_K,
  maxK = MAX_K,
): Transform {
  const k = clampK(t.k, minK, maxK);
  const minX = (1 - ALLOW) * vbW - k * vbW;
  const maxX = ALLOW * vbW;
  const minY = (1 - ALLOW) * vbH - k * vbH;
  const maxY = ALLOW * vbH;
  return {
    k,
    x: Math.min(maxX, Math.max(minX, t.x)),
    y: Math.min(maxY, Math.max(minY, t.y)),
  };
}

/** Zoom by `factor` while keeping the viewBox point `p` fixed under the cursor. */
export function zoomToward(
  prev: Transform,
  p: { x: number; y: number },
  factor: number,
  vbW: number,
  vbH: number,
  minK = MIN_K,
  maxK = MAX_K,
): Transform {
  const k = clampK(prev.k * factor, minK, maxK);
  const ratio = k / prev.k;
  const x = p.x - ratio * (p.x - prev.x);
  const y = p.y - ratio * (p.y - prev.y);
  return clampTransform({ k, x, y }, vbW, vbH, minK, maxK);
}

/** Per-wheel-event zoom factor (>1 zooms in, <1 out). */
export function wheelZoomFactor(deltaY: number, intensity = 0.01): number {
  return Math.exp(-deltaY * intensity);
}

type Pointer = { x: number; y: number; type: string };
type Gesture =
  | { type: "pan"; sx: number; sy: number; ox: number; oy: number; scale: number }
  | { type: "pinch"; startDist: number; k0: number; c0x: number; c0y: number }
  | null;

export function usePanZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  vbW: number,
  vbH: number,
) {
  const [t, setT] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const tRef = useRef(t);
  tRef.current = t;
  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef<Gesture>(null);

  const toViewBox = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const v = pt.matrixTransform(ctm.inverse());
      return { x: v.x, y: v.y, scale: ctm.a || 1 };
    },
    [svgRef],
  );

  // (Re)establish the gesture baseline whenever the active-pointer count changes.
  // A single TOUCH finger is left alone so the page can scroll (touch-action:
  // pan-y); a mouse/pen drag pans; two pointers pinch.
  const syncGesture = useCallback(() => {
    const pts = [...pointers.current.values()];
    if (pts.length === 1 && pts[0].type !== "touch") {
      const v = toViewBox(pts[0].x, pts[0].y);
      gesture.current = {
        type: "pan",
        sx: pts[0].x,
        sy: pts[0].y,
        ox: tRef.current.x,
        oy: tRef.current.y,
        scale: v?.scale || 1,
      };
      setActive(true);
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2);
      const { k, x, y } = tRef.current;
      gesture.current = {
        type: "pinch",
        startDist: dist,
        k0: k,
        c0x: mid ? (mid.x - x) / k : 0, // content point under the pinch midpoint
        c0y: mid ? (mid.y - y) / k : 0,
      };
      setActive(true);
    } else {
      gesture.current = null;
      setActive(false);
    }
  }, [toViewBox]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      // Capturing a touch pointer would block the browser's page scroll; only
      // capture mouse/pen so a drag-pan keeps tracking outside the element.
      if (e.pointerType !== "touch") e.currentTarget.setPointerCapture?.(e.pointerId);
      syncGesture();
    },
    [syncGesture],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      const g = gesture.current;
      if (!g) return;
      if (g.type === "pan") {
        const p = [...pointers.current.values()][0];
        const s = g.scale || 1;
        setT((prev) => clampTransform({ k: prev.k, x: g.ox + (p.x - g.sx) / s, y: g.oy + (p.y - g.sy) / s }, vbW, vbH));
      } else {
        const pts = [...pointers.current.values()];
        if (pts.length < 2) return;
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (!mid) return;
        // Absolute (non-compounding) zoom: spread now vs. spread at gesture start.
        const k = clampK((g.k0 * dist) / g.startDist, MIN_K, MAX_K);
        setT(() => clampTransform({ k, x: mid.x - k * g.c0x, y: mid.y - k * g.c0y }, vbW, vbH));
      }
    },
    [toViewBox, vbW, vbH],
  );

  const endPointer = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      syncGesture();
    },
    [syncGesture],
  );

  // Wheel is native (non-passive) so we can preventDefault — but ONLY when a
  // modifier is held (⌘/Ctrl, which trackpad pinch also sets). A plain wheel is
  // left untouched so it scrolls the page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const v = toViewBox(e.clientX, e.clientY);
      if (!v) return;
      setT((prev) => zoomToward(prev, v, wheelZoomFactor(e.deltaY), vbW, vbH));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef, toViewBox, vbW, vbH]);

  const zoomBy = useCallback(
    (factor: number) => setT((prev) => zoomToward(prev, { x: vbW / 2, y: vbH / 2 }, factor, vbW, vbH)),
    [vbW, vbH],
  );

  const reset = useCallback(() => setT({ k: 1, x: 0, y: 0 }), []);
  const transform = useMemo(() => `translate(${t.x} ${t.y}) scale(${t.k})`, [t]);

  return {
    transform,
    panning: active,
    k: t.k,
    isZoomed: t.k > 1.001 || Math.abs(t.x) > 0.5 || Math.abs(t.y) > 0.5,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
    zoomIn: () => zoomBy(1.4),
    zoomOut: () => zoomBy(1 / 1.4),
    reset,
  };
}
