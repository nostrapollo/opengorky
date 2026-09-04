import { describe, expect, it } from "vitest";
import { addObject, createBlankDocument, isCanvasDocument, type CanvasDocument } from "./model";
import { createCanvasClipboard, pasteCanvasClipboard } from "./clipboard";

describe("canvas object clipboard", () => {
  it("copies selected objects and only connectors within the selection", () => {
    const first = addObject(createBlankDocument(), "rectangle", 10, 20);
    const second = addObject(first.document, "ellipse", 200, 30);
    const third = addObject(second.document, "sticky", 400, 40);
    const document: CanvasDocument = {
      ...third.document,
      connectors: [
        { id: "inside", fromId: first.object.id, toId: second.object.id, color: "#111111" },
        { id: "outside", fromId: second.object.id, toId: third.object.id, color: "#222222" },
      ],
    };

    const contents = createCanvasClipboard(document, [first.object.id, second.object.id]);
    if (!contents) throw new Error("Expected copied canvas items");
    const target = createBlankDocument("Target");
    const pasted = pasteCanvasClipboard(target, contents);

    expect(pasted?.document.objects).toHaveLength(2);
    expect(pasted?.document.connectors).toHaveLength(1);
    expect(pasted?.document.connectors[0]).toMatchObject({ color: "#111111" });
    expect(pasted?.objectIds).toHaveLength(2);
    expect(isCanvasDocument(pasted?.document)).toBe(true);
  });

  it("assigns new identities and offsets every pasted item", () => {
    const added = addObject(createBlankDocument(), "rectangle", 10, 20);
    const contents = createCanvasClipboard(added.document, [added.object.id]);
    if (!contents) throw new Error("Expected copied canvas item");
    const pasted = pasteCanvasClipboard(added.document, contents, 48);

    expect(pasted?.document.objects[1]).toMatchObject({ x: 58, y: 68 });
    expect(pasted?.document.objects[1].id).not.toBe(added.object.id);
  });

  it("rejects malformed or foreign clipboard data", () => {
    expect(pasteCanvasClipboard(createBlankDocument(), "not json")).toBeNull();
    expect(pasteCanvasClipboard(createBlankDocument(), JSON.stringify({ type: "other", version: 1 }))).toBeNull();
  });
});
