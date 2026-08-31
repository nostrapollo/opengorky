import { getGcpService } from "./gcpCatalog";
import {
  PROCESS_SHAPES,
  isProcessShapeKind,
  type ProcessShapeKind,
} from "./processShapes";

export type ObjectKind = "rectangle" | "ellipse" | "sticky" | "text" | "rich-card" | "image" | "link" | "gcp-service" | "process-shape";
export type TextAlign = "left" | "center" | "right";
export type TextVerticalAlign = "top" | "middle" | "bottom";

export type CanvasObject = {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  text: string;
  fontSize?: number;
  textAlign?: TextAlign;
  textVerticalAlign?: TextVerticalAlign;
  autoGrow?: boolean;
  imageSrc?: string;
  url?: string;
  gcpServiceId?: string;
  processShape?: ProcessShapeKind;
};

export type Connector = {
  id: string;
  fromId: string;
  toId: string;
  color: string;
};

export type CanvasDocument = {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  objects: CanvasObject[];
  connectors: Connector[];
};

export type CatalogEntry = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  objectCount: number;
  searchableText: string;
};

export type Tool = "select" | "hand" | "rectangle" | "ellipse" | "sticky" | "text" | "process-shape" | "connector";

export type Viewport = {
  x: number;
  y: number;
  scale: number;
};

export type Point = { x: number; y: number };

export type LayerMove = "backward" | "forward" | "back" | "front";

const OBJECT_KINDS = new Set<ObjectKind>(["rectangle", "ellipse", "sticky", "text", "rich-card", "image", "link", "gcp-service", "process-shape"]);
const TEXT_ALIGNS = new Set<TextAlign>(["left", "center", "right"]);
const TEXT_VERTICAL_ALIGNS = new Set<TextVerticalAlign>(["top", "middle", "bottom"]);
const MAX_DOCUMENT_OBJECTS = 10_000;
const MAX_DOCUMENT_CONNECTORS = 20_000;
const MAX_IDENTIFIER_LENGTH = 256;
const MAX_TITLE_LENGTH = 500;
const MAX_TEXT_LENGTH = 1_000_000;
const MAX_IMAGE_SOURCE_LENGTH = 45 * 1024 * 1024;
const MAX_URL_LENGTH = 4_096;
const MAX_COORDINATE = 10_000_000;
const MAX_DIMENSION = 1_000_000;

function objectCenter(object: CanvasObject): Point {
  const angle = (object.rotation * Math.PI) / 180;
  const localX = object.width / 2;
  const localY = object.height / 2;
  return {
    x: object.x + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: object.y + localX * Math.sin(angle) + localY * Math.cos(angle),
  };
}

function polygonEdgeDistance(direction: Point, points: Point[]) {
  const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const segment = { x: end.x - start.x, y: end.y - start.y };
    const denominator = cross(direction, segment);
    if (Math.abs(denominator) < 0.0001) continue;
    const distance = cross(start, segment) / denominator;
    const segmentOffset = cross(start, direction) / denominator;
    if (distance >= 0 && segmentOffset >= 0 && segmentOffset <= 1) {
      nearest = Math.min(nearest, distance);
    }
  }
  return nearest;
}

