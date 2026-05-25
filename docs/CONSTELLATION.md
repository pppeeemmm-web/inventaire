# Constellation Canvas

**Canonical URL:** `/atelier/constellation` (cloud map deep link: `/atelier/constellation?map=<uuid>`; bare `/atelier?map=` redirects to the segment route).

This document defines the product intent and technical contract for the Atelier constellation surface before further feature work.

## Purpose

`ConstellationCanvas` is a visual curation workspace for arranging works as a graph:

- Nodes are works (`Oeuvres`) rendered as circular thumbnails.
- Edges are semantic relationships (`tblrelations`) between two works.
- Layout can be grouped by year, theme, working group, free layout, or custom set.
- Curators can save/load map snapshots locally and in cloud storage.

Primary value: fast visual sense-making for selection, storytelling, and exhibition prep when list/table views are too linear.

## Core User Story

As a curator, I can:

1. Filter works by editorial context (theme/group/custom subset).
2. Arrange them spatially (manual drag + auto layouts).
3. Link related works with typed edges.
4. Annotate with simple overlays (draw/line/text).
5. Save and reopen map states for later discussion or execution.

## Data Model

### Inputs (read path)

- `Oeuvres` rows passed from the Atelier loader.
- `theme` and `working_group` metadata to scope clusters.
- `oeuvre_theme` and `working_group_work` junctions for membership (also loaded server-side with relations for the canvas graph).
- Relationship rows (`tblrelations`) for edge graph (loaded via `fetchConstellationGraphBundle`).

### Persisted states

- Local browser storage:
  - Node positions keyed by grouping mode (`pem_const_pos_*`).
  - Local snapshots (`pem_const_snapshots`) with positions + shapes.
- Cloud map storage via server actions:
  - `listConstellationMaps`
  - `saveConstellationMap`
  - `loadConstellationMap`
  - `deleteConstellationMap`

Cloud payload schema is versioned by `CONSTELLATION_MAP_VERSION` and represented by `ConstellationMapDocument`.

### Write side-effects

- Edge edits mutate relationship records **via server actions** `insertConstellationRelation` and `deleteConstellationRelation` in [`app/atelier/constellation/actions.ts`](../atelier/constellation/actions.ts) (team-gated; no browser `createClient()` on `tblrelations`).
- Optional membership edits can remove works from theme/group via server actions.
- Saving cloud maps writes only map state, not domain metadata.

### Graph bootstrap (read path, server)

- `fetchConstellationGraphBundle` loads `tblrelations`, `oeuvre_theme`, and `working_group_work` in one server round-trip (same row caps as the legacy client selects). Used by `ConstellationCanvas` on load and after membership removals.

## UX Contract

- Desktop-first dense editor, but must not break narrow/mobile rendering.
- No horizontal page overflow at 375px viewport.
- Canvas interactions must preserve selection and not silently drop nodes.
- Frozen cloud map mode is read-only relative to live graph until explicitly exited.

## Non-goals (current phase)

- Not a replacement for inventory/production/pipeline list workflows.
- Not a publishing surface for public `/works`.
- Not a source of truth for artwork metadata (title, price, ownership, etc.).
- Not a version-control system for arbitrary binary assets.

## Module layout (2026-05-25)

Public entry unchanged: `components/atelier/ConstellationCanvas.tsx` (re-exports `Pt`, `NodeMap`; hosts pointer handlers, cloud/snapshot orchestration, layout state).

Extracted under `components/atelier/constellation/`:

| Module | Responsibility |
|--------|----------------|
| `constellation-shared.ts` | Types, layout constants, geometry, theme/group helpers, snapshot keys |
| `ConstellationToolbar.tsx` | View mode, link type, local/cloud maps, export, floorplan opacity |
| `ConstellationToolRail.tsx` | Draw tools, stroke color/width, shortcuts toggle |
| `ConstellationSidePanel.tsx` | Node inspector, custom work picker, selection + save, snapshot/cloud lists |
| `constellation-draw-frame.ts` | `drawConstellationFrame()` — main canvas paint pass |
| `useConstellationCanvasRedraw.ts` | Hook: tick loop, visible image loading, `redraw()` |
| `constellation-export.ts` | PNG + tiled A4 export |
| `ConstellationShortcutsPanel.tsx` | Floating keyboard-shortcuts overlay |

Still in the canvas orchestrator (~1.5k LOC): pointer/wheel/drag handlers, cloud/snapshot orchestration, layout state.

## Known Constraints

- Canvas orchestrator (~1.5k LOC) until pointer handlers and cloud/snapshot state move out.
- Manual QA coverage is stronger than automated coverage for graph-specific interactions.
- Performance depends on thumbnail decode/cache behavior and current node count.

## Refactor Direction Guardrails

- Keep behavior parity while splitting remaining canvas modules (render loop, export, input).
- Preserve persisted key compatibility or include deterministic migration.
- Isolate server mutations in `app/**/actions.ts` (no new client-side domain writes).
- Add focused tests for save/load/frozen-mode and edge edit flows as slices land.

## Repository copy

Maintain this document only at **`docs/CONSTELLATION.md`** in the app repository root. Nested git worktrees should link here instead of keeping a second file.
