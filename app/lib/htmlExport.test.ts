import { describe, expect, it } from "vitest";
import {
  addGcpServiceObject,
  addImageObject,
  addLinkObject,
  addObject,
  addProcessShapeObject,
  createBlankDocument,
  updateObject,
} from "./model";
import { CANVAS_HTML_MIME_TYPE, createCanvasHtmlExport } from "./htmlExport";

describe("standalone HTML canvas export", () => {
  it("exports a self-contained HTML viewer with fit, pan, and zoom controls", () => {
    const exported = createCanvasHtmlExport(createBlankDocument("Architecture / Plan"));
    const script = exported.contents.match(/<script>([\s\S]*?)<\/script>/)?.[1];

    expect(exported).toMatchObject({
      fileName: "architecture-plan.canvas.html",
      mimeType: CANVAS_HTML_MIME_TYPE,
    });
    expect(exported.contents).toContain("<!doctype html>");
    expect(exported.contents).toContain('id="fit"');
    expect(exported.contents).toContain('id="zoom-in"');
    expect(exported.contents).toContain('id="zoom-out"');
    expect(exported.contents).toContain("Empty canvas");
    expect(exported.contents).not.toContain("<script src=");
    expect(exported.contents).not.toContain("<link rel=");
    expect(script).toBeTruthy();
    if (!script) throw new Error("Expected an inline viewer script");
    expect(() => new Function(script)).not.toThrow();
  });

  it("renders every canvas object family and connectors into portable SVG", () => {
    let document = createBlankDocument("Portable workflow");
    const rectangle = addObject(document, "rectangle", 0, 0);
    document = rectangle.document;
    document = addObject(document, "ellipse", 220, 0).document;
    document = addObject(document, "sticky", 440, 0).document;
    const text = addObject(document, "text", 680, 0);
    document = updateObject(text.document, text.object.id, { text: "Standalone text" });
    document = addObject(document, "rich-card", 0, 190).document;
    document = addImageObject(document, "data:image/png;base64,abc", 340, 190, 160, 120, "diagram.png").document;
    document = addLinkObject(document, "https://example.com/docs", 540, 190).document;
    document = addGcpServiceObject(document, "cloud-run", 0, 380).document;
    const decision = addProcessShapeObject(document, "decision", 240, 380);
    document = {
      ...decision.document,
      connectors: [{ id: "flow", fromId: rectangle.object.id, toId: decision.object.id, color: "#6670d9" }],
    };
    const exported = createCanvasHtmlExport(document);

    for (const kind of ["rectangle", "ellipse", "sticky", "text", "rich-card", "image", "link", "gcp-service", "process-shape"]) {
      expect(exported.contents).toContain(`kind-${kind}`);
    }
    expect(exported.contents).toContain('marker-end="url(#arrow-0)"');
    expect(exported.contents).toContain('href="data:image/png;base64,abc"');
    expect(exported.contents).toContain('href="https://example.com/docs"');
    expect(exported.contents).toContain('target="_blank"');
    expect(exported.contents).toContain("GOOGLE CLOUD");
    expect(exported.contents).toContain("Decision?");
  });

  it("escapes titles, text, colors, and link attributes instead of producing active markup", () => {
    const title = '</title><script id="attack">alert(1)</script>';
    const added = addObject(createBlankDocument(title), "rectangle", 20, 30);
    const hostile = updateObject(added.document, added.object.id, {
      text: '<img src=x onerror="alert(2)">',
      fill: '#fff" onload="alert(3)',
    });
    const exported = createCanvasHtmlExport(hostile);

    expect(exported.contents).not.toContain('<script id="attack">');
    expect(exported.contents).not.toContain('<img src=x onerror="alert(2)">');
    expect(exported.contents).not.toContain('fill="#fff" onload="alert(3)"');
    expect(exported.contents).toContain("&lt;script id=&quot;attack&quot;&gt;");
    expect(exported.contents).toContain("&lt;img src=x onerror=&quot;alert(2)&quot;&gt;");
    expect(exported.contents).toContain('fill="#fff&quot; onload=&quot;alert(3)"');
  });

  it("includes rotated content in the initial fitted view box", () => {
    const added = addObject(createBlankDocument("Rotated"), "rectangle", -100, -50, { width: 100, height: 50 });
    const rotated = updateObject(added.document, added.object.id, { rotation: 90 });
    const exported = createCanvasHtmlExport(rotated);

    expect(exported.contents).toContain('viewBox="-230 -130 210 260"');
  });
});
