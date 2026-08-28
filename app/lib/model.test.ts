import { describe, expect, it } from "vitest";
import {
  addObject,
  addGcpServiceObject,
  addImageObject,
  addLinkObject,
  createBlankDocument,
  connectorEndpoints,
  deleteObject,
  deleteObjects,
  duplicateObject,
  fitViewportToObjects,
  documentToCatalog,
  isCanvasDocument,
  normalizeCanvasDocument,
  reorderObject,
  updateObject,
} from "./model";

describe("canvas document model", () => {
  it("adds, updates, indexes, and deletes objects without renderer state", () => {
    const blank = createBlankDocument("Research map");
    const added = addObject(blank, "sticky", 40, 80);
    const updated = updateObject(added.document, added.object.id, { text: "Portable files" });
    const catalog = documentToCatalog(updated);

    expect(updated.objects[0].text).toBe("Portable files");
    expect(catalog.searchableText).toContain("portable files");
    expect(deleteObject(updated, added.object.id).objects).toHaveLength(0);
  });

  it("accepts a serialized version-one document", () => {
    const document = createBlankDocument();
    expect(isCanvasDocument(JSON.parse(JSON.stringify(document)))).toBe(true);
    expect(isCanvasDocument({ id: document.id })).toBe(false);
  });

  it("rejects malformed objects and dangling connectors", () => {
    const document = createBlankDocument();
    expect(isCanvasDocument({ ...document, objects: [null] })).toBe(false);
    expect(isCanvasDocument({
      ...document,
      connectors: [{ id: "connector-1", fromId: "missing", toId: "also-missing", color: "#000" }],
    })).toBe(false);
  });

  it("rejects unsafe imported link schemes", () => {
    const added = addObject(createBlankDocument(), "link", 20, 30);
    const unsafe = {
      ...added.document,
      objects: [{ ...added.object, url: "javascript:alert(1)" }],
    };

    expect(isCanvasDocument(unsafe)).toBe(false);
  });

  it("uses drag bounds when creating a shape", () => {
    const blank = createBlankDocument();
    const added = addObject(blank, "rectangle", 25, 35, { width: 240, height: 160 });

    expect(added.object).toMatchObject({
      x: 25,
      y: 35,
      width: 240,
      height: 160,
      textAlign: "center",
      textVerticalAlign: "middle",
    });
  });

  it("persists horizontal and vertical shape text alignment", () => {
    const added = addObject(createBlankDocument(), "ellipse", 25, 35);
    const updated = updateObject(added.document, added.object.id, {
      textAlign: "right",
      textVerticalAlign: "bottom",
    });
    const restored = normalizeCanvasDocument(JSON.parse(JSON.stringify(updated)));

    expect(restored.objects[0]).toMatchObject({
      textAlign: "right",
      textVerticalAlign: "bottom",
    });
  });

  it("removes legacy object links from saved documents", () => {
    const blank = createBlankDocument();
    const added = addObject(blank, "rectangle", 10, 20);
    const legacy = {
      ...added.document,
      objects: [{ ...added.object, linkToFileId: "old-linked-file" }],
    };

    expect("linkToFileId" in normalizeCanvasDocument(legacy).objects[0]).toBe(false);
  });

  it("deletes a multi-selection and its connected arrows", () => {
    const blank = createBlankDocument();
    const first = addObject(blank, "rectangle", 10, 20);
    const second = addObject(first.document, "ellipse", 200, 20);
    const third = addObject(second.document, "sticky", 400, 20);
    const connected = {
      ...third.document,
      connectors: [
        { id: "arrow-1", fromId: first.object.id, toId: second.object.id, color: "#000000" },
        { id: "arrow-2", fromId: second.object.id, toId: third.object.id, color: "#000000" },
      ],
    };

    const result = deleteObjects(connected, [first.object.id, second.object.id]);

    expect(result.objects.map((object) => object.id)).toEqual([third.object.id]);
    expect(result.connectors).toHaveLength(0);
  });

  it("duplicates an object without copying its identity", () => {
    const added = addObject(createBlankDocument(), "sticky", 30, 40);
    const duplicated = duplicateObject(added.document, added.object.id);

    expect(duplicated?.object).toMatchObject({ x: 54, y: 64, text: "" });
    expect(duplicated?.object.id).not.toBe(added.object.id);
    expect(duplicated?.document.objects).toHaveLength(2);
  });

  it("fits all rotated content inside a padded viewport", () => {
    const first = addObject(createBlankDocument(), "rectangle", -100, -50, { width: 100, height: 100 });
    const second = addObject(first.document, "rectangle", 900, 450, { width: 100, height: 100 });
    const viewport = fitViewportToObjects(second.document.objects, 1000, 800, 80);

    expect(viewport.scale).toBeCloseTo(840 / 1100);
    expect(-100 * viewport.scale + viewport.x).toBeCloseTo(80);
    expect(1000 * viewport.scale + viewport.x).toBeCloseTo(920);

    const rotated = updateObject(first.document, first.object.id, { x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    const rotatedViewport = fitViewportToObjects(rotated.objects, 500, 400, 50);
    expect(rotatedViewport).toMatchObject({ x: 325, y: 50, scale: 3 });
  });

  it("anchors connectors to object edges instead of their centers", () => {
    const first = addObject(createBlankDocument(), "rectangle", 0, 0, { width: 100, height: 60 });
    const second = addObject(first.document, "ellipse", 200, 0, { width: 100, height: 100 });
    const [start, end] = connectorEndpoints(first.object, second.object);

    expect(start).toEqual({ x: 100, y: 35 });
    expect(end.x).toBeCloseTo(200.25, 1);
    expect(end.y).toBeCloseTo(45.02, 1);

    const rotated = updateObject(first.document, first.object.id, { rotation: 90 }).objects[0];
    const [rotatedStart] = connectorEndpoints(rotated, second.object);
    expect(rotatedStart.x).toBeCloseTo(0, 5);
    expect(rotatedStart.y).toBeCloseTo(50, 5);
  });

  it("stores a pasted image as a portable canvas object", () => {
    const result = addImageObject(createBlankDocument(), "data:image/png;base64,abc", 20, 30, 640, 480, "diagram.png");

    expect(result.object).toMatchObject({
      kind: "image",
      imageSrc: "data:image/png;base64,abc",
      text: "diagram.png",
      width: 640,
      height: 480,
    });
    expect(isCanvasDocument(JSON.parse(JSON.stringify(result.document)))).toBe(true);
  });

  it("stores a normalized pasted link as a portable canvas object", () => {
    const result = addLinkObject(createBlankDocument(), "https://www.example.com/docs/start?mode=canvas", 20, 30);

    expect(result.object).toMatchObject({
      kind: "link",
      url: "https://www.example.com/docs/start?mode=canvas",
      text: "example.com\nwww.example.com/docs/start",
      x: 20,
      y: 30,
    });
    expect(isCanvasDocument(JSON.parse(JSON.stringify(result.document)))).toBe(true);
  });

  it("stores a Google Cloud service as a native portable canvas object", () => {
    const result = addGcpServiceObject(createBlankDocument(), "cloud-run", 120, 80);
    const restored = normalizeCanvasDocument(JSON.parse(JSON.stringify(result.document)));

    expect(result.object).toMatchObject({
      kind: "gcp-service",
      gcpServiceId: "cloud-run",
      text: "Cloud Run",
      x: 120,
      y: 80,
      width: 156,
      height: 128,
    });
    expect(restored).toEqual(result.document);
    expect(isCanvasDocument(restored)).toBe(true);
  });

  it("rejects Google Cloud objects without a service identity", () => {
    const added = addObject(createBlankDocument(), "gcp-service", 20, 30);
    expect(isCanvasDocument(added.document)).toBe(false);
    expect(isCanvasDocument({
      ...added.document,
      objects: [{ ...added.object, gcpServiceId: "../../private" }],
    })).toBe(false);
  });

  it("persists forward, backward, front, and back layer ordering", () => {
    const first = addObject(createBlankDocument(), "rectangle", 0, 0);
    const second = addObject(first.document, "sticky", 10, 10);
    const third = addObject(second.document, "ellipse", 20, 20);
    const ids = [first.object.id, second.object.id, third.object.id];

    expect(reorderObject(third.document, ids[1], "forward").objects.map((object) => object.id)).toEqual([ids[0], ids[2], ids[1]]);
    expect(reorderObject(third.document, ids[1], "backward").objects.map((object) => object.id)).toEqual([ids[1], ids[0], ids[2]]);
    expect(reorderObject(third.document, ids[0], "front").objects.map((object) => object.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(reorderObject(third.document, ids[2], "back").objects.map((object) => object.id)).toEqual([ids[2], ids[0], ids[1]]);
  });
});
