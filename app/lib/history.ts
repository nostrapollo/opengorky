import type { CanvasDocument } from "./model";

export const UNDO_HISTORY_LIMIT = 100;

type UndoKeyboardEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

export function isUndoShortcut(event: UndoKeyboardEvent) {
  return (event.metaKey || event.ctrlKey)
    && !event.altKey
    && !event.shiftKey
    && event.key.toLowerCase() === "z";
}

export function documentContentChanged(before: CanvasDocument, after: CanvasDocument) {
  return before.id !== after.id
    || before.title !== after.title
    || JSON.stringify(before.objects) !== JSON.stringify(after.objects)
    || JSON.stringify(before.connectors) !== JSON.stringify(after.connectors);
}

export function pushUndoSnapshot(
  history: CanvasDocument[],
  snapshot: CanvasDocument,
  limit = UNDO_HISTORY_LIMIT,
) {
  return [...history, snapshot].slice(-Math.max(1, limit));
}

export function popUndoSnapshot(history: CanvasDocument[]) {
  const snapshot = history.at(-1);
  if (!snapshot) return null;
  return { snapshot, history: history.slice(0, -1) };
}
