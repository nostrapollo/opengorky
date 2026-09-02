"use client";

import {
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  ArrowUpToLine,
  Check,
  Circle,
  Cloud,
  Copy,
  Download,
  FileCode2,
  FolderOpen,
  Hand,
  LoaderCircle,
  Maximize2,
  Menu,
  MousePointer2,
  PanelLeftClose,
  Plus,
  RectangleHorizontal,
  Search,
  Shapes,
  StickyNote,
  TextAlignCenter,
  Trash2,
  Type,
  Upload,
  Zap,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { KonvaSurface } from "./KonvaSurface";
import {
  addObject,
  addProcessShapeObject,
  addGcpServiceObject,
  addImageObject,
  addLinkObject,
  createBlankDocument,
  createDemoDocument,
  deleteObjects,
  documentToCatalog,
  duplicateObject,
  fitViewportToObjects,
  makeId,
  reorderObject,
  touchDocument,
  updateObject,
  type CanvasDocument,
  type CanvasObject,
  type BorderStyle,
  type CatalogEntry,
  type ObjectKind,
  type TextAlign,
  type TextVerticalAlign,
  type Tool,
  type LayerMove,
  type Viewport,
} from "../lib/model";
import {
  PROCESS_SHAPES,
  processShapePaths,
  type ProcessShapeKind,
} from "../lib/processShapes";
import { createCanvasExport, importCanvasFile } from "../lib/transfer";
import { createCanvasHtmlExport } from "../lib/htmlExport";
import {
  listDocuments,
  loadDocument,
  removeDocument,
  requestPersistentStorage,
  saveDocument,
  storageDetails,
} from "../lib/persistence";
import {
  GCP_CATEGORIES,
  GCP_SERVICES,
  gcpIconUrl,
  searchGcpServices,
} from "../lib/gcpCatalog";

type SaveState = "loading" | "saving" | "saved" | "error";

const TOOL_ITEMS: Array<{ tool: Tool; label: string; icon: typeof MousePointer2; shortcut?: string }> = [
  { tool: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { tool: "hand", label: "Pan", icon: Hand, shortcut: "H" },
  { tool: "rectangle", label: "Rectangle", icon: RectangleHorizontal, shortcut: "R" },
  { tool: "ellipse", label: "Ellipse", icon: Circle, shortcut: "O" },
  { tool: "sticky", label: "Sticky note", icon: StickyNote, shortcut: "N" },
  { tool: "text", label: "Text", icon: Type, shortcut: "T" },
  { tool: "connector", label: "Connect", icon: ArrowRight, shortcut: "C" },
];

function ProcessShapePreview({ kind }: { kind: ProcessShapeKind }) {
  const paths = processShapePaths(kind, 180, 100);
  return (
    <svg viewBox="0 0 200 120" aria-hidden="true">
      <g transform="translate(10 10)">
        <path d={paths.body} />
        {paths.detail && <path className="process-shape-preview-detail" d={paths.detail} />}
      </g>
    </svg>
  );
}

function downloadExport(exported: { contents: string; fileName: string; mimeType: string }) {
  const blob = new Blob([exported.contents], { type: exported.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = exported.fileName;
  anchor.hidden = true;
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatTime(value: string) {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function splitCardText(text: string) {
  const [title, ...rest] = text.split("\n");
  return { title: title || "Rich card", body: rest.join("\n") || "Add supporting detail." };
}

const STICKY_COLORS = [
  { fill: "#ffe797", stroke: "#d8ad32" },
  { fill: "#f8e8ef", stroke: "#cc8ca7" },
  { fill: "#e4f8ef", stroke: "#72b895" },
  { fill: "#eef0ff", stroke: "#8b91d7" },
  { fill: "#ffffff", stroke: "#b9bbc5" },
];

function autoGrowSticky(object: CanvasObject, text: string) {
  if (object.kind !== "sticky" || object.autoGrow === false) return {};
  const fontSize = object.fontSize ?? 17;
  const charactersPerLine = Math.max(8, Math.floor((object.width - 32) / (fontSize * 0.56)));
  const visualLines = text.split("\n").reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
    0,
  );
  return { height: Math.max(object.height, Math.ceil(visualLines * fontSize * 1.35 + 32)) };
}

function shapeToolbarStyle(
  object: CanvasObject,
  viewport: Viewport,
  canvasSize: { width: number; height: number },
): CSSProperties {
  const angle = (object.rotation * Math.PI) / 180;
  const rotationHandleX = viewport.x + (object.x + (object.width / 2) * Math.cos(angle)) * viewport.scale;
  const corners = [
    [0, 0],
    [object.width, 0],
    [object.width, object.height],
    [0, object.height],
  ].map(([x, y]) => object.y + x * Math.sin(angle) + y * Math.cos(angle));
  const objectTop = viewport.y + Math.min(...corners) * viewport.scale;
  const estimatedWidth = object.kind === "sticky" ? 650 : object.kind === "text" ? 420 : 410;
  const sideGap = 28;
  const edgeGap = 12;
  const bottom = Math.max(54, objectTop - 12);

  if (rotationHandleX + sideGap + estimatedWidth <= canvasSize.width - edgeGap) {
    return { left: rotationHandleX + sideGap, top: bottom, transform: "translate(0, -100%)" };
  }
  if (rotationHandleX - sideGap - estimatedWidth >= edgeGap) {
    return { left: rotationHandleX - sideGap, top: bottom, transform: "translate(-100%, -100%)" };
  }
  return {
    left: Math.min(canvasSize.width - estimatedWidth / 2 - edgeGap, Math.max(estimatedWidth / 2 + edgeGap, rotationHandleX)),
    top: Math.max(54, objectTop - 70),
    transform: "translate(-50%, -100%)",
  };
}

function textEditorPaddingTop(object: CanvasObject) {
  const plainText = object.kind === "text";
  const verticalAlign = object.textVerticalAlign ?? (object.kind === "sticky" || plainText ? "top" : "middle");
  const edgePadding = plainText ? 0 : 14;
  if (verticalAlign === "top") return edgePadding;
  const fontSize = object.kind === "sticky" ? object.fontSize ?? 17 : plainText ? object.fontSize ?? 18 : 17;
  const lineCount = Math.max(1, object.text.split("\n").length);
  const textHeight = lineCount * fontSize * 1.35;
  return verticalAlign === "bottom"
    ? Math.max(edgePadding, object.height - textHeight - edgePadding)
    : Math.max(edgePadding, (object.height - textHeight) / 2);
}

async function readClipboardImage(file: File) {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image"));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Could not decode pasted image"));
    image.src = src;
  });
  return { src, ...dimensions, name: file.name || "Pasted image" };
}

function clipboardUrls(data: DataTransfer | null) {
  if (!data) return [];
  const source = data.getData("text/uri-list") || data.getData("text/plain");
  const urls = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? [url.href] : [];
      } catch {
        return [];
      }
    });
  if (urls.length > 0) return urls;

  return Array.from(new DOMParser().parseFromString(data.getData("text/html"), "text/html").querySelectorAll("a[href]"))
    .flatMap((anchor) => {
      try {
        const url = new URL(anchor.getAttribute("href") ?? "");
        return url.protocol === "http:" || url.protocol === "https:" ? [url.href] : [];
      } catch {
        return [];
      }
    });
}

