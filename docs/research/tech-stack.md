# Technology stack research

Research date: 2026-08-02

## Recommendation

Build a web-first, local-first application with a renderer-independent document
model. Use React and TypeScript for the application shell, Konva as the initial
2D scene renderer, and ordinary DOM overlays for rich text, embeds, forms, and
accessibility. Persist the working library in OPFS with an IndexedDB catalog;
portable native files remain the user-owned interchange and backup format.

Recommended starting stack:

| Layer | Recommendation | Why |
| --- | --- | --- |
| Language | TypeScript with strict settings | One typed model across the editor, file format, commands, workers, and UI |
| Application UI | React | Mature component ecosystem; well suited to inspectors, file browser, menus, dialogs, and overlays |
| Build | Vite | Static, client-only application with fast iteration; no server framework needed |
| Canvas scene | Konva, used behind our own renderer adapter | Mature MIT-licensed scene graph, hit testing, transforms, layers, caching, events, and export primitives |
| Rich objects | DOM overlay layer | Native text editing, media, iframes, controls, focus, and accessibility are substantially better in DOM |
| Rich text | Lexical, loaded only while editing | Serializable, extensible, accessible React-compatible editor with a small modular core |
| App/session state | Small explicit stores; Zustand is acceptable for UI state | Avoid forcing high-frequency scene mutations through React; keep the document model framework-neutral |
| Undo/redo | Transaction-based command history over document operations | Correct grouping, predictable save points, and future automation are easier than component-state snapshots |
| Browser persistence | OPFS for documents/assets; IndexedDB for catalog, handles, preferences, and recovery metadata | OPFS is optimized for files; IndexedDB is broadly supported and indexed |
| Search | Rebuildable in-memory index in a Web Worker, persisted as a cache | Sufficient for the initial 1,000-file target without SQLite/WASM complexity |
| Portable file | Versioned ZIP bundle: manifest, JSON document, assets, thumbnail | Atomic, inspectable, portable, and independent of the runtime database |
| Schema validation | JSON Schema plus runtime validation and explicit migrations | The file format is a public contract, not an internal TypeScript detail |
| Background work | Web Workers | Keep indexing, thumbnails, validation, migration, and packaging off the interaction thread |
| Unit tests | Vitest | Reuses the Vite transform/configuration pipeline |
| Browser tests | Playwright across Chromium, Firefox, and WebKit | File APIs, pointer input, text editing, and rendering vary by engine |
| Desktop, later | Keep a platform adapter; evaluate Tauri 2 against Electron after the web MVP | Native filesystem integration should not shape the document or editor core prematurely |

This is a recommendation to prototype, not permission to couple the native file
format directly to Konva, React, OPFS, or any other implementation library.

## Decision drivers

The stack must satisfy the product requirements rather than imitate Miro's
likely implementation:

1. **Single-user and offline-first.** No backend, identity service, sockets, or
   conflict-free replicated data type is required.
2. **Files are durable products.** Users must be able to open, save, move, back
   up, and migrate ordinary artifacts.
3. **Rich interactivity.** A canvas object may be visual, textual, media-rich,
   embedded, stateful, or interactive.
4. **Large scenes stay responsive.** Editing cannot depend on rerendering the
   full React tree for every pointer move.
5. **The file index is disposable.** It accelerates navigation but is never the
   only copy of file metadata.
6. **FOSS compatibility.** Production use must not require commercial renderer
   keys or hosted services.
7. **Accessibility.** A bitmap canvas cannot be the only representation of the
   document.
8. **Browser first, desktop ready.** Core packages must not depend directly on
   browser storage or a desktop runtime.

## Canvas/editor foundation comparison

### Option A: integrate Excalidraw

Strengths:

- fastest path to excellent selection, drawing, arrows, bindings, shortcuts,
  export, and familiar whiteboard interactions
- MIT-licensed editor and open JSON drawing format
- proven offline browser experience
- strong fit for Release 0's basic diagramming requirements

Weaknesses:

- its public component API is designed primarily to embed and configure the
  Excalidraw editor, not to make arbitrary application-defined element types the
  center of the model
- the visual language and interaction assumptions are strongly Excalidraw-shaped
- rich DOM objects, structured blocks, stateful components, and declarative
  prototype behaviors would live beside or around its native element system
- maintaining a deep fork would inherit a large, fast-moving editor codebase

Best use here:

- import/export compatibility
- interaction-quality benchmark
- possibly a short proof-of-concept to quantify how far custom embeddables can
  stretch before the integration becomes a fork

Conclusion: **do not select as the default foundation without a spike.** It is
the fastest editor proof but has the highest risk of constraining the product's
interactive object model.

### Option B: Konva plus a purpose-built editor core

Strengths:

