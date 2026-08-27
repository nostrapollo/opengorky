# Interactive canvas feature landscape

Research date: 2026-07-30
Revised: 2026-08-26

## Executive summary

This project is a single-user, file-based spatial workspace—not a collaboration
platform.

The product should combine three layers:

1. **Canvas editor** — an infinite surface with excellent drawing, diagramming,
   layout, media, frames, and structured content.
2. **Rich content layer** — objects can contain structured data, documents,
   media, and offline-safe embeds.
3. **File workspace** — users can create, save, organize, search, preview,
   navigate, import, export, back up, and move their work.

Real-time co-editing, presence, sharing roles, group workshop mechanics, and
server-side identity are explicitly outside the product requirements.

The product thesis is:

> A polished, local-first infinite canvas for building and navigating rich
> visual files, with open data and no required account or server.

## 1. Canvas fundamentals

Miro demonstrates the breadth users expect from a mature infinite canvas. Frames
organize content and can double as navigation targets, presentation slides, and
export pages.

Essential canvas behavior:

- smooth pan and zoom across a practically unbounded surface
- pointer/select, marquee selection, multi-select, move, resize, and rotate
- copy/paste, duplicate, delete, undo/redo
- keyboard shortcuts, command palette, and contextual actions
- snap, align, distribute, smart guides, and auto-layout
- grouping, locking, layering, and z-order
- minimap, zoom-to-fit, zoom-to-selection, and object search
- light/dark themes
- mouse, trackpad, touch, and stylus input
- strong performance with large files

Core object types:

- text and rich text
- sticky notes, including bulk entry, colors, tags, and emoji
- basic shapes and reusable shape libraries
- lines, arrows, labeled connectors, and connector-to-shape binding
- freehand pen, highlighter, and eraser
- images, video, audio, files, links, and web embeds
- frames
- cards
- tables and Kanban-style collections
- mind maps

Miro also supports structured Docs, Tables, Timelines, Diagrams, Slides, and
Prototypes on its canvas. They are useful reference points for expansion, but
the first release needs a coherent object model rather than every format.

## 2. Rich content

Rich content should distinguish the product from a basic diagram editor without
turning documents into executable prototypes or lightweight apps.

### Live and embedded content

- web links with previews
- sandboxed webpage embeds
- video and audio playback
- PDF and document previews
- code blocks with syntax highlighting
- optional live data blocks with explicit refresh
- graceful offline placeholders for network-backed content

Embedded content must never make the file unreadable offline. The native file
should retain metadata, a fallback representation, and the source URL.

### Structured content

- tables with sorting and filtering
- Kanban boards with draggable cards
- mind maps with collapse/expand
- checklists and progress indicators
- lightweight charts backed by embedded data
- computed fields or formulas as a later capability

## 3. Saving and file ownership

Saving is core product behavior rather than infrastructure hidden behind an
account.

### Native file contract

- documented, versioned JSON-based format
- stable object identifiers
- schema version and deterministic migrations
- forward-compatible handling of unknown object types
- embedded or adjacent assets with portable references
- human-inspectable metadata
- atomic saves to avoid partial-file corruption
- recovery journal for interrupted writes
- explicit “save,” “save as,” duplicate, and autosave behavior

The preferred artifact should eventually be a bundle or archive containing a
manifest, document data, and assets. Plain JSON remains useful for small files
and interchange.

### Persistence modes

- local browser storage for instant, no-install use
- opening and saving native files through the browser's file APIs where
  supported
- ordinary filesystem files in a future desktop shell
- optional user-selected workspace directory
- no mandatory cloud account
- no server required for core functionality

### Import and export

- native file import/export
- PNG and SVG export for a selection, frame, or whole canvas
- PDF export with one frame per page
- clipboard interoperability for text, images, SVG, and URLs
- CSV import/export for supported structured objects
- basic Excalidraw import/export where fidelity permits
- clear warnings for unsupported or lossy conversions

Open, movable files are part of the product promise. A FOSS application that
cannot be migrated safely still creates lock-in.

## 4. File workspace and navigation

The home screen should feel closer to a capable file browser than a SaaS team
dashboard.

Required workspace behavior:

- create, open, rename, duplicate, move, archive, and delete files
- folders and nested folders
- recent files
- favorites/pins
- list and grid views
- thumbnails and live previews
- sort by name, updated time, created time, and size
- full-text search across titles and supported object content
- filters for file type, tags, and date
- user-defined tags
- breadcrumbs and fast keyboard navigation
- open files in tabs or separate windows
- restore from trash
- reveal the underlying local file where the platform permits
- missing-file and moved-file recovery