function objectEdgePoint(object: CanvasObject, toward: Point): Point {
  const center = objectCenter(object);
  const angle = (object.rotation * Math.PI) / 180;
  const worldX = toward.x - center.x;
  const worldY = toward.y - center.y;
  const localX = worldX * Math.cos(angle) + worldY * Math.sin(angle);
  const localY = -worldX * Math.sin(angle) + worldY * Math.cos(angle);
  if (Math.abs(localX) < 0.0001 && Math.abs(localY) < 0.0001) return center;

  const halfWidth = Math.max(0.5, object.width / 2);
  const halfHeight = Math.max(0.5, object.height / 2);
  let distance = object.kind === "ellipse"
    ? 1 / Math.sqrt((localX * localX) / (halfWidth * halfWidth) + (localY * localY) / (halfHeight * halfHeight))
    : Math.min(
      Math.abs(localX) < 0.0001 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(localX),
      Math.abs(localY) < 0.0001 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(localY),
    );
  if (object.kind === "process-shape") {
    const inset = Math.min(28, object.width * 0.16);
    const centeredInset = Math.min(24, object.width * 0.14);
    const polygon = object.processShape === "decision"
      ? [
        { x: 0, y: -halfHeight },
        { x: halfWidth, y: 0 },
        { x: 0, y: halfHeight },
        { x: -halfWidth, y: 0 },
      ]
      : object.processShape === "data"
        ? [
          { x: -halfWidth + inset, y: -halfHeight },
          { x: halfWidth, y: -halfHeight },
          { x: halfWidth - inset, y: halfHeight },
          { x: -halfWidth, y: halfHeight },
        ]
        : object.processShape === "manual-operation"
          ? [
            { x: -halfWidth, y: -halfHeight },
            { x: halfWidth, y: -halfHeight },
            { x: halfWidth - centeredInset, y: halfHeight },
            { x: -halfWidth + centeredInset, y: halfHeight },
          ]
          : null;
    if (polygon) distance = polygonEdgeDistance({ x: localX, y: localY }, polygon);
  }
  const edgeX = localX * distance;
  const edgeY = localY * distance;
  return {
    x: center.x + edgeX * Math.cos(angle) - edgeY * Math.sin(angle),
    y: center.y + edgeX * Math.sin(angle) + edgeY * Math.cos(angle),
  };
}

export function connectorEndpoints(from: CanvasObject, to: CanvasObject): [Point, Point] {
  const fromCenter = objectCenter(from);
  const toCenter = objectCenter(to);
  return [objectEdgePoint(from, toCenter), objectEdgePoint(to, fromCenter)];
}

export function makeId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function fitViewportToObjects(
  objects: CanvasObject[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 80,
): Viewport {
  if (objects.length === 0) return { x: 90, y: 70, scale: 1 };

  const points = objects.flatMap((object) => {
    const angle = (object.rotation * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [
      [0, 0],
      [object.width, 0],
      [object.width, object.height],
      [0, object.height],
    ].map(([x, y]) => ({
      x: object.x + x * cosine - y * sine,
      y: object.y + x * sine + y * cosine,
    }));
  });
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const scale = Math.min(3, Math.max(0.18, Math.min(availableWidth / contentWidth, availableHeight / contentHeight)));

  return {
    scale,
    x: (viewportWidth - contentWidth * scale) / 2 - minX * scale,
    y: (viewportHeight - contentHeight * scale) / 2 - minY * scale,
  };
}

export function createBlankDocument(title = "Untitled canvas"): CanvasDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: makeId("file"),
    title,
    createdAt: now,
    updatedAt: now,
    objects: [],
    connectors: [],
  };
}

export function createDemoDocument(): CanvasDocument {
  const document = createBlankDocument("Product thinking map");
  const problemId = makeId("obj");
  const ideaId = makeId("obj");
  const cardId = makeId("obj");

  document.objects = [
    {
      id: problemId,
      kind: "rectangle",
      x: 120,
      y: 130,
      width: 220,
      height: 120,
      rotation: 0,
      fill: "#eef0ff",
      stroke: "#6670d9",
      text: "Start with the problem",
    },
    {
      id: ideaId,
      kind: "sticky",
      x: 470,
      y: 120,
      width: 210,
      height: 150,
      rotation: -1.5,
      fill: "#ffe797",
      stroke: "#d8ad32",
      text: "Files are the product — not an account or a cloud database.",
    },
    {
      id: cardId,
      kind: "rectangle",
      x: 270,
      y: 360,
      width: 300,
      height: 170,
      rotation: 0,
      fill: "#ffffff",
      stroke: "#23262f",
      text: "Portable by default\nExport a complete canvas as JSON and bring it anywhere.",
      textAlign: "left",
      textVerticalAlign: "top",
    },
  ];
  document.connectors = [
    { id: makeId("connector"), fromId: problemId, toId: ideaId, color: "#6670d9" },
    { id: makeId("connector"), fromId: ideaId, toId: cardId, color: "#d8ad32" },
  ];
  return document;
}

