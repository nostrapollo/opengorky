import {
  isCanvasDocument,
  makeId,
  touchDocument,
  type CanvasDocument,
  type CanvasObject,
  type Connector,
} from "./model";

export const CANVAS_CLIPBOARD_MIME_TYPE = "application/x-opengorky-objects+json";

type CanvasClipboardPayload = {
  type: "opengorky/canvas-objects";
  version: 1;
  objects: CanvasObject[];
  connectors: Connector[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCanvasClipboard(contents: string): CanvasClipboardPayload | null {
  try {
    const value: unknown = JSON.parse(contents);
    if (!isRecord(value) || value.type !== "opengorky/canvas-objects" || value.version !== 1) return null;
    const candidate = {
      schemaVersion: 1,
      id: "clipboard",
      title: "Clipboard",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      objects: value.objects,
      connectors: value.connectors,
    };
    if (!isCanvasDocument(candidate)) return null;
    return {
      type: value.type,
      version: value.version,
      objects: candidate.objects,
      connectors: candidate.connectors,
    };
  } catch {
    return null;
  }
}

export function createCanvasClipboard(document: CanvasDocument, selectedIds: Iterable<string>) {
  const ids = new Set(selectedIds);
  if (ids.size === 0) return null;
  const objects = document.objects.filter((object) => ids.has(object.id));
  if (objects.length === 0) return null;
  const copiedIds = new Set(objects.map((object) => object.id));
  const payload: CanvasClipboardPayload = {
    type: "opengorky/canvas-objects",
    version: 1,
    objects,
    connectors: document.connectors.filter(
      (connector) => copiedIds.has(connector.fromId) && copiedIds.has(connector.toId),
    ),
  };
  return JSON.stringify(payload);
}

export function pasteCanvasClipboard(document: CanvasDocument, contents: string, offset = 24) {
  const payload = parseCanvasClipboard(contents);
  if (!payload) return null;

  const ids = new Map(payload.objects.map((object) => [object.id, makeId("obj")]));
  const objects = payload.objects.map((object) => ({
    ...object,
    id: ids.get(object.id)!,
    x: object.x + offset,
    y: object.y + offset,
  }));
  const connectors = payload.connectors.map((connector) => ({
    ...connector,
    id: makeId("connector"),
    fromId: ids.get(connector.fromId)!,
    toId: ids.get(connector.toId)!,
  }));

  return {
    document: touchDocument({
      ...document,
      objects: [...document.objects, ...objects],
      connectors: [...document.connectors, ...connectors],
    }),
    objectIds: objects.map((object) => object.id),
  };
}
