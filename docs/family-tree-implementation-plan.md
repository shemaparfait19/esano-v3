Family Tree - Implementation Plan

Goals

- Deliver a performant, intuitive family tree with rich editing and AI assistance.
- Phase rollout: Phase 1 (MVP visualization + editing), Phase 2 (AI, media, collaboration), Phase 3 (analytics, advanced exports).

Architecture & Tech Choices

- Renderer: Canvas/WebGL-first for 500–1000+ nodes at 60fps. Start with D3.js force/layout utilities + custom canvas layer; revisit react-flow if productivity wins outweigh perf.
- State: Client-side Zustand for transient UI; Firestore for persistence (trees, members, edges, annotations). Admin paths for heavy ops (exports, analytics).
- Layout: Strategy pattern for view modes (classic, radial/fan, timeline). Shared graph model + pluggable layout engines.
- AI: Existing assistant endpoint augmented with tree context; background suggestion jobs on changes.
- Realtime: Firestore listeners for collaboration MVP; upgrade to WebSockets/CRDT for Phase 2 multi-user editing.

Data Model (Firestore)

- Collection `familyTrees/{ownerUserId}`
  - members: [{ id, fullName, firstName, lastName, birthDate, deathDate, gender, tags: [], avatarUrl, notes, location, customFields: {} }]
  - edges: [{ id, fromId, toId, type: 'parent'|'spouse'|'adoptive'|'step', metadata: { strength?: number,
    createdAt, updatedAt }}]
  - settings: { colorScheme, viewMode, layout: 'horizontal'|'vertical'|'radial'|'timeline', branchColors: {}, nodeStyles: {} }
  - annotations: [{ id, type: 'sticky'|'draw'|'doc', position, content, createdBy, createdAt }]
  - version: { current, history: [{ id, ts, summary, snapshotRef }] }
- Collection `media/{ownerUserId}/items/{mediaId}`
  - { memberId?, branchIds?:[], type: 'photo'|'audio'|'video'|'doc', url, thumbUrl, meta: { faceTags?:[], transcript? }, createdAt }

Security & Privacy

- Read/write rules: owner + invited collaborators per-role; enforce per-branch permissions when present.
- PII protection: redact in AI contexts unless user opts-in; privacy flags per member/media.

Implementation Phases & Milestones

Phase 1 - MVP (Weeks 1–6)

1. Core Visualization (CRITICAL)
   - Canvas renderer with pan/zoom (wheel/trackpad/touch). 60fps target, capping draw ops.
   - Classic tree view: horizontal layout (parents above, children below); auto-rebalance on insert/delete.
   - Node primitives: avatar, name, basic dates, compact tags.
   - Smooth transitions for pan/zoom and incremental layout updates.
2. Editing Tools (CRITICAL)
   - Manual node add/edit/remove; inline editing (name, birth/death, role);
   - Simple parent-child linking with visual handles; sibling grouping.
   - Drag node reposition within layout constraints; auto-edge rewiring.
3. Persistence
   - Load/save to `familyTrees/{ownerUserId}`; optimistic UI; undo/redo (client history) for session.
4. Export (basic)
   - PNG export from current viewport (done). PDF pending.
5. Accessibility & Perf guards
   - Keyboard pan/zoom shortcuts; focus styles; initial tree load <2s for 200 nodes.

Phase 2 - Enhanced (Weeks 7–12)

1. Multiple View Modes
   - Strategy selector: Classic (default), Radial/Fan (ancestors), Timeline (life events). Separate layout engines.
2. Advanced Editing
   - Toolbar with draggable templates; react-dnd; fullscreen mode with side panel tools.
   - Node profile modal: photo upload (added basic media upload), notes, audio recording; custom tags/icons; quick shortcuts.
   - Styling: branch color-coding; highlight lineage paths; custom node shapes/sizes.
3. AI Assistance (HIGH)
   - Smart Suggestions: backend API added (/api/family-tree/suggest) with suggestions + conflicts; UI pending.
   - Auto-Completion: placeholder parents/children; surname/location fill. (pending)
   - Conflict Resolution: date/age validation with rule engine (added basic checks); AI fallback. (partial)