### Inside-file navigation

- searchable frame/layer/object outline
- minimap
- next/previous frame
- bookmarks
- recently visited locations
- back/forward history
- links between saved files with moved-target resolution
- start view

The file index should be reconstructible from the files themselves. Losing an
application database must not mean losing the library.

## 5. Templates and reusable content

Miro's template system shows the value of starting from proven structures.
Requirements for this product:

- start from blank or a template
- save a file, frame, or selection as a reusable template
- searchable local template library
- metadata, preview, categories, tags, and author
- reusable object/component library
- import/export template packages

An initial curated library of 10–20 excellent templates is preferable to a large
low-quality catalog.

## 6. History, safety, and recovery

- per-file undo/redo
- autosave with a visible save state
- automatic recovery after a crash
- local snapshot history
- restore a snapshot as a copy
- configurable snapshot retention
- detect external file changes and avoid silent overwrites
- backup and restore an entire workspace index
- validate files before replacing a known-good copy

Version control friendliness is desirable: normalized ordering and deterministic
serialization should keep diffs meaningful where practical.

## 7. Extensibility

Long-term platform capabilities:

- documented file and object schema
- import/export extension points
- custom object types
- custom tools and inspector panels
- scoped plugin permissions
- local plugin loading for self-contained installations
- automation or agent API that operates on ordinary files

The native schema should preserve unknown object and extension data from the
beginning, even if a public plugin system arrives later.

## 8. Accessibility and quality

- complete keyboard path for core editing and file navigation
- visible focus and high-contrast modes
- reduced-motion support
- semantic controls outside the canvas
- accessible object names and descriptions
- logical reading order for frames and documents
- zoom independent of browser text scaling
- localization and broad font/script support
- recovery from malformed embeds or extension content

## Existing products to study

| Product | What it proves | Lesson for this project |
| --- | --- | --- |
| **Excalidraw** | Excellent drawing feel, infinite canvas, open JSON, images, shape libraries, offline PWA, and PNG/SVG export | Strong editor reference or foundation candidate, but the surrounding file workspace and richer document objects would be our product |
| **AFFiNE** | Local-first documents, databases, and an edgeless canvas can coexist in one workspace | Useful reference for file navigation and structured blocks, while our scope can remain canvas-first |
| **tldraw** | A polished extensible canvas can support custom shapes, tools, embeds, touch, and application-like canvas experiences | The SDK's current production license is not FOSS-compatible for this project's foundation |
| **Penpot** | A self-hostable visual editor can support reusable components and rigorous layout systems | Useful reference for components, constraints, and reusable visual systems |
| **Obsidian Canvas** | Ordinary local files can underpin a durable spatial knowledge base | File ownership and a reconstructible index are major product advantages |

## Product principles

1. **The canvas must feel instant.** Latency and interaction quality are
   features.
2. **Files are the source of truth.** The library can be rebuilt from portable
   artifacts.
3. **No account is required.** The core app works locally.
4. **Offline is normal.** Network-backed objects degrade gracefully.
5. **Navigation is first-class.** Moving between files and locations must be as
   polished as editing them.
7. **The core stays open.** Avoid dependencies whose production terms conflict
   with the project's FOSS promise.
8. **Accessibility is an acceptance criterion.** It is designed in from the
   start.

## Sources

Primary product references:

- [Miro formats and focus modes](https://help.miro.com/hc/en-us/articles/26711034117138-Formats-Focus-modes)
- [Miro frames](https://help.miro.com/hc/en-us/articles/360018261813-Frames)
- [Miro shapes](https://help.miro.com/hc/en-us/articles/360017730713-Shapes)
- [Miro board structure](https://help.miro.com/hc/en-us/articles/360017730973-Structuring-board-content)
- [Miro export](https://help.miro.com/hc/en-us/articles/360017572754-How-to-export-your-board)
- [Miro board backups](https://help.miro.com/hc/en-us/articles/360017572774-How-to-save-board-backup)
- [Miro version history](https://help.miro.com/hc/en-us/articles/360021668819-Board-history-versions)
- [Miro templates](https://help.miro.com/hc/en-us/articles/360017572134-Templates)

Open-source and source-available references:

- [Excalidraw](https://github.com/excalidraw/excalidraw)
- [AFFiNE](https://github.com/toeverything/AFFiNE)
- [tldraw](https://github.com/tldraw/tldraw)
- [Penpot](https://github.com/penpot/penpot)
- [Obsidian Canvas file format](https://jsoncanvas.org/)
