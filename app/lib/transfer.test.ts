import { describe, expect, it } from "vitest";
import { addGcpServiceObject, addObject, addProcessShapeObject, createBlankDocument, updateObject, type CanvasDocument } from "./model";
import {
  CANVAS_EXPORT_MIME_TYPE,
  MAX_CANVAS_IMPORT_BYTES,
  createCanvasExport,
  importCanvasFile,
  parseCanvasImport,
} from "./transfer";

function fileWithContents(contents: string, size?: number) {
  return { text: async () => contents, ...(size === undefined ? {} : { size }) };
}

describe("canvas import and export", () => {
  it("exports pretty-printed JSON with a safe canvas filename", () => {
    const document = createBlankDocument("  Product / Research: Q3  ");
    const exported = createCanvasExport(document);

    expect(exported).toMatchObject({
      fileName: "product-research-q3.canvas.json",
      mimeType: CANVAS_EXPORT_MIME_TYPE,
    });
    expect(exported.contents).toContain("\n  \"schemaVersion\": 1");
    expect(JSON.parse(exported.contents)).toEqual(document);
  });

  it("uses a fallback filename when the title has no filename-safe characters", () => {
    expect(createCanvasExport(createBlankDocument("✨")).fileName).toBe("canvas.canvas.json");
  });

  it("imports a valid document and refreshes its updated timestamp", () => {
    const source = createBlankDocument("Imported plan");
    const imported = parseCanvasImport(JSON.stringify(source), [], {
      now: () => "2026-08-27T15:00:00.000Z",
    });

    expect(imported).toEqual({
      ...source,
      updatedAt: "2026-08-27T15:00:00.000Z",
    });
  });

  it("rejects malformed JSON with a useful error", () => {
    expect(() => parseCanvasImport("{not-json", [])).toThrow("That file is not valid JSON.");
  });

  it("rejects JSON that is not a canvas document", () => {
    expect(() => parseCanvasImport(JSON.stringify({ title: "Almost" }), [])).toThrow(
      "That file is not a valid canvas document.",
    );
  });

  it("rejects oversized files before reading their contents", async () => {
    let read = false;
    const file = {
      size: MAX_CANVAS_IMPORT_BYTES + 1,
      text: async () => {
        read = true;
        return "{}";
      },
    };

    await expect(importCanvasFile(file, [], {
      saveDocument: async () => undefined,
      refreshEntries: async () => undefined,
      openFile: async () => undefined,
    })).rejects.toThrow("That canvas file is too large (maximum 50 MB).");
    expect(read).toBe(false);
  });

  it("assigns a new ID and title when the imported ID already exists", () => {
    const source = createBlankDocument("Roadmap");
    const imported = parseCanvasImport(JSON.stringify(source), [source.id], {
      now: () => "2026-08-27T15:00:00.000Z",
      createId: () => "file_imported",
    });

    expect(imported).toMatchObject({
      id: "file_imported",
      title: "Roadmap imported",
      createdAt: source.createdAt,
      updatedAt: "2026-08-27T15:00:00.000Z",
    });
  });

  it("saves, refreshes, and opens an imported canvas in order", async () => {
    const source = createBlankDocument("Workflow test");
    const calls: string[] = [];
    let saved: CanvasDocument | undefined;

    const imported = await importCanvasFile(fileWithContents(JSON.stringify(source)), [], {
      saveDocument: async (document) => {
        calls.push("save");
        saved = document;
      },
      refreshEntries: async () => {
        calls.push("refresh");
      },
      openFile: async (documentId) => {
        calls.push(`open:${documentId}`);
      },
      now: () => "2026-08-27T15:00:00.000Z",
    });

    expect(saved).toEqual(imported);
    expect(calls).toEqual(["save", "refresh", `open:${source.id}`]);
  });

  it("round-trips canvas objects and formatting through export and import", () => {
    const added = addObject(createBlankDocument("Portable board"), "rectangle", 40, 50);
    const source = updateObject(added.document, added.object.id, {
      text: "Aligned idea",
      textAlign: "right",
      textVerticalAlign: "bottom",
      rotation: 15,
    });
    const exported = createCanvasExport(source);
    const imported = parseCanvasImport(exported.contents, [], {
      now: () => source.updatedAt,
    });

    expect(imported).toEqual(source);
  });

  it("round-trips Google Cloud service nodes through export and import", () => {
    const source = addGcpServiceObject(createBlankDocument("GCP plan"), "cloud-sql", 180, 220).document;
    const exported = createCanvasExport(source);
    const imported = parseCanvasImport(exported.contents, [], { now: () => source.updatedAt });

    expect(imported.objects[0]).toMatchObject({
      kind: "gcp-service",
      gcpServiceId: "cloud-sql",
      text: "Cloud SQL",
    });
    expect(imported).toEqual(source);
  });

  it("round-trips process diagram symbols through export and import", () => {
    const source = addProcessShapeObject(createBlankDocument("Process plan"), "decision", 90, 120).document;
    const exported = createCanvasExport(source);
    const imported = parseCanvasImport(exported.contents, [], { now: () => source.updatedAt });

    expect(imported.objects[0]).toMatchObject({
      kind: "process-shape",
      processShape: "decision",
      text: "Decision?",
    });
    expect(imported).toEqual(source);
  });
});
