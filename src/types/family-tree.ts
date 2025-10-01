export interface FamilyMember {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  x?: number;
  y?: number;
  birthDate?: string;
  deathDate?: string;
  gender?: "male" | "female" | "other";
  tags: string[];
  avatarUrl?: string;
  notes?: string;
  location?: string;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyEdge {
  id: string;
  fromId: string;
  toId: string;
  type: "parent" | "spouse" | "adoptive" | "step";
  metadata: {
    strength?: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface TreeSettings {
  colorScheme: string;
  viewMode: "classic" | "radial" | "timeline";
  layout: "horizontal" | "vertical" | "radial" | "timeline";
  branchColors: Record<string, string>;
  nodeStyles: Record<string, any>;
}

export interface TreeAnnotation {
  id: string;
  type: "sticky" | "draw" | "doc";
  position: { x: number; y: number };
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface TreeVersion {
  current: number;
  history: Array<{
    id: string;
    ts: string;
    summary: string;
    snapshotRef: string;
  }>;
}

export interface FamilyTree {
  id: string;
  ownerId: string;
  members: FamilyMember[];
  edges: FamilyEdge[];
  settings: TreeSettings;
  annotations: TreeAnnotation[];
  version: TreeVersion;
  createdAt: string;
  updatedAt: string;
}

// Layout-specific types
export interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  level?: number;
}

export interface EdgePath {
  id: string;
  fromId: string;
  toId: string;
  path: string; // SVG path string
  type: FamilyEdge["type"];
}

export interface LayoutResult {
  nodes: NodePosition[];
  edges: EdgePath[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

// Canvas rendering types
export interface CanvasState {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
}

export interface RenderOptions {
  showNames: boolean;
  showDates: boolean;
  showAvatars: boolean;
  highlightPath?: string[]; // Array of node IDs to highlight
  selectedNode?: string;
}
