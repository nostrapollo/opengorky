"use client";

import Konva from "konva";
import { useEffect, useLayoutEffect, useRef } from "react";
import type {
  CanvasDocument,
  CanvasObject,
  ObjectKind,
  Tool,
  Viewport,
} from "../lib/model";
import { connectorEndpoints } from "../lib/model";
import { gcpIconUrl } from "../lib/gcpCatalog";
import {
  processShapePaths,
  processShapeTextInsets,
  type ProcessShapeKind,
} from "../lib/processShapes";

type KonvaSurfaceProps = {
  document: CanvasDocument;
  width: number;
  height: number;
  tool: Tool;
  processShape: ProcessShapeKind;
  viewport: Viewport;
  selectedIds: string[];
  editingId: string | null;
  onViewportChange: (viewport: Viewport) => void;
  onSelect: (objectIds: string[]) => void;
  onObjectActivate: (objectId: string) => void;
  onObjectFollow: (objectId: string) => void;
  onObjectDoubleClick: (objectId: string) => void;
  onObjectContextMenu: (objectId: string, x: number, y: number) => void;
  onCreate: (kind: ObjectKind, x: number, y: number, width?: number, height?: number) => void;
  onTransform: (objectId: string, patch: Partial<CanvasObject>) => void;
  onDuplicate: (objectId: string, offset?: { x: number; y: number }) => void;
};

type Scene = {
  stage: Konva.Stage;
  connectorLayer: Konva.Layer;
  objectLayer: Konva.Layer;
  selectionLayer: Konva.Layer;
  transformer: Konva.Transformer;
  nodes: Map<string, Konva.Group>;
  connectors: Map<string, Konva.Arrow>;
};

function updateConnectorPositions(
  scene: Scene,
  document: CanvasDocument,
  activeObjectId?: string,
) {
  for (const connector of document.connectors) {
    if (
      activeObjectId &&
      connector.fromId !== activeObjectId &&
      connector.toId !== activeObjectId
    ) {
      continue;
    }
    const arrow = scene.connectors.get(connector.id);
    const from = scene.nodes.get(connector.fromId);
    const to = scene.nodes.get(connector.toId);
    if (!arrow || !from || !to) continue;
    const fromObject = document.objects.find((object) => object.id === connector.fromId);
    const toObject = document.objects.find((object) => object.id === connector.toId);
    if (!fromObject || !toObject) continue;
    const liveObject = (object: CanvasObject, group: Konva.Group): CanvasObject => ({
      ...object,
      x: group.x(),
      y: group.y(),
      width: group.width() * group.scaleX(),
      height: group.height() * group.scaleY(),
      rotation: group.rotation(),
    });
    const [start, end] = connectorEndpoints(liveObject(fromObject, from), liveObject(toObject, to));
    arrow.points([start.x, start.y, end.x, end.y]);
  }
  scene.connectorLayer.batchDraw();
}

