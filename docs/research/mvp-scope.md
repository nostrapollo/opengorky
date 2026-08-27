# Proposed MVP scope

This scope reflects a single-user, file-based visual canvas. Multiplayer
and collaboration infrastructure are not product requirements.

## Target user and job

**Primary user:** an individual who thinks spatially and wants one open tool for
diagrams, visual notes, reference boards, and structured documents.

**Core job:** “Let me create a rich visual canvas, save it as a real file,
find it again quickly, and navigate naturally between my files and ideas.”

## Release 0: editor proof

Goal: prove that the canvas interaction is good enough to build on.

- infinite pan/zoom canvas
- select, multi-select, move, resize, and rotate
- text, sticky note, basic shapes, connectors, freehand drawing, and images
- connector binding
- styling for fill, stroke, text, opacity, and layer order
- group, lock, align, distribute, and snap
- copy/paste, duplicate, undo/redo
- frames, layers/outline, and minimap
- autosave locally
- versioned native file import/export
- PNG and SVG export
- keyboard shortcuts and baseline accessibility

Exit criterion: a user can create a clean flowchart or visual note, close the
application, reopen the native file, and export it without data loss.

## Release 1: durable file workspace

Goal: make saved work feel dependable and easy to navigate.

- create, open, save, save as, rename, duplicate, move, and delete files
- folder hierarchy
- recent files and favorites
- grid/list views with thumbnails
- sort, tags, and full-text search
- trash and restore
- open files in tabs
- autosave status and crash recovery
- local snapshot history
- detect external changes before overwriting
- workspace index that can be rebuilt from native files
- native file bundles with portable assets
- PDF export with one frame per page
- Docker-free local web use; no account or server required

Exit criterion: a user can manage at least 1,000 saved canvases, find a file by
title, tag, or contained text, recover a deleted file, and move the library
without losing files, assets, or metadata.

## Release 2: rich documents

Goal: support useful mixed-media documents without introducing a behavior
runtime.

- sandboxed web embeds
- video, audio, PDF, and code blocks
- reusable visual components
- rich text and document blocks
- attached local files with portable bundle assets
- graceful offline placeholders and cached metadata for embedded content

Exit criterion: a user can build a self-contained mixed-media reference board
that remains understandable offline.

## Release 3: structured canvas

- tables with sorting and filtering
- Kanban boards and cards
- collapsible mind maps
- checklists and progress indicators
- charts backed by local embedded data
- component and shape libraries
- save a file, frame, or selection as a template
- curated template library
- CSV import/export for structured objects
- basic Excalidraw interchange

## Later expansion

- desktop packaging and native filesystem integration
- mobile/tablet app
- plugin SDK for tools, objects, and importers
- formulas and local computed fields
- optional user-configured cloud folder providers
- git-friendly diff and merge tooling
- automation and agent APIs over local files
- additional diagram and presentation formats

## Explicit non-goals

- multiplayer editing
- live cursors or presence
- accounts, teams, guests, and sharing roles
- threaded comments, mentions, or notifications
- voting, private group ideation, reactions, or breakout sessions
- video calling or screen recording
- enterprise identity and compliance administration
- hosted-service dependency for core functionality
- pixel-for-pixel Miro UI cloning
- AI-generated content in the initial product
- arbitrary user JavaScript in documents
- object-triggered actions, prototype flows, and cross-file object links
- compatibility with Miro's proprietary board backup format

## Decisions to make before implementation

1. **Product identity:** the application is named `opengorky`; define its
   visual identity and trademark approach before a public launch.
2. **License:** evaluate AGPL-3.0 versus Apache-2.0/MIT based on the desired
   ecosystem and contribution model.
3. **Editor foundation:** validate the recommended hybrid Konva and DOM renderer
   with a focused vertical slice; compare its interaction quality and delivery
   cost with an Excalidraw integration before locking the choice.
4. **Native file:** define bundle layout, asset handling, stable IDs, migrations,
   unknown object preservation, and atomic saves.
5. **Workspace model:** decide how browser storage, user-selected directories,
   and future desktop filesystem access present one coherent library.
6. **Indexing:** make search fast while keeping the index disposable and
   reconstructible from the files.
7. **Security:** define sandboxing, network permissions, and offline fallbacks
   for embeds and future extensions.
