import {
  isCanvasDocument,
  makeId,
  normalizeCanvasDocument,
  type CanvasDocument,
} from "./model";

export const CANVAS_EXPORT_MIME_TYPE = "application/json";
export const MAX_CANVAS_IMPORT_BYTES = 50 * 1024 * 1024;

export type CanvasExport = {
  contents: string;
  fileName: string;
  mimeType: typeof CANVAS_EXPORT_MIME_TYPE;
};

type ImportFile = {
  size?: number;
  text: () => Promise<string>;
};

type ImportDependencies = {
  saveDocument: (document: CanvasDocument) => Promise<unknown>;
  refreshEntries: () => Promise<unknown>;
  openFile: (documentId: string) => Promise<unknown>;
  now?: () => string;
  createId?: () => string;
};

function exportFileName(title: string) {
  const slug = title
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${slug || "canvas"}.canvas.json`;
}

export function createCanvasExport(document: CanvasDocument): CanvasExport {
  return {
    contents: JSON.stringify(document, null, 2),
    fileName: exportFileName(document.title),
    mimeType: CANVAS_EXPORT_MIME_TYPE,
  };
}

export function parseCanvasImport(
  contents: string,
  existingDocumentIds: Iterable<string>,
  options: Pick<ImportDependencies, "now" | "createId"> = {},
): CanvasDocument {
  if (new TextEncoder().encode(contents).byteLength > MAX_CANVAS_IMPORT_BYTES) {
    throw new Error("That canvas file is too large (maximum 50 MB).");
  }
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isCanvasDocument(value)) {
    throw new Error("That file is not a valid canvas document.");
  }

  const duplicateId = new Set(existingDocumentIds).has(value.id);
  const now = options.now?.() ?? new Date().toISOString();
  return {
    ...normalizeCanvasDocument(value),
    id: duplicateId ? options.createId?.() ?? makeId("file") : value.id,
    title: duplicateId ? `${value.title} imported` : value.title,
    updatedAt: now,
  };
}

export async function importCanvasFile(
  file: ImportFile,
  existingDocumentIds: Iterable<string>,
  dependencies: ImportDependencies,
) {
  if (file.size !== undefined && file.size > MAX_CANVAS_IMPORT_BYTES) {
    throw new Error("That canvas file is too large (maximum 50 MB).");
  }
  const document = parseCanvasImport(await file.text(), existingDocumentIds, dependencies);
  await dependencies.saveDocument(document);
  await dependencies.refreshEntries();
  await dependencies.openFile(document.id);
  return document;
}