function paintGroup(group: Konva.Group, object: CanvasObject) {
  group.setAttrs({
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
  });

  const body = group.findOne<Konva.Shape>(".body");
  const processDetail = group.findOne<Konva.Path>(".process-detail");
  const fold = group.findOne<Konva.Line>(".fold");
  const label = group.findOne<Konva.Text>(".label");
  const cardKicker = group.findOne<Konva.Text>(".card-kicker");
  const cardTitle = group.findOne<Konva.Text>(".card-title");
  const cardBody = group.findOne<Konva.Text>(".card-body");
  const linkButton = group.findOne<Konva.Rect>(".link-button");
  const linkButtonLabel = group.findOne<Konva.Text>(".link-button-label");
  const gcpIcon = group.findOne<Konva.Image>(".gcp-icon");
  const gcpKicker = group.findOne<Konva.Text>(".gcp-kicker");
  if (!body || !label) return;

  body.setAttrs({
    fill: object.fill,
    stroke: object.kind === "rich-card" ? "rgba(35,38,47,0.12)" : object.stroke,
    strokeWidth: object.kind === "sticky" ? 1.5 : 2,
    shadowColor: "#15171c",
    shadowBlur: object.kind === "sticky" || object.kind === "rich-card" || object.kind === "link" ? 12 : object.kind === "gcp-service" ? 8 : 0,
    shadowOpacity: object.kind === "sticky" ? 0.12 : object.kind === "rich-card" || object.kind === "link" ? 0.08 : object.kind === "gcp-service" ? 0.06 : 0,
    shadowOffsetY: object.kind === "sticky" || object.kind === "rich-card" || object.kind === "link" ? 6 : object.kind === "gcp-service" ? 3 : 0,
  });
  if (body instanceof Konva.Ellipse) {
    body.setAttrs({
      x: object.width / 2,
      y: object.height / 2,
      radiusX: object.width / 2,
      radiusY: object.height / 2,
    });
  } else if (body instanceof Konva.Path && object.kind === "process-shape" && object.processShape) {
    const paths = processShapePaths(object.processShape, object.width, object.height);
    body.data(paths.body);
    processDetail?.setAttrs({
      data: paths.detail,
      visible: Boolean(paths.detail),
      stroke: object.stroke,
      strokeWidth: 2,
      fillEnabled: false,
      listening: false,
    });
  } else {
    body.setAttrs({ width: object.width, height: object.height });
    if (body instanceof Konva.Rect) {
      body.cornerRadius(object.kind === "sticky" ? 6 : object.kind === "image" ? 8 : object.kind === "gcp-service" ? 12 : 16);
    }
  }

  fold?.setAttrs({
    visible: object.kind === "sticky",
    points: [object.width - 20, 0, object.width, 20, object.width, 0],
    fill: "rgba(255,255,255,0.34)",
  });

  const textInsets = object.kind === "process-shape" && object.processShape
    ? processShapeTextInsets(object.processShape, object.width, object.height)
    : null;
  const plainText = object.kind === "text";
  label.setAttrs({
    width: plainText ? object.width : textInsets?.width ?? Math.max(24, object.width - 32),
    height: plainText ? object.height : textInsets?.height ?? (object.kind === "gcp-service" ? 38 : Math.max(24, object.height - 28)),
    x: plainText ? 0 : textInsets?.x ?? (object.kind === "gcp-service" ? 10 : 16),
    y: plainText ? 0 : textInsets?.y ?? (object.kind === "gcp-service" ? Math.max(70, object.height - 45) : 14),
    text: object.kind === "image" || object.kind === "rich-card" || object.kind === "link" ? "" : object.text,
    visible: object.kind !== "image" && object.kind !== "rich-card" && object.kind !== "link",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: object.kind === "sticky" ? (object.fontSize ?? 17) : plainText ? (object.fontSize ?? 18) : object.kind === "gcp-service" ? 13 : 16,
    fontStyle: object.kind === "sticky" || plainText ? "normal" : "600",
    lineHeight: 1.35,
    fill: "#20222a",
    align: object.textAlign ?? (object.kind === "sticky" || plainText ? "left" : "center"),
    verticalAlign: object.kind === "gcp-service" ? "middle" : object.textVerticalAlign ?? (object.kind === "sticky" || plainText ? "top" : "middle"),
    wrap: "word",
    ellipsis: true,
  });

  const [title, ...bodyLines] = object.text.split("\n");
  cardKicker?.setAttrs({
    visible: object.kind === "rich-card" || object.kind === "link",
    x: 18,
    y: 17,
    text: object.kind === "link" ? "LINK  ↗" : "RICH CARD",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 9,
    fontStyle: "700",
    letterSpacing: 0.8,
    fill: "#6670d9",
  });
  cardTitle?.setAttrs({
    visible: object.kind === "rich-card" || object.kind === "link",
    x: 18,
    y: 40,
    width: Math.max(24, object.width - 36),
    text: title || (object.kind === "link" ? "Link" : "Rich card"),
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: 20,
    fontStyle: "700",
    fill: "#20222a",
    ellipsis: true,
  });
  cardBody?.setAttrs({
    visible: object.kind === "rich-card" || object.kind === "link",
    x: 18,
    y: 70,
    width: Math.max(24, object.width - 36),
    height: object.kind === "link" ? 20 : Math.max(24, object.height - 88),
    text: bodyLines.join("\n") || (object.kind === "link" ? object.url ?? "" : "Add supporting detail."),
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: 12,
    lineHeight: 1.45,
    fill: "#6d707b",
    wrap: "word",
    ellipsis: true,
  });
  linkButton?.setAttrs({
    visible: object.kind === "link",
    x: object.width - 88,
    y: object.height - 36,
    width: 70,
    height: 24,
    fill: "#eef0ff",
    stroke: "#c9cdf4",
    strokeWidth: 1,
    cornerRadius: 7,
  });
  linkButtonLabel?.setAttrs({
    visible: object.kind === "link",
    x: object.width - 88,
    y: object.height - 31,
    width: 70,
    text: "Open  ↗",
    align: "center",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: 11,
    fontStyle: "700",
    fill: "#4f57bd",
  });
  const iconSize = Math.max(24, Math.min(48, object.width - 28, object.height - 70));
  gcpIcon?.setAttrs({
    visible: object.kind === "gcp-service",
    x: (object.width - iconSize) / 2,
    y: 20,
    width: iconSize,
    height: iconSize,
    image: gcpIcon.image(),
  });
  gcpKicker?.setAttrs({
    visible: object.kind === "gcp-service",
    x: 8,
    y: 8,
    width: Math.max(24, object.width - 16),
    text: "GOOGLE CLOUD",
    align: "center",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 7,
    fontStyle: "700",
    letterSpacing: 0.7,
    fill: "#80868b",
  });
}

