import { describe, expect, it } from "vitest";
import {
  navigateViewportWithWheel,
  panViewport,
  wheelDeltaPixels,
  zoomViewportAtPoint,
} from "./viewportNavigation";

const viewport = { x: 90, y: 70, scale: 1 };

describe("touchpad viewport navigation", () => {
  it("pans in both axes without changing zoom", () => {
    expect(panViewport(viewport, 24, -12)).toEqual({ x: 66, y: 82, scale: 1 });

    expect(navigateViewportWithWheel(viewport, {
      deltaX: 24,
      deltaY: -12,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      pointer: { x: 400, y: 300 },
      viewportWidth: 1000,
      viewportHeight: 800,
    })).toEqual({ x: 66, y: 82, scale: 1 });
  });

  it("uses vertical Shift + wheel input for horizontal panning", () => {
    expect(navigateViewportWithWheel(viewport, {
      deltaX: 0,
      deltaY: 30,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      pointer: { x: 400, y: 300 },
      viewportWidth: 1000,
      viewportHeight: 800,
    })).toEqual({ x: 60, y: 70, scale: 1 });
  });

  it("keeps the canvas point beneath a pinch stationary", () => {
    const pointer = { x: 430, y: 310 };
    const worldBefore = {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale,
    };
    const next = navigateViewportWithWheel(viewport, {
      deltaX: 0,
      deltaY: -80,
      deltaMode: 0,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      pointer,
      viewportWidth: 1000,
      viewportHeight: 800,
    });

    expect(next.scale).toBeGreaterThan(viewport.scale);
    expect((pointer.x - next.x) / next.scale).toBeCloseTo(worldBefore.x);
    expect((pointer.y - next.y) / next.scale).toBeCloseTo(worldBefore.y);
  });

  it("clamps zoom to the supported scale range", () => {
    expect(zoomViewportAtPoint({ x: 0, y: 0, scale: 2.99 }, { x: 0, y: 0 }, 2).scale).toBe(3);
    expect(zoomViewportAtPoint({ x: 0, y: 0, scale: 0.19 }, { x: 0, y: 0 }, 0.1).scale).toBe(0.18);
  });

  it("normalizes line and page wheel deltas", () => {
    expect(wheelDeltaPixels(2, 0, 800)).toBe(2);
    expect(wheelDeltaPixels(2, 1, 800)).toBe(32);
    expect(wheelDeltaPixels(2, 2, 800)).toBe(1600);
  });
});