export function addObject(
  document: CanvasDocument,
  kind: ObjectKind,
  x: number,
  y: number,
  size?: Pick<CanvasObject, "width" | "height">,
): { document: CanvasDocument; object: CanvasObject } {
  const defaults: Record<ObjectKind, Pick<CanvasObject, "width" | "height" | "fill" | "stroke" | "text">> = {
    rectangle: { width: 190, height: 110, fill: "#eef0ff", stroke: "#6670d9", text: "New idea" },
    ellipse: { width: 180, height: 120, fill: "#e4f8ef", stroke: "#34966a", text: "New idea" },
    sticky: { width: 200, height: 150, fill: "#ffe797", stroke: "#d8ad32", text: "" },
    text: { width: 260, height: 80, fill: "transparent", stroke: "transparent", text: "" },
    "rich-card": { width: 300, height: 170, fill: "#ffffff", stroke: "#23262f", text: "Rich card\nA live DOM layer on the infinite canvas." },
    image: { width: 320, height: 240, fill: "#ffffff", stroke: "#b9bbc5", text: "Pasted image" },
    link: { width: 320, height: 132, fill: "#ffffff", stroke: "#6670d9", text: "Link" },
    "gcp-service": { width: 156, height: 128, fill: "#ffffff", stroke: "#dadce0", text: "Google Cloud service" },
    "process-shape": { width: 190, height: 100, fill: "#ffffff", stroke: "#5f67d8", text: "Process" },
  };
  const object: CanvasObject = {
    id: makeId("obj"),
    kind,
    x,
    y,
    rotation: 0,
    ...defaults[kind],
    ...size,
    ...(kind === "sticky"
      ? { fontSize: 17, textAlign: "left" as const, textVerticalAlign: "top" as const, autoGrow: true }
      : kind === "text"
        ? { fontSize: 18, textAlign: "left" as const, textVerticalAlign: "top" as const }
      : kind === "rectangle" || kind === "ellipse" || kind === "process-shape"
        ? { textAlign: "center" as const, textVerticalAlign: "middle" as const }
        : {}),
  };
  return {
    object,
    document: touchDocument({ ...document, objects: [...document.objects, object] }),
  };
}

export function addProcessShapeObject(
  document: CanvasDocument,
  processShape: ProcessShapeKind,
  x: number,
  y: number,
  size?: Pick<CanvasObject, "width" | "height">,
): { document: CanvasDocument; object: CanvasObject } {
  const definition = PROCESS_SHAPES.find((shape) => shape.kind === processShape);
  if (!definition) throw new Error(`Unknown process shape: ${processShape}`);
  const result = addObject(document, "process-shape", x, y, size ?? {
    width: definition.width,
    height: definition.height,
  });
  const object = { ...result.object, processShape, text: definition.defaultText };
  return {
    object,
    document: touchDocument({
      ...result.document,
      objects: result.document.objects.map((item) => item.id === object.id ? object : item),
    }),
  };
}

export function addGcpServiceObject(
  document: CanvasDocument,
  serviceId: string,
  x: number,
  y: number,
): { document: CanvasDocument; object: CanvasObject } {
  const service = getGcpService(serviceId);
  if (!service) throw new Error(`Unknown Google Cloud service: ${serviceId}`);
  const result = addObject(document, "gcp-service", x, y);
  const object = { ...result.object, gcpServiceId: service.id, text: service.name };
  return {
    object,
    document: touchDocument({
      ...result.document,
      objects: result.document.objects.map((item) => item.id === object.id ? object : item),
    }),
  };
}