function makeGroup(object: CanvasObject) {
  const group = new Konva.Group({ id: object.id, name: "canvas-object" });
  const body =
    object.kind === "image"
      ? new Konva.Image({ name: "body", image: window.document.createElement("canvas") })
      : object.kind === "ellipse"
      ? new Konva.Ellipse({
          name: "body",
          x: object.width / 2,
          y: object.height / 2,
          radiusX: object.width / 2,
          radiusY: object.height / 2,
        })
      : object.kind === "process-shape"
        ? new Konva.Path({ name: "body" })
      : new Konva.Rect({ name: "body" });
  const processDetail = new Konva.Path({ name: "process-detail", listening: false });
  const label = new Konva.Text({ name: "label", listening: false });
  const fold = new Konva.Line({ name: "fold", closed: true, listening: false });
  const cardKicker = new Konva.Text({ name: "card-kicker", listening: false });
  const cardTitle = new Konva.Text({ name: "card-title", listening: false });
  const cardBody = new Konva.Text({ name: "card-body", listening: false });
  const linkButton = new Konva.Rect({ name: "link-button" });
  const linkButtonLabel = new Konva.Text({ name: "link-button-label", listening: false });
  const gcpIcon = new Konva.Image({ name: "gcp-icon", image: window.document.createElement("canvas"), listening: false });
  const gcpKicker = new Konva.Text({ name: "gcp-kicker", listening: false });
  group.add(body, processDetail, fold, label, cardKicker, cardTitle, cardBody, linkButton, linkButtonLabel, gcpIcon, gcpKicker);
  paintGroup(group, object);
  return group;
}

function stagePoint(stage: Konva.Stage) {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  return {
    x: (pointer.x - stage.x()) / stage.scaleX(),
    y: (pointer.y - stage.y()) / stage.scaleY(),
  };
}

const SHAPE_TOOLS: ObjectKind[] = ["rectangle", "ellipse", "sticky", "process-shape"];
const MIN_DRAW_SIZE = 8;
const MIN_OBJECT_WIDTH = 40;
const MIN_OBJECT_HEIGHT = 30;
const ROTATION_SNAPS = Array.from({ length: 49 }, (_, index) => (index - 24) * 15);

function isPrimaryButton(event: MouseEvent | TouchEvent | PointerEvent) {
  return !("button" in event) || event.button === 0;
}

function setDraftBounds(
  shape: Konva.Shape,
  start: { x: number; y: number },
  end: { x: number; y: number },
  processShape?: ProcessShapeKind,
) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (shape instanceof Konva.Ellipse) {
    shape.setAttrs({ x: x + width / 2, y: y + height / 2, radiusX: width / 2, radiusY: height / 2 });
  } else if (shape instanceof Konva.Path && processShape) {
    shape.setAttrs({ x, y, data: processShapePaths(processShape, width, height).body });
  } else {
    shape.setAttrs({ x, y, width, height });
  }
  return { x, y, width, height };
}