4. Collaboration (HIGH)
   - Basic realtime presence/cursors: rendering wired; presence feed scaffolded. (partial)
   - Multi-user editing & conflict semantics. (pending)
5. Media & Memories (MEDIUM)
   - Attach media to nodes (added basic upload); gallery (basic preview); optional face recognition tagging pipeline (pending).
     Status Summary (current)

- Phase 1 MVP largely complete: canvas pan/zoom, persistent positions, editing, undo/redo, PNG export, keyboard accessibility, deterministic layout anchor, orphans visible.
- New features added: Head of Family flag (with crown), extended relationships, AI kinship enrichment, suggestions/conflict API, presence cursors (partial), media upload (basic).
- Pending to close Phase 1 fully: PDF export, perf validation.
- Phase 2 work in progress: suggestions UI, collaboration presence refinement, media gallery, view modes.

Phase 3 - Advanced (Weeks 13–16)

1. Analytics (LOW)
   - Generational depth, missing branches, surname frequency; geographic migration map; DNA overlay from existing analysis.
2. Export & Sharing (MEDIUM)
   - High-res PNG/SVG, JSON, GEDCOM export; print-friendly layouts; public/private sharing + invite links.
3. Mobile polish
   - Touch-first gestures; high-contrast mode; performance tuning for large trees (1000+ nodes).

Detailed Task Breakdown (initial backlog)

Core Visualization

- Build `TreeCanvas` component (canvas base, DPR scaling, render loop, pan/zoom controller).
- Graph model: `GraphStore` with members/edges selectors; memoized layout cache; diff-based rendering.
- Layout engines: `ClassicLayout` (layered DAG), `RadialLayout` (fan ancestry), `TimelineLayout` (time axis).
- Edge styles: solid (parent), dashed (step/adoptive), curved couples.

Editing Tools

- Inline editor: popover inputs; validation; keyboard shortcuts; commit/cancel.
- Drag handles for linking; reconnect edges; sibling grouping; auto cleanup of orphans.
- Toolbar & fullscreen mode; side panel for properties.

AI Assistance

- Relationship parser: rules mapping text → edge types; age/name heuristics.
- Suggestion engine: consumes current graph; emits actions with confidence; UI for accept/ignore.
- Conflict checks: date ranges, age gaps, duplicates; AI justifications.

Media & Memories

- Media uploader (S3/Cloud Storage); attach to member/branch; lazy thumbs; lightbox viewer.
- Optional face recognition job; manual override tagging.

Collaboration

- Presence service (user cursors), change feeds; batched updates; minimal OT/CRDT v1.
- Permissions model: Admin/Editor/Viewer; branch-scoped ACLs.

Analytics & Export

- Aggregations: compute stats client/server; cache heavy results.
- Exporters: PNG/PDF/SVG/JSON/GEDCOM modules; print layout with pagination.

Performance Targets & Tactics

- 1000+ nodes, 60fps: batch draw, culling/LOD, offscreen canvas for layers, requestIdleCallback for heavy recompute.
- <2s initial load: lightweight skeleton, progressive hydration, background layout when needed.
- <100ms realtime updates: debounce layout; incremental edge reroute.

Accessibility & UX

- Keyboard navigation (arrow keys to traverse relatives); screen reader labels per node; high-contrast theme toggle.
- Touch-friendly gestures; inertia; double-tap to zoom; long-press for context menu.

Risks & Mitigations

- Layout performance: start with canvas + incremental layout; defer WebGL until needed.
- Complexity creep: phase gates; strict scope per milestone; feature flags.
- AI accuracy: confidence thresholds; human-in-the-loop review; reversible edits.

Success Criteria (Phase 1)

- Pan/zoom tree with 500 nodes @ ≥50–60fps.
- Add/edit/link/remove nodes smoothly; auto-rebalance; export PNG/PDF.
- Usability: <2s load; <4 clicks to add & connect a new member; zero jank.

Next Steps (actionable)

1. Scaffold `TreeCanvas` and `GraphStore` with mock data; render 200-node synthetic tree.
2. Implement pan/zoom + classic layout; parent/child links + siblings.
3. Inline editing + persistence to `familyTrees/{ownerUserId}`; undo/redo (session scope).
4. Export PNG/PDF; perf audit and tune.
