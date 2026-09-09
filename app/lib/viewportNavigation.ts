import type { Viewport } from "./model";

const LINE_DELTA_PIXELS = 16;
const MIN_SCALE = 0.18;
const MAX_SCALE = 3;
const MAX_ZOOM_DELTA = 120;
const ZOOM_SENSITIVITY = 0.002;

type Point = { x: number; y: number };

export type WheelNavigation = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  pointer: Point;
  viewportWidth: number;
  viewportHeight: number;
};

export function wheelDeltaPixels(delta: number, deltaMode: number, pageSize: number) {
  if (deltaMode === 1) return delta * LINE_DELTA_PIXELS;
  if (deltaMode === 2) return delta * pageSize;
  return delta;
}

export function panViewport(viewport: Viewport, deltaX: number, deltaY: number): Viewport {
  return {
    ...viewport,
    x: viewport.x - deltaX,
    y: viewport.y - deltaY,
  };
}

export function zoomViewportAtPoint(
  viewport: Viewport,
  point: Point,
  factor: number,
): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewport.scale * factor));
  const worldX = (point.x - viewport.x) / viewport.scale;
  const worldY = (point.y - viewport.y) / viewport.scale;

  return {
    scale,
    x: point.x - worldX * scale,
    y: point.y - worldY * scale,
  };
}

export function navigateViewportWithWheel(
  viewport: Viewport,
  navigation: WheelNavigation,
): Viewport {
  let deltaX = wheelDeltaPixels(
    navigation.deltaX,
    navigation.deltaMode,
    navigation.viewportWidth,
  );
  let deltaY = wheelDeltaPixels(
    navigation.deltaY,
    navigation.deltaMode,
    navigation.viewportHeight,
  );

  // Browsers expose a trackpad pinch as a wheel event with Ctrl held. Meta also
  // supports the familiar Command + scroll gesture without changing pan behavior.
  if (navigation.ctrlKey || navigation.metaKey) {
    const zoomDelta = Math.min(MAX_ZOOM_DELTA, Math.max(-MAX_ZOOM_DELTA, deltaY));
    return zoomViewportAtPoint(
      viewport,
      navigation.pointer,
      Math.exp(-zoomDelta * ZOOM_SENSITIVITY),
    );
  }

  if (navigation.shiftKey && deltaX === 0) {
    deltaX = deltaY;
    deltaY = 0;
  }

  return panViewport(viewport, deltaX, deltaY);
}
