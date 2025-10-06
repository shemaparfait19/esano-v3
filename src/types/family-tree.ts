export interface FamilyMember {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  x?: number;
  y?: number;
  isHeadOfFamily?: boolean;
  xp?: number;
  level?: number;
  // Ancestry & origin
  ethnicity?: string;
  originRegion?: string; // e.g., "Bugesera, Eastern Province"
  origins?: string[]; // multiple regions/tribes/clans
  // Contacts
  contacts?: {
    phone?: string;
    email?: string;
    address?: string;
    emergencyContact?: string;
  };
  // Timeline & milestones
  timeline?: Array<{
    id: string;
    type: "photo" | "video" | "audio" | "event" | "note";
    date: string; // ISO
    title?: string;
    url?: string;
    description?: string;
  }>;
  voiceUrls?: string[];
  milestones?: Array<{
    id: string;
    kind: "birth" | "wedding" | "graduation" | "funeral" | "other";
    date: string;
    title?: string;
  }>;
  // Budgeting entries (simple stub)
  budgetEntries?: Array<{
    id: string;
    purpose: string;
    amount: number;
    date: string;
    notes?: string;
  }>;
  birthDate?: string;
  deathDate?: string;
  gender?: "male" | "female" | "other";
  tags: string[];
  avatarUrl?: string;
  mediaUrls?: string[];
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
  type:
    | "parent"
    | "spouse"
    | "adoptive"
    | "step"
    | "big_sister"
    | "little_sister"
    | "big_brother"
    | "little_brother"
    | "aunt"
    | "uncle"
    | "cousin_big"
    | "cousin_little"
    | "guardian"
    | "other";
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
