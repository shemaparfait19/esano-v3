import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  FamilyMember,
  FamilyEdge,
  FamilyTree,
  NodePosition,
  EdgePath,
  LayoutResult,
  CanvasState,
  RenderOptions,
} from "@/types/family-tree";

interface FamilyTreeState {
  // Data
  tree: FamilyTree | null;
  members: FamilyMember[];
  edges: FamilyEdge[];

  // Layout
  layout: LayoutResult | null;
  canvasState: CanvasState;
  renderOptions: RenderOptions;

  // UI State
  selectedNode: string | null;
  editingNode: string | null;
  isFullscreen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  dirty: boolean;
  lastSavedAt?: string;

  // History (session-only)
  past: FamilyTree[];
  future: FamilyTree[];

  // Actions
  setTree: (tree: FamilyTree) => void;
  addMember: (
    member: Omit<FamilyMember, "id" | "createdAt" | "updatedAt">
  ) => void;
  updateMember: (id: string, updates: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;
  addEdge: (edge: Omit<FamilyEdge, "id" | "metadata">) => void;
  removeEdge: (id: string) => void;
  updateEdge: (id: string, updates: Partial<FamilyEdge>) => void;

  // History ops
  undo: () => void;
  redo: () => void;

  // Layout
  setLayout: (layout: LayoutResult) => void;
  updateCanvasState: (updates: Partial<CanvasState>) => void;
  setRenderOptions: (options: Partial<RenderOptions>) => void;

  // UI
  setSelectedNode: (nodeId: string | null) => void;
  setEditingNode: (nodeId: string | null) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setLastSavedAt: (iso?: string) => void;

  // Computed selectors
  getMember: (id: string) => FamilyMember | undefined;
  getChildren: (parentId: string) => FamilyMember[];
  getParents: (childId: string) => FamilyMember[];
  getSpouses: (memberId: string) => FamilyMember[];
  getSiblings: (memberId: string) => FamilyMember[];
}

export const useFamilyTreeStore = create<FamilyTreeState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    tree: null,
    members: [],
    edges: [],
    layout: null,
    canvasState: {
      panX: 0,
      panY: 0,
      zoom: 1,
      width: 800,
      height: 600,
    },
    renderOptions: {
      showNames: true,
      showDates: true,
      showAvatars: true,
    },
    selectedNode: null,
    editingNode: null,
    isFullscreen: false,
    isLoading: false,
    isSaving: false,
    error: null,
    dirty: false,
    past: [],
    future: [],

    // Actions
    setTree: (tree) =>
      set((state) => ({
        past: state.tree ? [...state.past, state.tree].slice(-50) : state.past,
        future: [],
        tree,
        members: tree.members,
        edges: tree.edges,
        error: null,
        dirty: false,
      })),

    addMember: (memberData) => {
      const newMember: FamilyMember = {
        ...memberData,
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        xp: 0,
        level: 1,
      };

      set((state) => ({
        past: state.tree ? [...state.past, state.tree].slice(-50) : state.past,
        future: [],
        members: [...state.members, newMember],
        tree: state.tree
          ? {
              ...state.tree,
              members: [...state.members, newMember],
              updatedAt: new Date().toISOString(),
            }
          : null,
        dirty: true,
      }));
    },

    updateMember: (id, updates) => {
      set((state) => {
        const updatedMembers = state.members.map((member) =>
          member.id === id
            ? { ...member, ...updates, updatedAt: new Date().toISOString() }
            : member
        );

        return {
          past: state.tree
            ? [...state.past, state.tree].slice(-50)
            : state.past,
          future: [],
          members: updatedMembers,
          tree: state.tree
            ? {
                ...state.tree,
                members: updatedMembers,
                updatedAt: new Date().toISOString(),
              }
            : null,
          dirty: true,
        };
      });
    },

    removeMember: (id) => {
      set((state) => {
        const filteredMembers = state.members.filter(
          (member) => member.id !== id
        );
        const filteredEdges = state.edges.filter(
          (edge) => edge.fromId !== id && edge.toId !== id
        );

        return {
          past: state.tree
            ? [...state.past, state.tree].slice(-50)
            : state.past,
          future: [],
          members: filteredMembers,
          edges: filteredEdges,
          selectedNode: state.selectedNode === id ? null : state.selectedNode,
          editingNode: state.editingNode === id ? null : state.editingNode,
          tree: state.tree
            ? {
                ...state.tree,
                members: filteredMembers,
                edges: filteredEdges,
                updatedAt: new Date().toISOString(),
              }
            : null,
          dirty: true,
        };
      });
    },