- MIT-licensed scene graph with objects, grouping, layers, transforms, caching,
  hit detection, events, mobile input, and high-resolution export
- React bindings exist, but the library can also be driven imperatively behind
  an adapter
- enough editor primitives to avoid starting at CanvasRenderingContext2D while
  leaving the document and editor model under our control
- natural fit for canvas-rendered shapes plus positioned DOM overlays

Weaknesses:

- selection boxes, snapping, connectors, binding, routing, text measurement,
  minimap, clipboard semantics, and export fidelity remain product code
- Canvas2D will eventually need viewport culling and caching for very large files
- canvas content needs a separate semantic/accessibility representation
- Konva serialization is not an acceptable native file model by itself

Conclusion: **recommended starting hypothesis.** It offers the best balance of
editor control, delivery speed, license, and implementation risk.

Important constraint: React should render the shell and overlay UI, not act as
the high-frequency scene graph. The Konva adapter should subscribe to document
changes and mutate/cull scene nodes directly.

### Option C: Fabric.js

Strengths:

- object-based Canvas2D editor abstraction
- built-in selection, transform controls, viewport handling, serialization,
  JSON/SVG/image export, and SVG import
- mature fit for conventional graphics editors

Weaknesses:

- Fabric's own documentation distinguishes serialized visual state from custom
  controls and behavior, which remain application code
- it encourages an active object model that can easily become the application
  data model if boundaries are not enforced
- custom application properties and subclasses require careful serialization
- less natural than a hybrid scene/DOM architecture for embedded live content

Conclusion: **credible fallback, but second choice.** It is attractive if the
product becomes primarily a graphics editor; less so for a spatial interactive
document runtime.

### Option D: PixiJS

Strengths:

- WebGL/WebGPU renderer with excellent headroom for huge animated scenes
- mature scene graph, asset loading, filters, input, masks, and render layers
- opt-in DOM accessibility overlay exists
- MIT licensed

Weaknesses:

- a rendering engine rather than an editor toolkit
- selection, handles, snapping, geometry, paths, text editing, SVG-quality
  export, and most diagram behaviors would be ours
- GPU renderer complexity is premature before profiling proves Canvas2D is the
  bottleneck

Conclusion: **reserve as an escalation path.** A renderer adapter lets us add a
Pixi implementation later for performance-sensitive views without making it the
MVP cost floor.

### Option E: SVG/DOM only

Strengths:

- native vector semantics and straightforward DOM accessibility
- CSS, events, text, links, focus, and inspector tooling work naturally
- excellent export fidelity for supported SVG content

Weaknesses:

- thousands of individually interactive DOM nodes create layout, style, memory,
  and reconciliation pressure
- complex freehand drawing, filters, and continuous transforms can become costly
- embeds and editor chrome can create difficult stacking and pointer-event rules

Conclusion: **use selectively, not for the full scene.** DOM is the correct
surface for rich objects and accessibility; it should not be the only renderer
for large drawing scenes.

## Rendering architecture recommendation

Use three synchronized visual planes:

1. **Konva scene plane** — shapes, connectors, freehand paths, images, frames,
   selection bounds, guides, and minimap rendering.
2. **DOM content plane** — active rich-text editor, media controls, sandboxed
   embeds, tables/forms, and interactive components. Elements are positioned by
   the same world-to-screen transform as the scene.
3. **DOM application plane** — toolbars, panels, dialogs, menus, file tabs,
   search, and accessible outline.

The document model owns geometry and content. Renderers receive derived view
models and emit semantic intents such as `MoveSelection`, `ResizeObject`, or
`CommitTextEdit`. They never write renderer-native objects into the document.

Why hybrid rather than canvas-only:

- `contentEditable`, media controls, iframe sandboxing, and form controls already
  exist in the browser
- selected DOM objects can be accessible without simulating every interaction
  inside a bitmap
- inactive rich objects may render as cached canvas snapshots for performance;
  the live DOM version mounts only when visible, focused, playing, or editing

## Application framework comparison

### React plus Vite — recommended

- React fits the component-heavy shell and has first-class bindings for Konva
  and Lexical
- Vite builds a static client application and shares its transform pipeline with
  Vitest
- there is no server-rendering, routing, or backend requirement that justifies
  Next.js
- a static build can ship as a PWA, be hosted anywhere, or be wrapped later

Risk: React state must not become the document engine. Pointer-move updates and
scene mutations should bypass component rerender loops.

### Next.js or another full-stack framework — not recommended

- server rendering offers little value for an authenticated-free local editor
- server conventions would add deployment and mental-model overhead
- browser-only canvas code still requires client boundaries

Choose a full-stack framework later only if a separate public template gallery
or hosted service is created. That service should remain separate from the core
editor application.