export function CanvasWorkspace() {
  const [document, setDocument] = useState<CanvasDocument | null>(null);
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [connectorSource, setConnectorSource] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 90, y: 70, scale: 1 });
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [query, setQuery] = useState("");
  const [gcpQuery, setGcpQuery] = useState("");
  const [gcpPanelOpen, setGcpPanelOpen] = useState(false);
  const [processPanelOpen, setProcessPanelOpen] = useState(false);
  const [processShape, setProcessShape] = useState<ProcessShapeKind>("process");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [layerMenu, setLayerMenu] = useState<{ objectId: string; x: number; y: number } | null>(null);
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof storageDetails>> | null>(null);
  const [fps, setFps] = useState(60);
  const [statusMessage, setStatusMessage] = useState("Preparing local workspace…");
  const canvasRef = useRef<HTMLDivElement>(null);
  const gcpPackButtonRef = useRef<HTMLButtonElement>(null);
  const processPackButtonRef = useRef<HTMLButtonElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef("");
  const loadedRef = useRef(false);
  const workspaceReady = document !== null;

  const refreshEntries = useCallback(async () => {
    const next = await listDocuments();
    setEntries(next);
    return next;
  }, []);

  const openFile = useCallback(async (fileId: string) => {
    setSaveState("loading");
    const next = await loadDocument(fileId);
    lastSavedRef.current = JSON.stringify(next);
    loadedRef.current = true;
    setDocument(next);
    setSelectedIds([]);
    setConnectorSource(null);
    setQuery("");
    setViewport({ x: 90, y: 70, scale: 1 });
    setSaveState("saved");
    setStatusMessage(`Opened ${next.title}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let library = await refreshEntries();
        if (library.length === 0) {
          const demo = createDemoDocument();
          await saveDocument(demo);
          library = await refreshEntries();
        }
        if (cancelled || library.length === 0) return;
        await openFile(library[0].id);
        if (!cancelled) {
          setStorage(await storageDetails());
          setStatusMessage("Local workspace ready");
        }
      } catch (error) {
        if (!cancelled) {
          setSaveState("error");
          setStatusMessage(error instanceof Error ? error.message : "Could not open local workspace");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openFile, refreshEntries]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, Math.round(entry.contentRect.width)),
        height: Math.max(320, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [workspaceReady]);

  useEffect(() => {
    if (!document || !loadedRef.current) return;
    const serialized = JSON.stringify(document);
    if (serialized === lastSavedRef.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void saveDocument(document)
        .then(async () => {
          lastSavedRef.current = JSON.stringify(document);
          setSaveState("saved");
          setEntries((current) => {
            const entry = documentToCatalog(document);
            return [entry, ...current.filter((item) => item.id !== document.id)].sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            );
          });
          setStorage(await storageDetails());
        })
        .catch(() => setSaveState("error"));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [document]);

  useEffect(() => {
    let frameCount = 0;
    let start = performance.now();
    let animation = 0;
    const measure = (now: number) => {
      frameCount += 1;
      if (now - start >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - start)));
        frameCount = 0;
        start = now;
      }
      animation = requestAnimationFrame(measure);
    };
    animation = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animation);
  }, []);

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => entry.searchableText.includes(normalized));
  }, [entries, query]);

  const filteredGcpServices = useMemo(() => searchGcpServices(gcpQuery), [gcpQuery]);

  const selectedTextShape = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return document?.objects.find((object) =>
      object.id === selectedIds[0] && ["rectangle", "ellipse", "sticky", "text", "process-shape"].includes(object.kind),
    ) ?? null;
  }, [document, selectedIds]);

  const commitDocument = useCallback((next: CanvasDocument) => {
    setDocument(next);
  }, []);

  const createFile = useCallback(async () => {
    const next = createBlankDocument(`Untitled canvas ${entries.length + 1}`);
    await saveDocument(next);
    await refreshEntries();
    await openFile(next.id);
  }, [entries.length, openFile, refreshEntries]);

  const duplicateFile = useCallback(async () => {
    if (!document) return;
    const now = new Date().toISOString();
    const next = {
      ...structuredClone(document),
      id: makeId("file"),
      title: `${document.title} copy`,
      createdAt: now,
      updatedAt: now,
    };
    await saveDocument(next);
    await refreshEntries();
    await openFile(next.id);
  }, [document, openFile, refreshEntries]);

  const deleteFile = useCallback(async () => {
    if (!document || entries.length <= 1) return;
    const nextId = entries.find((entry) => entry.id !== document.id)?.id;
    await removeDocument(document.id);
    await refreshEntries();
    if (nextId) await openFile(nextId);
  }, [document, entries, openFile, refreshEntries]);

  const renameDocument = useCallback((title: string) => {
    setDocument((current) => (current ? touchDocument({ ...current, title }) : current));
  }, []);

  const renameSavedFile = useCallback(
    async (fileId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const source = document?.id === fileId ? document : await loadDocument(fileId);
      const next = touchDocument({ ...source, title: trimmed });
      await saveDocument(next);
      if (document?.id === fileId) {
        lastSavedRef.current = JSON.stringify(next);
        setDocument(next);
      }
      setEntries((current) =>
        [documentToCatalog(next), ...current.filter((entry) => entry.id !== fileId)].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
      setStatusMessage(`Renamed canvas to ${trimmed}`);
    },
    [document],
  );

  const finishFileRename = useCallback(() => {
    if (!renamingFileId) return;
    const fileId = renamingFileId;
    const title = renameDraft;
    setRenamingFileId(null);
    setRenameDraft("");
    if (title.trim()) {
      void renameSavedFile(fileId, title).catch((error) =>
        setStatusMessage(error instanceof Error ? error.message : "Could not rename canvas"),
      );
    }
  }, [renameDraft, renameSavedFile, renamingFileId]);

  const handleCreate = useCallback(
    (kind: ObjectKind, x: number, y: number, width?: number, height?: number) => {
      if (!document) return;
      const size = width !== undefined && height !== undefined ? { width, height } : undefined;
      const result = kind === "process-shape"
        ? addProcessShapeObject(document, processShape, x, y, size)
        : addObject(document, kind, x, y, size);
      commitDocument(result.document);
      setSelectedIds([result.object.id]);
      setTool("select");
      if (kind === "sticky" || kind === "text" || kind === "rich-card") setEditingId(result.object.id);
    },
    [commitDocument, document, processShape],
  );

  const placeGcpService = useCallback((serviceId: string, point?: { x: number; y: number }) => {
    if (!document) return;
    const width = 156;
    const height = 128;
    const center = point ?? {
      x: (size.width / 2 - viewport.x) / viewport.scale,
      y: (size.height / 2 - viewport.y) / viewport.scale,
    };
    const result = addGcpServiceObject(document, serviceId, center.x - width / 2, center.y - height / 2);
    commitDocument(result.document);
    setSelectedIds([result.object.id]);
    setEditingId(null);
    setTool("select");
    const service = GCP_SERVICES.find((item) => item.id === serviceId);
    setStatusMessage(`Added ${service?.name ?? "Google Cloud service"}`);
  }, [commitDocument, document, size.height, size.width, viewport.scale, viewport.x, viewport.y]);

  const dropGcpService = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const serviceId = event.dataTransfer.getData("application/x-opengorky-gcp-service");
    if (!serviceId || !GCP_SERVICES.some((service) => service.id === serviceId)) return;
    event.preventDefault();
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    placeGcpService(serviceId, {
      x: (event.clientX - bounds.left - viewport.x) / viewport.scale,
      y: (event.clientY - bounds.top - viewport.y) / viewport.scale,
    });
  }, [placeGcpService, viewport.scale, viewport.x, viewport.y]);

  const handleTransform = useCallback(
    (objectId: string, patch: Partial<CanvasObject>) => {
      setDocument((current) => (current ? updateObject(current, objectId, patch) : current));
    },
    [],
  );

  const duplicateDuringDrag = useCallback((objectId: string, offset?: { x: number; y: number }) => {
    setDocument((current) => current ? duplicateObject(current, objectId, offset)?.document ?? current : current);
  }, []);

  const duplicateSelectedObject = useCallback(() => {
    if (!document || selectedIds.length !== 1) return;
    const result = duplicateObject(document, selectedIds[0]);
    if (!result) return;
    commitDocument(result.document);
    setSelectedIds([result.object.id]);
    setStatusMessage("Duplicated object");
  }, [commitDocument, document, selectedIds]);

  const handleObjectTextChange = useCallback((object: CanvasObject, text: string) => {
    handleTransform(object.id, { text, ...autoGrowSticky(object, text) });
  }, [handleTransform]);

  const handleCanvasSelect = useCallback((objectIds: string[]) => {
    setSelectedIds(objectIds);
    setEditingId((current) => current && !objectIds.includes(current) ? null : current);
  }, []);

  const openLayerMenu = useCallback((objectId: string, x: number, y: number) => {
    setSelectedIds([objectId]);
    setEditingId(null);
    setLayerMenu({
      objectId,
      x: Math.min(x, window.innerWidth - 190),
      y: Math.min(y, window.innerHeight - 190),
    });
  }, []);

  const moveObjectLayer = useCallback((move: LayerMove) => {
    if (!layerMenu) return;
    setDocument((current) => current ? reorderObject(current, layerMenu.objectId, move) : current);
    setLayerMenu(null);
    setStatusMessage(
      move === "front" ? "Brought object to front"
        : move === "forward" ? "Brought object forward"
          : move === "backward" ? "Sent object backward"
            : "Sent object to back",
    );
  }, [layerMenu]);

  useEffect(() => {
    if (!layerMenu) return;
    const close = () => setLayerMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [layerMenu]);

  const pasteImages = useCallback(async (files: File[]) => {
    if (!document || files.length === 0) return;
    const images = await Promise.all(files.map(readClipboardImage));
    const center = {
      x: (size.width / 2 - viewport.x) / viewport.scale,
      y: (size.height / 2 - viewport.y) / viewport.scale,
    };
    let next = document;
    const pastedIds: string[] = [];
    images.forEach((image, index) => {
      const scale = Math.min(1, 720 / image.width, 520 / image.height);
      const width = Math.max(1, image.width * scale);
      const height = Math.max(1, image.height * scale);
      const result = addImageObject(
        next,
        image.src,
        center.x - width / 2 + index * 28,
        center.y - height / 2 + index * 28,
        width,
        height,
        image.name,
      );
      next = result.document;
      pastedIds.push(result.object.id);
    });
    commitDocument(next);
    setSelectedIds(pastedIds);
    setEditingId(null);
    setTool("select");
    setStatusMessage(`Pasted ${images.length} image${images.length === 1 ? "" : "s"}`);
  }, [commitDocument, document, size.height, size.width, viewport.scale, viewport.x, viewport.y]);

  const pasteLinks = useCallback((urls: string[]) => {
    if (!document || urls.length === 0) return;
    const center = {
      x: (size.width / 2 - viewport.x) / viewport.scale,
      y: (size.height / 2 - viewport.y) / viewport.scale,
    };
    let next = document;
    const pastedIds: string[] = [];
    urls.forEach((url, index) => {
      const result = addLinkObject(next, url, center.x - 160 + index * 28, center.y - 66 + index * 28);
      next = result.document;
      pastedIds.push(result.object.id);
    });
    commitDocument(next);
    setSelectedIds(pastedIds);
    setEditingId(null);
    setTool("select");
    setStatusMessage(`Pasted ${urls.length} link${urls.length === 1 ? "" : "s"} · Double-click to open`);
  }, [commitDocument, document, size.height, size.width, viewport.scale, viewport.x, viewport.y]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .flatMap((item) => {
          const file = item.getAsFile();
          return file ? [file] : [];
        });
      if (files.length === 0) {
        const urls = clipboardUrls(event.clipboardData);
        if (urls.length === 0) return;
        event.preventDefault();
        pasteLinks(urls);
        return;
      }
      event.preventDefault();
      void pasteImages(files).catch((error) =>
        setStatusMessage(error instanceof Error ? error.message : "Could not paste image"),
      );
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [pasteImages, pasteLinks]);

  const handleObjectActivate = useCallback(
    (objectId: string) => {
      if (!document) return;
      const object = document.objects.find((item) => item.id === objectId);
      if (!object) return;
      if (tool === "connector") {
        if (!connectorSource) {
          setConnectorSource(objectId);
          setSelectedIds([objectId]);
          setStatusMessage("Choose a second object to connect");
          return;
        }
        if (connectorSource !== objectId) {
          commitDocument(
            touchDocument({
              ...document,
              connectors: [
                ...document.connectors,
                {
                  id: makeId("connector"),
                  fromId: connectorSource,
                  toId: objectId,
                  color: "#6670d9",
                },
              ],
            }),
          );
        }
        setConnectorSource(null);
        setTool("select");
        setStatusMessage("Connector created");
        return;
      }
      handleCanvasSelect([objectId]);
    },
    [commitDocument, connectorSource, document, handleCanvasSelect, tool],
  );

  const deleteSelected = useCallback(() => {
    if (!document || selectedIds.length === 0) return;
    commitDocument(deleteObjects(document, selectedIds));
    setSelectedIds([]);
    setEditingId(null);
  }, [commitDocument, document, selectedIds]);

  const fitAllContent = useCallback(() => {
    if (!document || document.objects.length === 0) return;
    setViewport(fitViewportToObjects(document.objects, size.width, size.height));
    setStatusMessage("Fit all content");
  }, [document, size.height, size.width]);

  const closeGcpPanel = useCallback(() => {
    setGcpPanelOpen(false);
    window.requestAnimationFrame(() => gcpPackButtonRef.current?.focus());
  }, []);

  const closeProcessPanel = useCallback(() => {
    setProcessPanelOpen(false);
    window.requestAnimationFrame(() => processPackButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && processPanelOpen) {
        event.preventDefault();
        closeProcessPanel();
        return;
      }
      if (event.key === "Escape" && gcpPanelOpen) {
        event.preventDefault();
        closeGcpPanel();
        return;
      }
      const target = event.target as HTMLElement | null;
      const editing = target?.matches("input, textarea, [contenteditable='true']");
      if (editing) return;
      if ((event.key === "Backspace" || event.key === "Delete") && selectedIds.length > 0) {
        event.preventDefault();
        deleteSelected();
      }
      if (event.key === "1") {
        event.preventDefault();
        fitAllContent();
      }
      const shortcuts: Record<string, Tool> = {
        v: "select",
        h: "hand",
        r: "rectangle",
        o: "ellipse",
        n: "sticky",
        t: "text",
        c: "connector",
      };
      if (shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeGcpPanel, closeProcessPanel, deleteSelected, fitAllContent, gcpPanelOpen, processPanelOpen, selectedIds.length]);

  const exportDocument = useCallback(() => {
    if (!document) return;
    const exported = createCanvasExport(document);
    downloadExport(exported);
    setStatusMessage(`Exported ${exported.fileName}`);
  }, [document]);

  const exportHtmlDocument = useCallback(() => {
    if (!document) return;
    const exported = createCanvasHtmlExport(document);
    downloadExport(exported);
    setStatusMessage(`Exported ${exported.fileName}`);
  }, [document]);

  const importDocument = useCallback(
    async (file: File) => {
      await importCanvasFile(file, entries.map((entry) => entry.id), {
        saveDocument,
        refreshEntries,
        openFile,
      });
    },
    [entries, openFile, refreshEntries],
  );

  const startMiddleViewportPan = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 1) return false;
      event.preventDefault();
      event.stopPropagation();
      const start = { x: event.clientX, y: event.clientY, viewportX: viewport.x, viewportY: viewport.y };
      const move = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        setViewport((current) => ({
          ...current,
          x: start.viewportX + moveEvent.clientX - start.x,
          y: start.viewportY + moveEvent.clientY - start.y,
        }));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return true;
    },
    [viewport.x, viewport.y],
  );

  const startOverlayDrag = useCallback(
    (event: React.PointerEvent, object: CanvasObject) => {
      if (startMiddleViewportPan(event)) return;
      if (event.button !== 0) return;
      if (tool !== "select" || (event.target as HTMLElement).closest("button, textarea")) return;
      event.preventDefault();
      setSelectedIds([object.id]);
      const start = { x: event.clientX, y: event.clientY, objectX: object.x, objectY: object.y };
      const move = (moveEvent: PointerEvent) => {
        handleTransform(object.id, {
          x: start.objectX + (moveEvent.clientX - start.x) / viewport.scale,
          y: start.objectY + (moveEvent.clientY - start.y) / viewport.scale,
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [handleTransform, startMiddleViewportPan, tool, viewport.scale],
  );

  const protectStorage = useCallback(async () => {
    const granted = await requestPersistentStorage();
    setStorage(await storageDetails());
    setStatusMessage(granted ? "Browser granted persistent storage" : "Browser kept standard storage policy");
  }, []);

  if (!document) {
    return (
      <main className="boot-screen">
        <div className="boot-mark">og</div>
        <LoaderCircle className="spin" size={22} />
        <p>{statusMessage}</p>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div className="brand-block">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle files">
            <Menu size={18} />
          </button>
          <div className="brand-mark">og</div>
          <div>
            <strong>opengorky</strong>
            <span>local canvas</span>
          </div>
        </div>

        <div className="document-heading">
          <input
            aria-label="Canvas title"
            value={document.title}
            onChange={(event) => renameDocument(event.target.value)}
          />
          <div className={`save-indicator ${saveState}`}>
            {saveState === "saving" && <LoaderCircle className="spin" size={13} />}
            {saveState === "saved" && <Check size={13} />}
            {saveState === "error" && <span>!</span>}
            {saveState === "loading" ? "Opening" : saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved locally" : "Save failed"}
          </div>
        </div>

      </header>

      <section className="workspace-grid">
        <aside className={`file-sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-header">
            <div>
              <span className="eyebrow">Workspace</span>
              <h2>Your canvases</h2>
            </div>
            <button className="icon-button" onClick={() => setSidebarOpen(false)} aria-label="Close files panel">
              <PanelLeftClose size={17} />
            </button>
          </div>

          <button className="new-file-button" onClick={() => void createFile()}>
            <Plus size={17} />
            New canvas
          </button>

          <label className="search-box">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles and text" />
          </label>

          <div className="file-list" role="list">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={`file-row ${entry.id === document.id ? "selected" : ""}`}
                onClick={() => void openFile(entry.id)}
                role="listitem"
                tabIndex={renamingFileId === entry.id ? -1 : 0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openFile(entry.id);
                  }
                }}
              >
                <span className="file-thumb"><Shapes size={17} /></span>
                <span className="file-copy">
                  {renamingFileId === entry.id ? (
                    <input
                      className="file-name-input"
                      autoFocus
                      value={renameDraft}
                      aria-label={`Rename ${entry.title}`}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={finishFileRename}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter") {
                          event.preventDefault();
                          finishFileRename();
                        } else if (event.key === "Escape") {
                          setRenamingFileId(null);
                          setRenameDraft("");
                        }
                      }}
                    />
                  ) : (
                    <strong
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRenamingFileId(entry.id);
                        setRenameDraft(entry.title);
                      }}
                    >
                      {entry.title}
                    </strong>
                  )}
                  <small>{entry.objectCount} objects · {formatTime(entry.updatedAt)}</small>
                </span>
              </div>
            ))}
            {filteredEntries.length === 0 && <p className="empty-search">No canvas matches “{query}”.</p>}
          </div>

          <div className="file-actions">
            <span className="eyebrow">File actions</span>
            <button onClick={duplicateFile}><Copy size={15} /> Duplicate</button>
            <button onClick={exportDocument}><Download size={15} /> Export JSON</button>
            <button onClick={exportHtmlDocument}><FileCode2 size={15} /> Export HTML</button>
            <button onClick={() => importRef.current?.click()}><Upload size={15} /> Import JSON</button>
            <input
              ref={importRef}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importDocument(file).catch((error) => setStatusMessage(error.message));
                event.target.value = "";
              }}
            />
            <button className="danger-link" onClick={deleteFile} disabled={entries.length <= 1}>
              <Trash2 size={15} /> Delete canvas
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="storage-line">
              <span className="storage-dot" />
              <div>
                <strong>{storage?.backend === "opfs" ? "Origin-private files" : "IndexedDB fallback"}</strong>
                <small>{storage ? `${bytes(storage.usage)} used` : "Checking storage…"}</small>
              </div>
            </div>
            <button className="text-button" onClick={() => void protectStorage()}>
              {storage?.persistent ? "Storage protected" : "Protect local storage"}
            </button>
            <div className="project-links">
              <a href="privacy/">Privacy</a>
              <a href="https://github.com/nostrapollo/opengorky" target="_blank" rel="noreferrer">GitHub</a>
            </div>
          </div>
        </aside>

        <section className="canvas-column">
          {!sidebarOpen && (
            <button className="floating-panel-button left" onClick={() => setSidebarOpen(true)} aria-label="Open files panel">
              <FolderOpen size={17} />
            </button>
          )}

          <nav className="tool-dock" aria-label="Canvas tools">
              {TOOL_ITEMS.map((item, index) => {
                const Icon = item.icon;
                const divider = index === 2;
                return (
                  <span
                    key={item.tool}
                    className={`tool-slot ${divider ? "tool-with-divider" : ""}`}
                    data-tooltip={item.shortcut ? `${item.label} · ${item.shortcut}` : item.label}
                  >
                    <button
                      className={`tool-button ${tool === item.tool ? "active" : ""}`}
                      aria-label={item.label}
                      aria-keyshortcuts={item.shortcut}
                      aria-pressed={tool === item.tool}
                      onClick={() => {
                        setTool(item.tool);
                        setConnectorSource(null);
                        setStatusMessage(item.tool === "connector" ? "Choose the first object to connect" : item.label);
                      }}
                    >
                      <Icon size={18} />
                    </button>
                  </span>
                );
              })}
              <span className="tool-slot tool-with-divider" data-tooltip="Process diagram shapes">
                <button
                  ref={processPackButtonRef}
                  className={`tool-button ${tool === "process-shape" || processPanelOpen ? "active" : ""}`}
                  aria-label="Process diagram shapes"
                  aria-expanded={processPanelOpen}
                  aria-controls="process-shape-pack"
                  onClick={() => {
                    setProcessPanelOpen((current) => !current);
                    setGcpPanelOpen(false);
                    setConnectorSource(null);
                    setStatusMessage("Process diagram shapes");
                  }}
                >
                  <Shapes size={18} />
                </button>
              </span>
              <span className="tool-slot tool-with-divider" data-tooltip="Google Cloud architecture pack">
                <button
                  ref={gcpPackButtonRef}
                  className={`tool-button ${gcpPanelOpen ? "active" : ""}`}
                  aria-label="Google Cloud architecture pack"
                  aria-expanded={gcpPanelOpen}
                  aria-controls="gcp-architecture-pack"
                  onClick={() => {
                    setGcpPanelOpen((current) => !current);
                    setProcessPanelOpen(false);
                    setConnectorSource(null);
                    setStatusMessage("Google Cloud architecture pack");
                  }}
                >
                  <Cloud size={18} />
                </button>
              </span>
          </nav>

          {processPanelOpen && (
            <section id="process-shape-pack" className="process-shape-pack" aria-label="Process diagram shapes">
              <header className="process-shape-pack-header">
                <div>
                  <span className="eyebrow">Shapes</span>
                  <h2>Process diagrams</h2>
                </div>
                <button className="icon-button" aria-label="Close process diagram shapes" onClick={closeProcessPanel}>
                  <X size={16} />
                </button>
              </header>
              <div className="process-shape-grid">
                {PROCESS_SHAPES.map((shape) => (
                  <button
                    key={shape.kind}
                    className={processShape === shape.kind ? "selected" : ""}
                    aria-label={shape.label}
                    onClick={() => {
                      setProcessShape(shape.kind);
                      setProcessPanelOpen(false);
                      setTool("process-shape");
                      setConnectorSource(null);
                      setStatusMessage(`${shape.label}: click or drag to draw`);
                    }}
                  >
                    <ProcessShapePreview kind={shape.kind} />
                    <span>{shape.label}</span>
                  </button>
                ))}
              </div>
              <footer>Choose a symbol, then click or drag on the canvas.</footer>
            </section>
          )}

          {gcpPanelOpen && (
            <section id="gcp-architecture-pack" className="gcp-pack" aria-label="Google Cloud architecture pack">
              <header className="gcp-pack-header">
                <div>
                  <span className="eyebrow">Architecture pack</span>
                  <h2>Google Cloud</h2>
                </div>
                <button className="icon-button" aria-label="Close Google Cloud architecture pack" onClick={closeGcpPanel}>
                  <X size={16} />
                </button>
              </header>
              <label className="gcp-pack-search">
                <Search size={15} />
                <input
                  autoFocus
                  value={gcpQuery}
                  onChange={(event) => setGcpQuery(event.target.value)}
                  placeholder="Search services, e.g. database"
                  aria-label="Search Google Cloud services"
                />
              </label>
              <div className="gcp-pack-list">
                {GCP_CATEGORIES.map((category) => {
                  const services = filteredGcpServices.filter((service) => service.category === category);
                  if (services.length === 0) return null;
                  return (
                    <section className="gcp-pack-category" key={category}>
                      <h3>{category}</h3>
                      <div className="gcp-service-grid">
                        {services.map((service) => (
                          <button
                            key={service.id}
                            draggable
                            title={`Add ${service.name}`}
                            onClick={() => placeGcpService(service.id)}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "copy";
                              event.dataTransfer.setData("application/x-opengorky-gcp-service", service.id);
                              event.dataTransfer.setData("text/plain", service.name);
                            }}
                          >
                            <img src={gcpIconUrl(service.id)} alt="" draggable={false} />
                            <span>{service.name}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
                {filteredGcpServices.length === 0 && (
                  <p className="gcp-pack-empty">No Google Cloud services match “{gcpQuery}”.</p>
                )}
              </div>
              <footer>Click to add at the center, or drag a service onto the canvas.</footer>
            </section>
          )}

          <div
            ref={canvasRef}
            className="canvas-viewport"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("application/x-opengorky-gcp-service")) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={dropGcpService}
          >
            <div
              className="canvas-grid-background"
              style={{
                backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
              }}
            />
            <KonvaSurface
              document={document}
              width={size.width}
              height={size.height}
              tool={tool}
              processShape={processShape}
              viewport={viewport}
              selectedIds={selectedIds}
              editingId={editingId}
              onViewportChange={setViewport}
              onSelect={handleCanvasSelect}
              onObjectActivate={handleObjectActivate}
              onObjectFollow={(objectId) => {
                const object = document.objects.find((item) => item.id === objectId);
                if (object?.kind !== "link" || !object.url) return;
                window.open(object.url, "_blank", "noopener,noreferrer");
                setStatusMessage(`Opened ${new URL(object.url).hostname}`);
              }}
              onObjectDoubleClick={(objectId) => {
                setSelectedIds([objectId]);
                const object = document.objects.find((item) => item.id === objectId);
                if (object?.kind === "link" && object.url) {
                  window.open(object.url, "_blank", "noopener,noreferrer");
                  setStatusMessage(`Opened ${new URL(object.url).hostname}`);
                } else if (object?.kind !== "image") {
                  setEditingId(objectId);
                }
              }}
              onObjectContextMenu={openLayerMenu}
              onCreate={handleCreate}
              onTransform={handleTransform}
              onDuplicate={duplicateDuringDrag}
            />

            <div className="overlay-plane">
              {document.objects.filter((object) => object.kind === "rich-card" && object.id === editingId).map((object) => {
                const card = splitCardText(object.text);
                const selected = selectedIds.includes(object.id);
                const editing = editingId === object.id;
                return (
                  <article
                    key={object.id}
                    className={`rich-card ${selected ? "selected" : ""}`}
                    style={{
                      width: object.width,
                      height: object.height,
                      transform: `translate(${viewport.x + object.x * viewport.scale}px, ${viewport.y + object.y * viewport.scale}px) scale(${viewport.scale}) rotate(${object.rotation}deg)`,
                      transformOrigin: "top left",
                    }}
                    onPointerDown={(event) => startOverlayDrag(event, object)}
                    onAuxClick={(event) => {
                      if (event.button === 1) event.preventDefault();
                    }}
                    onDoubleClick={() => {
                      setSelectedIds([object.id]);
                      setEditingId(object.id);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openLayerMenu(object.id, event.clientX, event.clientY);
                    }}
                  >
                    <div className="card-kicker"><Zap size={12} /> Live DOM object</div>
                    {editing ? (
                      <textarea
                        autoFocus
                        value={object.text}
                        aria-label="Rich card text"
                        onChange={(event) => handleTransform(object.id, { text: event.target.value })}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setEditingId(null);
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    ) : (
                      <>
                        <h3>{card.title}</h3>
                        <p>{card.body}</p>
                      </>
                    )}
                  </article>
                );
              })}

              {editingId && document.objects.filter((object) => object.id === editingId && object.kind !== "rich-card" && object.kind !== "image" && object.kind !== "link").map((object) => (
                <textarea
                  key={object.id}
                  className={`canvas-text-editor ${object.kind === "text" ? "plain-text-editor" : ""}`}
                  autoFocus
                  value={object.text}
                  aria-label="Object text"
                  style={{
                    width: object.width,
                    height: object.height,
                    background: object.fillTransparent ? "transparent" : object.fill,
                    fontSize: object.kind === "sticky" ? object.fontSize ?? 17 : object.kind === "text" ? object.fontSize ?? 18 : 17,
                    textAlign: object.textAlign ?? (object.kind === "sticky" || object.kind === "text" ? "left" : "center"),
                    paddingTop: textEditorPaddingTop(object),
                    transform: `translate(${viewport.x + object.x * viewport.scale}px, ${viewport.y + object.y * viewport.scale}px) scale(${viewport.scale}) rotate(${object.rotation}deg)`,
                    transformOrigin: "top left",
                  }}
                  placeholder={object.kind === "sticky" || object.kind === "text" ? "Type something…" : undefined}
                  onChange={(event) => handleObjectTextChange(object, event.target.value)}
                  onPointerDown={(event) => {
                    startMiddleViewportPan(event);
                  }}
                  onBlur={() => {
                    if (object.kind === "text" && !object.text.trim()) {
                      setDocument((current) => current ? deleteObjects(current, [object.id]) : current);
                      setSelectedIds([]);
                    }
                    setEditingId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      event.currentTarget.blur();
                      return;
                    }
                    if (event.key === "Escape") {
                      if ((object.kind === "sticky" || object.kind === "text") && !object.text.trim()) {
                        setDocument((current) => current ? deleteObjects(current, [object.id]) : current);
                        setSelectedIds([]);
                      }
                      setEditingId(null);
                      event.currentTarget.blur();
                    }
                  }}
                />
              ))}
            </div>

            {selectedTextShape && editingId !== selectedTextShape.id && (
              <div
                className="shape-toolbar"
                role="toolbar"
                aria-label="Shape formatting"
                style={shapeToolbarStyle(selectedTextShape, viewport, size)}
              >
                {selectedTextShape.kind !== "text" && <>
                  <label className="shape-color-control" title="Fill color">
                    <span>Fill</span>
                    <input
                      type="color"
                      aria-label="Shape fill color"
                      value={selectedTextShape.fill}
                      onChange={(event) => handleTransform(selectedTextShape.id, { fill: event.target.value })}
                    />
                  </label>
                  <button
                    className={`shape-transparent-toggle ${selectedTextShape.fillTransparent ? "active" : ""}`}
                    aria-label={selectedTextShape.fillTransparent ? "Use shape fill" : "Make shape fill transparent"}
                    aria-pressed={selectedTextShape.fillTransparent ?? false}
                    title={selectedTextShape.fillTransparent ? "Use fill" : "Transparent fill"}
                    onClick={() => handleTransform(selectedTextShape.id, { fillTransparent: !selectedTextShape.fillTransparent })}
                  >No fill</button>
                  <label className="shape-color-control" title="Border color">
                    <span>Border</span>
                    <input
                      type="color"
                      aria-label="Shape border color"
                      value={selectedTextShape.stroke}
                      disabled={(selectedTextShape.borderStyle ?? "solid") === "none"}
                      onChange={(event) => handleTransform(selectedTextShape.id, { stroke: event.target.value })}
                    />
                  </label>
                  <select
                    className="shape-border-style"
                    aria-label="Shape border style"
                    title="Border style"
                    value={selectedTextShape.borderStyle ?? "solid"}
                    onChange={(event) => handleTransform(selectedTextShape.id, { borderStyle: event.target.value as BorderStyle })}
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="none">None</option>
                  </select>
                  <span className="shape-toolbar-divider" />
                </>}
                {selectedTextShape.kind === "sticky" && <>
                  <div className="sticky-colors" aria-label="Sticky note color">
                    {STICKY_COLORS.map((color) => (
                      <button
                        key={color.fill}
                        className={selectedTextShape.fill === color.fill ? "active" : ""}
                        style={{ background: color.fill }}
                        aria-label={`Set sticky color ${color.fill}`}
                        aria-pressed={selectedTextShape.fill === color.fill}
                        title={`Sticky color ${color.fill}`}
                        onClick={() => handleTransform(selectedTextShape.id, color)}
                      />
                    ))}
                  </div>
                  <span className="shape-toolbar-divider" />
                </>}
                {(selectedTextShape.kind === "sticky" || selectedTextShape.kind === "text") && <>
                  {(selectedTextShape.kind === "sticky" ? [15, 17, 21] : [14, 18, 24, 32]).map((fontSize) => (
                    <button
                      key={fontSize}
                      className={`sticky-text-size ${(selectedTextShape.fontSize ?? (selectedTextShape.kind === "text" ? 18 : 17)) === fontSize ? "active" : ""}`}
                      style={{ fontSize }}
                      aria-label={`Set text size ${fontSize}`}
                      aria-pressed={(selectedTextShape.fontSize ?? (selectedTextShape.kind === "text" ? 18 : 17)) === fontSize}
                      title={`Text size ${fontSize}`}
                      onClick={() => handleTransform(selectedTextShape.id, { fontSize })}
                    >
                      A
                    </button>
                  ))}
                  <span className="shape-toolbar-divider" />
                </>}
                {([
                  ["left", AlignLeft, "Align text left"],
                  ["center", TextAlignCenter, "Align text center"],
                  ["right", AlignRight, "Align text right"],
                ] as const).map(([alignment, Icon, label]) => (
                  <button
                    key={alignment}
                    className={(selectedTextShape.textAlign ?? (selectedTextShape.kind === "sticky" || selectedTextShape.kind === "text" ? "left" : "center")) === alignment ? "active" : ""}
                    aria-label={label}
                    aria-pressed={(selectedTextShape.textAlign ?? (selectedTextShape.kind === "sticky" || selectedTextShape.kind === "text" ? "left" : "center")) === alignment}
                    title={label}
                    onClick={() => handleTransform(selectedTextShape.id, { textAlign: alignment as TextAlign })}
                  ><Icon size={15} /></button>
                ))}
                <span className="shape-toolbar-divider" />
                {([
                  ["top", AlignVerticalJustifyStart, "Align text to top"],
                  ["middle", AlignVerticalJustifyCenter, "Align text vertically center"],
                  ["bottom", AlignVerticalJustifyEnd, "Align text to bottom"],
                ] as const).map(([alignment, Icon, label]) => (
                  <button
                    key={alignment}
                    className={(selectedTextShape.textVerticalAlign ?? (selectedTextShape.kind === "sticky" || selectedTextShape.kind === "text" ? "top" : "middle")) === alignment ? "active" : ""}
                    aria-label={label}
                    aria-pressed={(selectedTextShape.textVerticalAlign ?? (selectedTextShape.kind === "sticky" || selectedTextShape.kind === "text" ? "top" : "middle")) === alignment}
                    title={label}
                    onClick={() => handleTransform(selectedTextShape.id, { textVerticalAlign: alignment as TextVerticalAlign })}
                  ><Icon size={15} /></button>
                ))}
                <span className="shape-toolbar-divider" />
                <button aria-label="Duplicate shape" title="Duplicate" onClick={duplicateSelectedObject}><Copy size={15} /></button>
                <button aria-label="Delete shape" title="Delete" onClick={deleteSelected}><Trash2 size={15} /></button>
              </div>
            )}

            <div className="canvas-statusbar">
              <button
                className="fit-content-button"
                aria-label="Fit all canvas content"
                aria-keyshortcuts="1"
                title="Fit all content · 1"
                disabled={document.objects.length === 0}
                onClick={fitAllContent}
              >
                <Maximize2 size={12} /> Fit all
              </button>
              <span>{Math.round(viewport.scale * 100)}%</span>
              <span>{document.objects.length} objects</span>
              <span className={fps < 45 ? "performance-warn" : ""}>{fps} fps</span>
              <span>{statusMessage}</span>
            </div>
          </div>
        </section>

      </section>

      {layerMenu && (() => {
        const layerIndex = document.objects.findIndex((object) => object.id === layerMenu.objectId);
        const atBack = layerIndex <= 0;
        const atFront = layerIndex === document.objects.length - 1;
        return (
          <div
            className="layer-menu"
            role="menu"
            aria-label="Object layer order"
            style={{ left: layerMenu.x, top: layerMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>Layer order</span>
            <button role="menuitem" disabled={atFront} onClick={() => moveObjectLayer("front")}>
              <ArrowUpToLine size={15} /> Bring to front
            </button>
            <button role="menuitem" disabled={atFront} onClick={() => moveObjectLayer("forward")}>
              <ArrowUp size={15} /> Bring forward
            </button>
            <button role="menuitem" disabled={atBack} onClick={() => moveObjectLayer("backward")}>
              <ArrowDown size={15} /> Send backward
            </button>
            <button role="menuitem" disabled={atBack} onClick={() => moveObjectLayer("back")}>
              <ArrowDownToLine size={15} /> Send to back
            </button>
          </div>
        );
      })()}
    </main>
  );
}
