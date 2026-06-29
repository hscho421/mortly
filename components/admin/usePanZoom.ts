import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * usePanZoom — drag-to-pan + scroll/button-to-zoom for an SVG map.
 *
 * The returned `transform` goes on a <g> wrapping the map content; `bind` is
 * spread onto the <svg>. All math runs in the SVG's viewBox coordinate space
 * (via getScreenCTM) so it's correct regardless of the rendered/resized size.
 * The pure helpers (clampTransform/zoomToward) are exported for unit testing.
 */

export interface Transform {
  k: number;
  x: number;
  y: number;
}

export const MIN_K = 1;
export const MAX_K = 8;

// How far the scaled content may be dragged past the viewport edge, as a
// fraction of the viewport. Keeps some map visible while still feeling draggable
// at minimum zoom.
const ALLOW = 0.3;

export function clampTransform(
  t: Transform,
  vbW: number,
  vbH: number,
  minK = MIN_K,
  maxK = MAX_K,
): Transform {
  const k = Math.max(minK, Math.min(maxK, t.k));
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
  const k = Math.max(minK, Math.min(maxK, prev.k * factor));
  const ratio = k / prev.k;
  const x = p.x - ratio * (p.x - prev.x);
  const y = p.y - ratio * (p.y - prev.y);
  return clampTransform({ k, x, y }, vbW, vbH, minK, maxK);
}

export function usePanZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  vbW: number,
  vbH: number,
) {
  const [t, setT] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const tRef = useRef(t);
  tRef.current = t;
  const drag = useRef<{ px: number; py: number; ox: number; oy: number; scale: number } | null>(null);

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

  // Wheel is attached natively (non-passive) so preventDefault stops the page
  // from scrolling while zooming the map.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = toViewBox(e.clientX, e.clientY);
      if (!v) return;
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      setT((prev) => zoomToward(prev, v, factor, vbW, vbH));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef, toViewBox, vbW, vbH]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const v = toViewBox(e.clientX, e.clientY);
      drag.current = {
        px: e.clientX,
        py: e.clientY,
        ox: tRef.current.x,
        oy: tRef.current.y,
        scale: v?.scale || 1,
      };
      setPanning(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [toViewBox],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const d = drag.current;
      if (!d) return;
      const s = d.scale || 1;
      const dx = (e.clientX - d.px) / s;
      const dy = (e.clientY - d.py) / s;
      setT((prev) => clampTransform({ k: prev.k, x: d.ox + dx, y: d.oy + dy }, vbW, vbH));
    },
    [vbW, vbH],
  );

  const endPan = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setPanning(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => setT((prev) => zoomToward(prev, { x: vbW / 2, y: vbH / 2 }, factor, vbW, vbH)),
    [vbW, vbH],
  );

  const reset = useCallback(() => setT({ k: 1, x: 0, y: 0 }), []);

  return {
    transform: `translate(${t.x} ${t.y}) scale(${t.k})`,
    panning,
    k: t.k,
    isZoomed: t.k > 1.001 || Math.abs(t.x) > 0.5 || Math.abs(t.y) > 0.5,
    bind: { onPointerDown, onPointerMove, onPointerUp: endPan, onPointerLeave: endPan },
    zoomIn: () => zoomBy(1.4),
    zoomOut: () => zoomBy(1 / 1.4),
    reset,
  };
}