### Svelte/Vue — viable, not advantaged enough

Both can build the shell well. React is recommended because the most relevant
editor integrations and team familiarity are more likely to reduce risk. The
framework-neutral model and renderer boundary limit lock-in.

## Rich text comparison

### Lexical — recommended

- modular, extensible, JSON-serializable editor state
- explicit focus on performance, reliability, and accessibility
- React integration and command model align with the proposed shell
- can be lazy-loaded only when text enters edit mode

Do not use Lexical's runtime-generated node keys as document object IDs. Store a
versioned rich-text payload inside the containing document object and define an
HTML/plain-text export path.

### ProseMirror/Tiptap — strong alternative

- proven schema-driven document model and rich plugin ecosystem
- better choice if rich, deeply structured documents become the main product

Tradeoff: more schema/plugin machinery than needed for sticky notes, labels, and
moderately rich blocks. Tiptap also mixes open core with paid extensions, so the
dependency boundary requires deliberate review.

### Native contentEditable — insufficient alone

It minimizes dependencies but shifts selection, history, IME, clipboard,
formatting, and cross-browser correctness onto this project. Use a maintained
editor framework.

## Persistence and search comparison

### Browser persistence layers

| Option | Advantages | Problems | Decision |
| --- | --- | --- | --- |
| IndexedDB only | Widely available, transactional, stores structured values and blobs, supports indexes and workers | Awkward for large file-like byte ranges and user-visible filesystem semantics | Use for catalog, preferences, handles, recovery records, and small caches |
| OPFS only | Widely available, optimized in-place file access, synchronous worker APIs | Invisible to users, origin-scoped, erased when site data is cleared, weak querying | Use for working document bundles, assets, thumbnails, and journals—not as the user's only backup |
| User-visible File System Access API | Opens and writes real user files with handles | Picker APIs remain unavailable in some major browsers and require secure contexts/user activation | Progressive enhancement; never the sole save path |
| SQLite WASM on OPFS | SQL transactions, FTS, rich querying, mature format | WASM/worker/VFS complexity, browser concurrency caveats, index can become a second source of truth | Defer until catalog/search profiling justifies it |

Recommended browser model:

- OPFS contains the app-managed working library and recovery journal
- IndexedDB contains the lightweight catalog, user preferences, granted handles,
  and rebuildable search cache
- the user can export/import native bundles everywhere
- supported browsers may bind a library to a user-selected directory
- the UI must explain that clearing site data removes the app-managed library
  and should encourage user-visible backups
- request persistent browser storage where supported, but never describe it as a
  guarantee

### Search

For the initial 1,000-file target, extract searchable text and metadata in a Web
Worker and build a compact in-memory inverted index. Persist it only as a cache.
Each record contains the native file ID, content hash/schema version, title,
tags, timestamps, frame names, object text, and broken-link status.

Reindex when the file's content hash changes. A complete rebuild must always be
possible by scanning file manifests and documents.

Adopt SQLite FTS only when measurements show one of these needs:

- tens of thousands of files
- complex fielded queries and ranking
- incremental indexing too expensive for the worker/index library
- desktop workspace metadata needs transactional joins

Even then, SQLite remains a projection; the native files remain authoritative.

## Native file format

Recommended conceptual bundle, using a provisional extension until naming:

```text
example.canvas-bundle
├── manifest.json
├── document.json
├── preview.webp
└── assets/
    ├── <content-hash>.png
    ├── <content-hash>.pdf
    └── <content-hash>.bin
```

`manifest.json` contains lightweight information the file browser can read
without parsing the whole scene: format/version, stable file ID, title, tags,
created/updated timestamps, start frame, object/frame counts, preview metadata,
and asset inventory.

`document.json` contains framework-neutral objects, geometry, style, hierarchy,
links, component definitions/instances, states, triggers, actions, and metadata.

Architectural rules:

- IDs are stable UUIDs and never renderer-generated identifiers
- coordinates use document-space units, independent of CSS pixels and device
  pixel ratio
- unknown object/action data is preserved on read/write
- every schema version has deterministic, tested migrations
- native save writes a new bundle and replaces the old file only after
  validation succeeds
- desktop save uses write-temp, flush, and atomic rename where the platform
  permits
- snapshots use content-addressed assets to avoid duplicating unchanged media
- JSON Canvas can be an interchange format, not the native schema; its node/edge
  model is intentionally smaller than this product's interactive model

## Desktop packaging comparison

### Stay web/PWA first — recommended now

This validates the editor and file contract with the smallest platform surface.
It keeps hosting optional and makes the core usable immediately. Browser file
picker limitations mean exported native bundles are the universal portability
path during this phase.

### Tauri 2 — preferred desktop candidate

Advantages:

- uses the operating system's webview instead of bundling Chromium
- small application bundles
- fine-grained capability system for filesystem and platform APIs
- Rust backend can implement atomic filesystem operations and native indexing

Costs:

- rendering and web API behavior varies across WKWebView, WebView2, and
  WebKitGTK
- Rust and platform prerequisites increase contributor complexity
- rich embeds need careful capability and navigation isolation

### Electron — consistency candidate

Advantages:

- consistent bundled Chromium behavior across platforms
- Node ecosystem and filesystem APIs simplify desktop integration
- mature windowing, updates, and debugging model

Costs:

- ships Chromium and Node, increasing application size and update burden
- privileged desktop APIs amplify XSS and embed risks
- requires strict main/renderer separation, sandboxing, context isolation, IPC
  validation, CSP, and remote-content controls

Decision: preserve a narrow `PlatformAdapter` and delay selection. Choose Tauri
if small size and least-privilege filesystem access win the cross-webview spike;
choose Electron if rendering/embed consistency materially reduces defects.

## Recommended supporting libraries

These are candidates, not permanent file-format dependencies:

- `konva` for the initial scene renderer
- `lexical` and `@lexical/react` for rich-text edit mode
- `zustand` for small UI/session stores, not document persistence
- `immer` only if patch generation proves useful for transaction history
- `zod` or an equivalent runtime validator at internal boundaries; publish JSON
  Schema for the file contract
- `fflate` for portable ZIP bundles after validating streaming/memory behavior
- `minisearch` or `flexsearch` behind a search adapter
- `pdfjs-dist` for PDF viewing, with isolation from the document model
- `vite`, `vitest`, and `@playwright/test`

Pin exact versions only when implementation begins. Record licenses and generate
an SBOM in CI; do not infer long-term FOSS compatibility from package popularity.

## What we deliberately do not need

- backend application server
- database server
- authentication or authorization system
- WebSockets
- CRDT or operational-transform library
- presence service
- cloud object storage
- message queue
- Kubernetes or Docker for normal use
- server-side rendering
- analytics pipeline

A static hosting option may serve the PWA. It stores no user files.

## Validation spikes before stack lock

### Spike 1: editor foundation

Implement the same small file in Excalidraw and the Konva/DOM hybrid:

- 500 shapes, 250 connectors, 100 sticky notes, 20 images
- pan/zoom, selection, resize, snap, bind, text edit, undo, save/reopen
- one live DOM embed and one interactive component
- PNG and SVG export

Measure interaction quality, implementation complexity, serialized-model
control, bundle size, memory, and frame time. The hybrid wins only if its core
editing feel can reach the required quality without excessive bespoke code.

### Spike 2: persistence matrix

Test Chromium, Firefox, and WebKit for:

- OPFS save/reopen, quota reporting, and storage persistence request
- export/import native bundle
- user-visible open/save where supported
- crash during write and recovery from journal
- 1,000-file scan and reindex

### Spike 3: hybrid overlays

Validate DOM-to-world transform accuracy under pan, zoom, rotation, high-DPI,
fullscreen presentation, and browser zoom. Test focus, tab order, pointer event
handoff, IME composition, copy/paste, and screen-reader outline behavior.

### Spike 4: large-scene budgets

Set and test provisional budgets:

- 60 fps pan/zoom at 5,000 simple visible objects on reference hardware
- no long task over 50 ms during steady-state pointer interaction
- open a representative 10,000-object file in under 2 seconds warm
- autosave without visible interaction stalls
- rebuild a 1,000-file search index without blocking the UI

If Konva misses budgets after culling, caching, and worker offload, implement a
small Pixi renderer proof before changing the domain model.

## Sources

- [Excalidraw developer documentation](https://docs.excalidraw.com/)
- [Konva overview and architecture](https://konvajs.org/docs/overview.html)
- [Konva project and license overview](https://konvajs.org/docs/about.html)
- [Fabric.js core concepts and serialization](https://fabricjs.com/docs/core-concepts/)
- [PixiJS engine overview](https://pixijs.io/docs/)
- [PixiJS accessibility overlay](https://pixijs.com/8.x/guides/components/accessibility)
- [Lexical architecture and serialization](https://lexical.dev/docs/intro)
- [React documentation](https://react.dev/learn/describing-the-ui)
- [Vite rationale](https://vite.dev/guide/why.html)
- [MDN: Origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN: user-visible file picker limitations](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker)
- [SQLite WASM persistence options](https://sqlite.org/wasm/doc/tip/persistence.md)
- [Tauri architecture](https://v2.tauri.app/concept/architecture/)
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright browser coverage](https://playwright.dev/docs/browsers)
- [JSON Canvas](https://jsoncanvas.org/)
