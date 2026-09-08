import { describe, expect, it } from "vitest";
import { createBlankDocument, touchDocument } from "./model";
import { documentContentChanged, isUndoShortcut, popUndoSnapshot, pushUndoSnapshot } from "./history";

describe("undo history", () => {
  it("recognizes Ctrl+Z and Cmd+Z without intercepting modified shortcuts", () => {
    const event = { key: "z", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
    expect(isUndoShortcut(event)).toBe(true);
    expect(isUndoShortcut({ ...event, ctrlKey: false, metaKey: true, key: "Z" })).toBe(true);
    expect(isUndoShortcut({ ...event, shiftKey: true })).toBe(false);
    expect(isUndoShortcut({ ...event, altKey: true })).toBe(false);
  });

  it("ignores timestamp-only changes", () => {
    const document = createBlankDocument("Plan");
    expect(documentContentChanged(document, { ...document, updatedAt: "2099-01-01T00:00:00.000Z" })).toBe(false);
    expect(documentContentChanged(document, touchDocument({ ...document, title: "Updated plan" }))).toBe(true);
  });

  it("returns the latest snapshot and removes it from history", () => {
    const first = createBlankDocument("First");
    const second = createBlankDocument("Second");
    const result = popUndoSnapshot(pushUndoSnapshot([first], second));

    expect(result?.snapshot).toBe(second);
    expect(result?.history).toEqual([first]);
  });

  it("limits retained snapshots", () => {
    const documents = ["One", "Two", "Three"].map(createBlankDocument);
    const history = documents.reduce(
      (current, document) => pushUndoSnapshot(current, document, 2),
      [] as typeof documents,
    );

    expect(history.map((document) => document.title)).toEqual(["Two", "Three"]);
  });
});