export function KonvaSurface({
  document,
  width,
  height,
  tool,
  processShape,
  viewport,
  selectedIds,
  editingId,
  onViewportChange,
  onSelect,
  onObjectActivate,
  onObjectFollow,
  onObjectDoubleClick,
  onObjectContextMenu,
  onCreate,
  onTransform,
  onDuplicate,
}: KonvaSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const documentRef = useRef(document);
  const propsRef = useRef({
    tool,
    processShape,
    onViewportChange,
    onSelect,
    onObjectActivate,
    onObjectFollow,
    onObjectDoubleClick,
    onObjectContextMenu,
    onCreate,
    onTransform,
    onDuplicate,
  });

  propsRef.current = {
    tool,
    processShape,
    onViewportChange,
    onSelect,
    onObjectActivate,
    onObjectFollow,
    onObjectDoubleClick,
    onObjectContextMenu,
    onCreate,
    onTransform,
    onDuplicate,
  };
  documentRef.current = document;

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const stage = new Konva.Stage({
      container: containerRef.current,
      width,
      height,
    });
    const connectorLayer = new Konva.Layer({ listening: false });
    const objectLayer = new Konva.Layer();
    const selectionLayer = new Konva.Layer();
    const transformer = new Konva.Transformer({
      rotateEnabled: true,
      rotationSnapTolerance: 7.6,
      flipEnabled: false,
      borderStroke: "#5f67d8",
      borderStrokeWidth: 1.5,
      anchorFill: "#ffffff",
      anchorStroke: "#5f67d8",
      anchorStrokeWidth: 1.5,
      anchorSize: 9,
      anchorCornerRadius: 5,
      padding: 4,
      anchorDragBoundFunc: (_oldPosition, newPosition, event) => {
        transformer.rotationSnaps(
          transformer.getActiveAnchor() === "rotater" && event.shiftKey ? ROTATION_SNAPS : [],
        );
        return newPosition;
      },
      boundBoxFunc: (oldBox, newBox) =>
        Math.abs(newBox.width) < MIN_OBJECT_WIDTH || Math.abs(newBox.height) < MIN_OBJECT_HEIGHT
          ? oldBox
          : newBox,
    });
    selectionLayer.add(transformer);
    stage.add(connectorLayer, objectLayer, selectionLayer);

    Konva.dragButtons = [0];

    let middlePanStart: { pointerX: number; pointerY: number; stageX: number; stageY: number } | null = null;
    let draftStart: { x: number; y: number } | null = null;
    let draftKind: ObjectKind | null = null;
    let draftProcessShape: ProcessShapeKind | null = null;
    let draftShape: Konva.Shape | null = null;
    let selectionStart: { x: number; y: number } | null = null;
    let selectionRect: Konva.Rect | null = null;
    let suppressNextClick = false;

    sceneRef.current = {
      stage,
      connectorLayer,
      objectLayer,
      selectionLayer,
      transformer,
      nodes: new Map(),
      connectors: new Map(),
    };

    stage.on("wheel", (event) => {
      event.evt.preventDefault();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const oldScale = stage.scaleX();
      const world = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      const nextScale = Math.min(3, Math.max(0.18, oldScale * (direction > 0 ? 1.08 : 1 / 1.08)));
      propsRef.current.onViewportChange({
        scale: nextScale,
        x: pointer.x - world.x * nextScale,
        y: pointer.y - world.y * nextScale,
      });
    });

    stage.on("dragmove", (event) => {
      if (event.target === stage) {
        propsRef.current.onViewportChange({
          x: stage.x(),
          y: stage.y(),
          scale: stage.scaleX(),
        });
      }
    });

    stage.on("mousedown touchstart", (event) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      if ("button" in event.evt && event.evt.button === 1) {
        event.evt.preventDefault();
        middlePanStart = {
          pointerX: pointer.x,
          pointerY: pointer.y,
          stageX: stage.x(),
          stageY: stage.y(),
        };
        stage.setAttr("middlePanning", true);
        stage.container().style.cursor = "grabbing";
        return;
      }

      const currentTool = propsRef.current.tool;
      if (event.target === stage && isPrimaryButton(event.evt) && currentTool === "select") {
        const point = stagePoint(stage);
        if (!point) return;
        selectionStart = point;
        selectionRect = new Konva.Rect({
          listening: false,
          fill: "rgba(95, 103, 216, 0.10)",
          stroke: "#5f67d8",
          strokeWidth: 1.5 / stage.scaleX(),
          dash: [6 / stage.scaleX(), 4 / stage.scaleX()],
        });
        selectionLayer.add(selectionRect);
        setDraftBounds(selectionRect, point, point);
        selectionLayer.batchDraw();
        event.evt.preventDefault();
        return;
      }

      if (
        event.target !== stage ||
        !isPrimaryButton(event.evt) ||
        !SHAPE_TOOLS.includes(currentTool as ObjectKind)
      ) {
        return;
      }

      const point = stagePoint(stage);
      if (!point) return;
      draftStart = point;
      draftKind = currentTool as ObjectKind;
      draftProcessShape = draftKind === "process-shape" ? propsRef.current.processShape : null;
      draftShape =
        draftKind === "ellipse"
          ? new Konva.Ellipse({ listening: false, radiusX: 0, radiusY: 0 })
          : draftKind === "process-shape"
            ? new Konva.Path({ listening: false })
          : new Konva.Rect({ listening: false, cornerRadius: draftKind === "sticky" ? 3 : 14 });
      draftShape.fill("rgba(95, 103, 216, 0.12)");
      draftShape.stroke("#5f67d8");
      draftShape.strokeWidth(2 / stage.scaleX());
      draftShape.dash([8 / stage.scaleX(), 5 / stage.scaleX()]);
      selectionLayer.add(draftShape);
      setDraftBounds(draftShape, point, point, draftProcessShape ?? undefined);
      selectionLayer.batchDraw();
      event.evt.preventDefault();
    });

    stage.on("mousemove touchmove", (event) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      if (middlePanStart) {
        event.evt.preventDefault();
        const nextViewport = {
          x: middlePanStart.stageX + pointer.x - middlePanStart.pointerX,
          y: middlePanStart.stageY + pointer.y - middlePanStart.pointerY,
          scale: stage.scaleX(),
        };
        stage.position(nextViewport);
        stage.batchDraw();
        propsRef.current.onViewportChange(nextViewport);
        return;
      }

      if (selectionStart && selectionRect) {
        event.evt.preventDefault();
        setDraftBounds(selectionRect, selectionStart, stagePoint(stage) ?? selectionStart);
        selectionLayer.batchDraw();
        return;
      }

      if (!draftStart || !draftKind || !draftShape) return;
      event.evt.preventDefault();
      setDraftBounds(draftShape, draftStart, stagePoint(stage) ?? draftStart, draftProcessShape ?? undefined);
      selectionLayer.batchDraw();
    });

    stage.on("mouseup touchend", (event) => {
      if (middlePanStart) {
        event.evt.preventDefault();
        middlePanStart = null;
        suppressNextClick = true;
        stage.setAttr("middlePanning", false);
        stage.container().style.cursor = propsRef.current.tool === "hand" ? "grab" : "default";
        return;
      }

      if (selectionStart && selectionRect) {
        const bounds = setDraftBounds(selectionRect, selectionStart, stagePoint(stage) ?? selectionStart);
        selectionRect.destroy();
        selectionRect = null;
        selectionStart = null;
        selectionLayer.batchDraw();

        if (bounds.width >= MIN_DRAW_SIZE && bounds.height >= MIN_DRAW_SIZE) {
          suppressNextClick = true;
          const selected = Array.from(sceneRef.current?.nodes.entries() ?? [])
            .filter(([, node]) =>
              Konva.Util.haveIntersection(bounds, node.getClientRect({ relativeTo: objectLayer })),
            )
            .map(([id]) => id);
          propsRef.current.onSelect(selected);
        }
        return;
      }

      if (!draftStart || !draftKind || !draftShape) return;
      const end = stagePoint(stage) ?? draftStart;
      const bounds = setDraftBounds(draftShape, draftStart, end, draftProcessShape ?? undefined);
      draftShape.destroy();
      draftShape = null;
      draftStart = null;
      const kind = draftKind;
      draftKind = null;
      draftProcessShape = null;
      selectionLayer.batchDraw();

      if (bounds.width >= MIN_DRAW_SIZE && bounds.height >= MIN_DRAW_SIZE) {
        suppressNextClick = true;
        propsRef.current.onCreate(kind, bounds.x, bounds.y, bounds.width, bounds.height);
      }
    });

    stage.on("click tap", (event) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (event.target !== stage) return;
      if (!isPrimaryButton(event.evt)) return;
      const currentTool = propsRef.current.tool;
      if (SHAPE_TOOLS.includes(currentTool as ObjectKind)) {
        const point = stagePoint(stage);
        if (point) propsRef.current.onCreate(currentTool as ObjectKind, point.x, point.y);
      } else if (currentTool === "text") {
        const point = stagePoint(stage);
        if (point) propsRef.current.onCreate("text", point.x, point.y);
      } else {
        propsRef.current.onSelect([]);
      }
    });

    return () => {
      stage.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.stage.size({ width, height });
  }, [width, height]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.stage.position({ x: viewport.x, y: viewport.y });
    scene.stage.scale({ x: viewport.scale, y: viewport.scale });
    scene.stage.draggable(tool === "hand");
    scene.stage.container().style.cursor = scene.stage.getAttr("middlePanning")
      ? "grabbing"
      : tool === "hand"
        ? "grab"
        : SHAPE_TOOLS.includes(tool as ObjectKind)
          ? "crosshair"
          : tool === "text"
            ? "text"
          : "default";
    scene.stage.batchDraw();
  }, [tool, viewport]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const activeIds = new Set(document.objects.map((object) => object.id));

    for (const [id, node] of scene.nodes) {
      if (!activeIds.has(id)) {
        node.destroy();
        scene.nodes.delete(id);
      }
    }

    for (const [objectIndex, object] of document.objects.entries()) {
      let group = scene.nodes.get(object.id);
      if (!group) {
        group = makeGroup(object);
        scene.nodes.set(object.id, group);
        scene.objectLayer.add(group);

        group.on("click tap", (event) => {
          if (!isPrimaryButton(event.evt)) return;
          event.cancelBubble = true;
          propsRef.current.onObjectActivate(group!.id());
        });
        const linkButton = group.findOne<Konva.Rect>(".link-button");
        linkButton?.on("click tap", (event) => {
          if (!isPrimaryButton(event.evt)) return;
          event.cancelBubble = true;
          propsRef.current.onObjectFollow(group!.id());
        });
        linkButton?.on("mouseenter", () => {
          if (scene.stage.getAttr("objectDragging") || scene.stage.getAttr("middlePanning")) return;
          linkButton.fill("#dfe2ff");
          scene.stage.container().style.cursor = "pointer";
          scene.objectLayer.batchDraw();
        });
        linkButton?.on("mouseleave", () => {
          linkButton.fill("#eef0ff");
          if (!scene.stage.getAttr("objectDragging") && !scene.stage.getAttr("middlePanning")) {
            scene.stage.container().style.cursor = propsRef.current.tool === "select"
              ? "grab"
              : propsRef.current.tool === "hand" ? "grab" : "default";
          }
          scene.objectLayer.batchDraw();
        });
        group.on("mouseenter", () => {
          if (
            propsRef.current.tool === "select" &&
            !scene.stage.getAttr("objectDragging") &&
            !scene.stage.getAttr("middlePanning")
          ) {
            scene.stage.container().style.cursor = "grab";
          }
        });
        group.on("mouseleave", () => {
          if (
            propsRef.current.tool === "select" &&
            !scene.stage.getAttr("objectDragging") &&
            !scene.stage.getAttr("middlePanning")
          ) {
            scene.stage.container().style.cursor = "default";
          }
        });
        group.on("dblclick dbltap", (event) => {
          if (!isPrimaryButton(event.evt)) return;
          event.cancelBubble = true;
          propsRef.current.onObjectDoubleClick(group!.id());
        });
        group.on("contextmenu", (event) => {
          event.evt.preventDefault();
          event.cancelBubble = true;
          if (!("clientX" in event.evt)) return;
          propsRef.current.onObjectContextMenu(group!.id(), event.evt.clientX, event.evt.clientY);
        });
        group.on("dragend", () => {
          scene.stage.setAttr("objectDragging", false);
          scene.stage.container().style.cursor = propsRef.current.tool === "select" ? "grab" : "default";
          const duplicateOrigin = group!.getAttr("duplicateOrigin") as { x: number; y: number } | undefined;
          propsRef.current.onTransform(group!.id(), { x: group!.x(), y: group!.y() });
          if (duplicateOrigin) {
            group!.setAttr("duplicateOrigin", undefined);
            propsRef.current.onDuplicate(group!.id(), {
              x: duplicateOrigin.x - group!.x(),
              y: duplicateOrigin.y - group!.y(),
            });
          }
        });
        group.on("dragstart", (event) => {
          scene.stage.setAttr("objectDragging", true);
          scene.stage.container().style.cursor = "grabbing";
          if ("altKey" in event.evt && event.evt.altKey) {
            group!.setAttr("duplicateOrigin", { x: group!.x(), y: group!.y() });
          }
        });
        group.on("dragmove", () => {
          const activeScene = sceneRef.current;
          if (!activeScene) return;
          updateConnectorPositions(activeScene, documentRef.current, group!.id());
        });

        const syncTransformGeometry = () => {
          const object = documentRef.current.objects.find((item) => item.id === group!.id());
          const scaleX = group!.scaleX();
          const scaleY = group!.scaleY();
          const next = {
            x: group!.x(),
            y: group!.y(),
            width: Math.max(MIN_OBJECT_WIDTH, group!.width() * scaleX),
            height: Math.max(MIN_OBJECT_HEIGHT, group!.height() * scaleY),
            rotation: group!.rotation(),
            ...(object?.kind === "sticky" ? { autoGrow: false } : {}),
          };
          group!.scale({ x: 1, y: 1 });
          if (object) paintGroup(group!, { ...object, ...next });
          const activeScene = sceneRef.current;
          if (activeScene) updateConnectorPositions(activeScene, documentRef.current, group!.id());
          propsRef.current.onTransform(group!.id(), next);
        };
        group.on("transform", syncTransformGeometry);
        group.on("transformend", syncTransformGeometry);
      }
      paintGroup(group, object);
      group.findOne<Konva.Text>(".label")?.visible(object.id !== editingId);
      group.zIndex(objectIndex);
      if (object.kind === "image" && object.imageSrc && group.getAttr("imageSrc") !== object.imageSrc) {
        group.setAttr("imageSrc", object.imageSrc);
        const image = new window.Image();
        image.onload = () => {
          const imageNode = group!.findOne<Konva.Image>(".body");
          imageNode?.image(image);
          scene.objectLayer.batchDraw();
        };
        image.src = object.imageSrc;
      }
      if (object.kind === "gcp-service" && object.gcpServiceId && group.getAttr("gcpServiceId") !== object.gcpServiceId) {
        group.setAttr("gcpServiceId", object.gcpServiceId);
        const image = new window.Image();
        image.onload = () => {
          const imageNode = group!.findOne<Konva.Image>(".gcp-icon");
          imageNode?.image(image);
          scene.objectLayer.batchDraw();
        };
        image.src = gcpIconUrl(object.gcpServiceId);
      }
      group.draggable(tool === "select");
      group.listening(true);
    }

    const activeConnectorIds = new Set(document.connectors.map((connector) => connector.id));
    for (const [id, arrow] of scene.connectors) {
      if (!activeConnectorIds.has(id)) {
        arrow.destroy();
        scene.connectors.delete(id);
      }
    }
    for (const connector of document.connectors) {
      if (!scene.nodes.has(connector.fromId) || !scene.nodes.has(connector.toId)) continue;
      let arrow = scene.connectors.get(connector.id);
      if (!arrow) {
        arrow = new Konva.Arrow({
          id: connector.id,
          points: [],
          strokeWidth: 2.5,
          pointerLength: 9,
          pointerWidth: 9,
          lineCap: "round",
          lineJoin: "round",
        });
        scene.connectors.set(connector.id, arrow);
        scene.connectorLayer.add(arrow);
      }
      arrow.stroke(connector.color);
      arrow.fill(connector.color);
    }

    scene.objectLayer.batchDraw();
    updateConnectorPositions(scene, document);
  }, [document, editingId, tool]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const nodes = selectedIds.flatMap((id) => {
      const node = scene.nodes.get(id);
      const object = document.objects.find((item) => item.id === id);
      return node && object?.kind !== "text" ? [node] : [];
    });
    scene.transformer.nodes(nodes);
    scene.selectionLayer.batchDraw();
  }, [document, selectedIds]);

  return (
    <div
      ref={containerRef}
      className="konva-host"
      aria-hidden="true"
      data-viewport-x={Math.round(viewport.x)}
      data-viewport-y={Math.round(viewport.y)}
      data-viewport-scale={viewport.scale}
      data-selected-count={selectedIds.length}
    />
  );
}