export function addLinkObject(
  document: CanvasDocument,
  url: string,
  x: number,
  y: number,
): { document: CanvasDocument; object: CanvasObject } {
  const parsed = new URL(url);
  const displayUrl = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  const result = addObject(document, "link", x, y);
  const object = {
    ...result.object,
    url: parsed.href,
    text: `${parsed.hostname.replace(/^www\./, "")}\n${displayUrl}`,
  };
  return {
    object,
    document: touchDocument({
      ...result.document,
      objects: result.document.objects.map((item) => item.id === object.id ? object : item),
    }),
  };
}

export function addImageObject(
  document: CanvasDocument,
  imageSrc: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text = "Pasted image",
): { document: CanvasDocument; object: CanvasObject } {
  const result = addObject(document, "image", x, y, { width, height });
  const object = { ...result.object, imageSrc, text };
  return {
    object,
    document: touchDocument({
      ...result.document,
      objects: result.document.objects.map((item) => item.id === object.id ? object : item),
    }),
  };
}

export function updateObject(
  document: CanvasDocument,
  objectId: string,
  patch: Partial<CanvasObject>,
): CanvasDocument {
  return touchDocument({
    ...document,
    objects: document.objects.map((object) =>
      object.id === objectId ? { ...object, ...patch, id: object.id } : object,
    ),
  });
}

export function deleteObject(document: CanvasDocument, objectId: string): CanvasDocument {
  return deleteObjects(document, [objectId]);
}

export function deleteObjects(document: CanvasDocument, objectIds: Iterable<string>): CanvasDocument {
  const ids = new Set(objectIds);
  return touchDocument({
    ...document,
    objects: document.objects.filter((object) => !ids.has(object.id)),
    connectors: document.connectors.filter(
      (connector) => !ids.has(connector.fromId) && !ids.has(connector.toId),
    ),
  });
}

export function duplicateObject(
  document: CanvasDocument,
  objectId: string,
  offset = { x: 24, y: 24 },
): { document: CanvasDocument; object: CanvasObject } | null {
  const source = document.objects.find((object) => object.id === objectId);
  if (!source) return null;
  const object = {
    ...source,
    id: makeId("obj"),
    x: source.x + offset.x,
    y: source.y + offset.y,
  };
  return {
    object,
    document: touchDocument({ ...document, objects: [...document.objects, object] }),
  };
}

export function reorderObject(document: CanvasDocument, objectId: string, move: LayerMove): CanvasDocument {
  const index = document.objects.findIndex((object) => object.id === objectId);
  if (index < 0) return document;
  const targetIndex = move === "back"
    ? 0
    : move === "front"
      ? document.objects.length - 1
      : move === "backward"
        ? Math.max(0, index - 1)
        : Math.min(document.objects.length - 1, index + 1);
  if (targetIndex === index) return document;
  const objects = [...document.objects];
  const [object] = objects.splice(index, 1);
  objects.splice(targetIndex, 0, object);
  return touchDocument({ ...document, objects });
}

export function touchDocument(document: CanvasDocument): CanvasDocument {
  return { ...document, updatedAt: new Date().toISOString() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown, maximumLength: number, allowEmpty = true): value is string {
  return typeof value === "string" && value.length <= maximumLength && (allowEmpty || value.length > 0);
}

function isFiniteNumber(value: unknown, maximumAbsoluteValue: number, positive = false): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && Math.abs(value) <= maximumAbsoluteValue
    && (!positive || value > 0);
}

function isTimestamp(value: unknown): value is string {
  return isBoundedString(value, 64, false) && Number.isFinite(Date.parse(value));
}

