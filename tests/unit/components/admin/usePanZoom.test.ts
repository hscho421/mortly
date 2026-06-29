import { describe, it, expect } from "vitest";
import { clampTransform, zoomToward, MIN_K, MAX_K } from "@/components/admin/usePanZoom";

const VB_W = 900;
const VB_H = 460;

describe("usePanZoom math", () => {
  describe("clampTransform", () => {
    it("clamps zoom (k) to [MIN_K, MAX_K]", () => {
      expect(clampTransform({ k: 0.2, x: 0, y: 0 }, VB_W, VB_H).k).toBe(MIN_K);
      expect(clampTransform({ k: 99, x: 0, y: 0 }, VB_W, VB_H).k).toBe(MAX_K);
    });

    it("bounds pan so the content can't be dragged fully off-screen", () => {
      // At k=1 the allowed range is ±0.3·viewport.
      const maxX = 0.3 * VB_W; // 270
      const maxY = 0.3 * VB_H; // 138
      expect(clampTransform({ k: 1, x: 9999, y: 9999 }, VB_W, VB_H)).toMatchObject({
        x: maxX,
        y: maxY,
      });
      expect(clampTransform({ k: 1, x: -9999, y: -9999 }, VB_W, VB_H)).toMatchObject({
        x: -maxX,
        y: -maxY,
      });
    });

    it("leaves an in-range transform untouched", () => {
      expect(clampTransform({ k: 2, x: 50, y: -30 }, VB_W, VB_H)).toEqual({ k: 2, x: 50, y: -30 });
    });
  });

  describe("zoomToward", () => {
    it("zooms in and keeps the focal point fixed under the cursor", () => {
      const p = { x: 450, y: 230 }; // cursor in viewBox space
      const next = zoomToward({ k: 1, x: 0, y: 0 }, p, 2, VB_W, VB_H);
      expect(next.k).toBe(2);
      // The g maps child c -> x + k*c; the focal point must map to the same
      // screen position before (450) and after.
      const screenAfterX = next.x + next.k * p.x;
      const screenAfterY = next.y + next.k * p.y;
      expect(screenAfterX).toBeCloseTo(450, 5);
      expect(screenAfterY).toBeCloseTo(230, 5);
    });

    it("never zooms out past MIN_K", () => {
      const next = zoomToward({ k: 1, x: 0, y: 0 }, { x: 450, y: 230 }, 0.5, VB_W, VB_H);
      expect(next.k).toBe(MIN_K);
    });

    it("never zooms in past MAX_K", () => {
      const next = zoomToward({ k: 6, x: 0, y: 0 }, { x: 450, y: 230 }, 4, VB_W, VB_H);
      expect(next.k).toBe(MAX_K);
    });
  });
});
