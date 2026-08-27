import {
  type CanvasDocument,
  type CatalogEntry,
  documentToCatalog,
  isCanvasDocument,
  normalizeCanvasDocument,
} from "./model";

// Keep the pre-opengorky storage keys stable so the product rename does not
// orphan canvases that are already saved in a user's browser.
const DATABASE_NAME = "open-canvas-lab";
const DATABASE_VERSION = 1;
const OPFS_DIRECTORY = "open-canvas-documents";

type Backend = "opfs" | "indexeddb";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase() {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("catalog")) {
      database.createObjectStore("catalog", { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains("documents")) {
      database.createObjectStore("documents", { keyPath: "id" });
    }
  };
  return requestResult(request);
}

async function getOpfsDirectory() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIRECTORY, { create: true });
}

export async function detectBackend(): Promise<Backend> {
  if (typeof navigator !== "undefined" && "getDirectory" in navigator.storage) {
    try {
      await getOpfsDirectory();
      return "opfs";
    } catch {
      return "indexeddb";
    }
  }
  return "indexeddb";
}

async function writeOpfsDocument(document: CanvasDocument) {
  const directory = await getOpfsDirectory();
  const handle = await directory.getFileHandle(`${document.id}.json`, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(document));
  await writable.close();
}

async function readOpfsDocument(documentId: string) {
  const directory = await getOpfsDirectory();
  const handle = await directory.getFileHandle(`${documentId}.json`);
  const file = await handle.getFile();
  return JSON.parse(await file.text()) as unknown;
}

async function deleteOpfsDocument(documentId: string) {
  const directory = await getOpfsDirectory();
  await directory.removeEntry(`${documentId}.json`);
}

async function putCatalog(entry: CatalogEntry, document?: CanvasDocument) {
  const database = await openDatabase();
  const stores = document ? ["catalog", "documents"] : ["catalog"];
  const transaction = database.transaction(stores, "readwrite");
  transaction.objectStore("catalog").put(entry);
  if (document) transaction.objectStore("documents").put(document);
  await transactionDone(transaction);
  database.close();
}

export async function saveDocument(document: CanvasDocument): Promise<Backend> {
  const backend = await detectBackend();
  if (backend === "opfs") {
    await writeOpfsDocument(document);
    await putCatalog(documentToCatalog(document));
  } else {
    await putCatalog(documentToCatalog(document), document);
  }
  return backend;
}

export async function loadDocument(documentId: string): Promise<CanvasDocument> {
  const backend = await detectBackend();
  let value: unknown;
  if (backend === "opfs") {
    value = await readOpfsDocument(documentId);
  } else {
    const database = await openDatabase();
    const transaction = database.transaction("documents", "readonly");
    value = await requestResult(transaction.objectStore("documents").get(documentId));
    database.close();
  }
  if (!isCanvasDocument(value)) throw new Error("The saved canvas is not valid.");
  const document = normalizeCanvasDocument(value);
  if (JSON.stringify(document) !== JSON.stringify(value)) await saveDocument(document);
  return document;
}

export async function listDocuments(): Promise<CatalogEntry[]> {
  const database = await openDatabase();
  const transaction = database.transaction("catalog", "readonly");
  const entries = await requestResult<CatalogEntry[]>(
    transaction.objectStore("catalog").getAll(),
  );
  database.close();
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function removeDocument(documentId: string) {
  const backend = await detectBackend();
  if (backend === "opfs") {
    try {
      await deleteOpfsDocument(documentId);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
    }
  }
  const database = await openDatabase();
  const transaction = database.transaction(["catalog", "documents"], "readwrite");
  transaction.objectStore("catalog").delete(documentId);
  transaction.objectStore("documents").delete(documentId);
  await transactionDone(transaction);
  database.close();
}

export async function storageDetails() {
  const backend = await detectBackend();
  const estimate = await navigator.storage.estimate();
  const persistent = navigator.storage.persisted
    ? await navigator.storage.persisted()
    : false;
  return {
    backend,
    persistent,
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
  };
}

export async function requestPersistentStorage() {
  if (!navigator.storage.persist) return false;
  return navigator.storage.persist();
}