function isSafeWebUrl(value: unknown): value is string {
  if (!isBoundedString(value, MAX_URL_LENGTH, false)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isImageSource(value: unknown): value is string {
  return isBoundedString(value, MAX_IMAGE_SOURCE_LENGTH, false)
    && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

function isGcpServiceId(value: unknown): value is string {
  return isBoundedString(value, MAX_IDENTIFIER_LENGTH, false) && /^[a-z0-9-]+$/.test(value);
}

function isCanvasObject(value: unknown): value is CanvasObject {
  if (!isRecord(value) || !OBJECT_KINDS.has(value.kind as ObjectKind)) return false;
  if (
    !isBoundedString(value.id, MAX_IDENTIFIER_LENGTH, false)
    || !isFiniteNumber(value.x, MAX_COORDINATE)
    || !isFiniteNumber(value.y, MAX_COORDINATE)
    || !isFiniteNumber(value.width, MAX_DIMENSION, true)
    || !isFiniteNumber(value.height, MAX_DIMENSION, true)
    || !isFiniteNumber(value.rotation, MAX_COORDINATE)
    || !isBoundedString(value.fill, 256)
    || !isBoundedString(value.stroke, 256)
    || !isBoundedString(value.text, MAX_TEXT_LENGTH)
  ) return false;

  if (value.fontSize !== undefined && !isFiniteNumber(value.fontSize, 512, true)) return false;
  if (value.textAlign !== undefined && !TEXT_ALIGNS.has(value.textAlign as TextAlign)) return false;
  if (value.textVerticalAlign !== undefined && !TEXT_VERTICAL_ALIGNS.has(value.textVerticalAlign as TextVerticalAlign)) return false;
  if (value.autoGrow !== undefined && typeof value.autoGrow !== "boolean") return false;
  if (value.imageSrc !== undefined && !isImageSource(value.imageSrc)) return false;
  if (value.url !== undefined && !isSafeWebUrl(value.url)) return false;
  if (value.gcpServiceId !== undefined && !isGcpServiceId(value.gcpServiceId)) return false;
  if (value.processShape !== undefined && !isProcessShapeKind(value.processShape)) return false;
  if (value.kind === "image" && !isImageSource(value.imageSrc)) return false;
  if (value.kind === "link" && !isSafeWebUrl(value.url)) return false;
  if (value.kind === "gcp-service" && !isGcpServiceId(value.gcpServiceId)) return false;
  if (value.kind === "process-shape" && !isProcessShapeKind(value.processShape)) return false;
  return true;
}

function isConnector(value: unknown, objectIds: Set<string>): value is Connector {
  return isRecord(value)
    && isBoundedString(value.id, MAX_IDENTIFIER_LENGTH, false)
    && isBoundedString(value.fromId, MAX_IDENTIFIER_LENGTH, false)
    && isBoundedString(value.toId, MAX_IDENTIFIER_LENGTH, false)
    && isBoundedString(value.color, 256)
    && objectIds.has(value.fromId)
    && objectIds.has(value.toId);
}

export function isCanvasDocument(value: unknown): value is CanvasDocument {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== 1
    || !isBoundedString(value.id, MAX_IDENTIFIER_LENGTH, false)
    || !isBoundedString(value.title, MAX_TITLE_LENGTH)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || !Array.isArray(value.objects)
    || value.objects.length > MAX_DOCUMENT_OBJECTS
    || !Array.isArray(value.connectors)
    || value.connectors.length > MAX_DOCUMENT_CONNECTORS
    || !value.objects.every(isCanvasObject)
  ) return false;

  const objectIds = new Set(value.objects.map((object) => object.id));
  if (objectIds.size !== value.objects.length) return false;
  if (!value.connectors.every((connector) => isConnector(connector, objectIds))) return false;
  const connectorIds = new Set(value.connectors.map((connector) => connector.id));
  return connectorIds.size === value.connectors.length;
}

export function normalizeCanvasDocument(document: CanvasDocument): CanvasDocument {
  return {
    ...document,
    objects: document.objects.map((object) => {
      const { linkToFileId: _legacyLink, ...current } = object as CanvasObject & {
        linkToFileId?: unknown;
      };
      return current;
    }),
  };
}

export function documentToCatalog(document: CanvasDocument): CatalogEntry {
  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    objectCount: document.objects.length,
    searchableText: `${document.title} ${document.objects.map((object) => object.text).join(" ")}`.toLowerCase(),
  };
}