    addEdge: (edgeData) => {
      const newEdge: FamilyEdge = {
        ...edgeData,
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      set((state) => {
        // XP updates for involved members
        const xpDelta = 5;
        const updatedMembers = state.members.map((m) => {
          if (m.id === newEdge.fromId || m.id === newEdge.toId) {
            const nextXp = (m.xp || 0) + xpDelta;
            const nextLevel = Math.max(1, Math.floor(nextXp / 100) + 1);
            return {
              ...m,
              xp: nextXp,
              level: nextLevel,
              updatedAt: new Date().toISOString(),
            };
          }
          return m;
        });

        return {
          past: state.tree
            ? [...state.past, state.tree].slice(-50)
            : state.past,
          future: [],
          members: updatedMembers,
          edges: [...state.edges, newEdge],
          tree: state.tree
            ? {
                ...state.tree,
                members: updatedMembers,
                edges: [...state.edges, newEdge],
                updatedAt: new Date().toISOString(),
              }
            : null,
          dirty: true,
        };
      });
    },

    removeEdge: (id) => {
      set((state) => {
        const filteredEdges = state.edges.filter((edge) => edge.id !== id);

        return {
          past: state.tree
            ? [...state.past, state.tree].slice(-50)
            : state.past,
          future: [],
          edges: filteredEdges,
          tree: state.tree
            ? {
                ...state.tree,
                edges: filteredEdges,
                updatedAt: new Date().toISOString(),
              }
            : null,
          dirty: true,
        };
      });
    },

    updateEdge: (id, updates) => {
      set((state) => {
        const updatedEdges = state.edges.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                ...updates,
                metadata: {
                  ...edge.metadata,
                  updatedAt: new Date().toISOString(),
                },
              }
            : edge
        );

        return {
          past: state.tree
            ? [...state.past, state.tree].slice(-50)
            : state.past,
          future: [],
          edges: updatedEdges,
          tree: state.tree
            ? {
                ...state.tree,
                edges: updatedEdges,
                updatedAt: new Date().toISOString(),
              }
            : null,
          dirty: true,
        };
      });
    },

    // History ops
    undo: () => {
      const state = get();
      if (!state.past.length) return;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      const current = state.tree;
      set({
        past: newPast,
        future: current
          ? [current, ...state.future].slice(0, 50)
          : state.future,
        tree: previous,
        members: previous.members,
        edges: previous.edges,
      });
    },
    redo: () => {
      const state = get();
      if (!state.future.length) return;
      const nextFuture = [...state.future];
      const next = nextFuture.shift()!;
      const current = state.tree;
      set({
        past: current ? [...state.past, current].slice(-50) : state.past,
        future: nextFuture,
        tree: next,
        members: next.members,
        edges: next.edges,
      });
    },

    // Layout
    setLayout: (layout) => set({ layout }),
    updateCanvasState: (updates) =>
      set((state) => ({
        canvasState: { ...state.canvasState, ...updates },
      })),
    setRenderOptions: (options) =>
      set((state) => ({
        renderOptions: { ...state.renderOptions, ...options },
      })),

    // UI
    setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),
    setEditingNode: (nodeId) => set({ editingNode: nodeId }),
    setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
    setLoading: (loading) => set({ isLoading: loading }),
    setSaving: (saving) => set({ isSaving: saving }),
    setError: (error) => set({ error }),
    setDirty: (dirty) => set({ dirty }),
    setLastSavedAt: (iso) => set({ lastSavedAt: iso }),

    // Computed selectors
    getMember: (id) => get().members.find((member) => member.id === id),
    getChildren: (parentId) => {
      const { members, edges } = get();
      const childIds = edges
        .filter((edge) => edge.fromId === parentId && edge.type === "parent")
        .map((edge) => edge.toId);
      return members.filter((member) => childIds.includes(member.id));
    },
    getParents: (childId) => {
      const { members, edges } = get();
      const parentIds = edges
        .filter((edge) => edge.toId === childId && edge.type === "parent")
        .map((edge) => edge.fromId);
      return members.filter((member) => parentIds.includes(member.id));
    },
    getSpouses: (memberId) => {
      const { members, edges } = get();
      const spouseIds = edges
        .filter(
          (edge) =>
            (edge.fromId === memberId || edge.toId === memberId) &&
            edge.type === "spouse"
        )
        .map((edge) => (edge.fromId === memberId ? edge.toId : edge.fromId));
      return members.filter((member) => spouseIds.includes(member.id));
    },
    getSiblings: (memberId) => {
      const { getParents, getChildren } = get();
      const parents = getParents(memberId);
      const siblings = new Set<FamilyMember>();

      parents.forEach((parent) => {
        const children = getChildren(parent.id);
        children.forEach((child) => {
          if (child.id !== memberId) {
            siblings.add(child);
          }
        });
      });

      return Array.from(siblings);
    },
  }))
);

// Selectors for performance
export const selectMembers = (state: FamilyTreeState) => state.members;
export const selectEdges = (state: FamilyTreeState) => state.edges;
export const selectLayout = (state: FamilyTreeState) => state.layout;
export const selectCanvasState = (state: FamilyTreeState) => state.canvasState;
export const selectSelectedNode = (state: FamilyTreeState) =>
  state.selectedNode;
