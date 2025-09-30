import type { AnalyzeDnaAndPredictRelativesOutput } from "@/ai/schemas/ai-dna-prediction";
import type { AncestryEstimationOutput } from "@/ai/schemas/ai-ancestry-estimation";
import type { GenerationalInsightsOutput } from "@/ai/schemas/ai-generational-insights";

export interface UserProfile {
  userId: string;
  email?: string;
  displayName?: string;
  fullName?: string;
  birthDate?: string; // ISO date string
  birthPlace?: string;
  clanOrCulturalInfo?: string;
  relativesNames?: string[]; // simple list of known relatives names
  profileCompleted?: boolean;
  dnaData?: string;
  dnaFileName?: string;
  analysis?: {
    relatives: AnalyzeDnaAndPredictRelativesOutput;
    ancestry: AncestryEstimationOutput;
    insights: GenerationalInsightsOutput;
    completedAt: string;
  };
  familyTree?: any; // Define a proper type for family tree later
  createdAt?: string;
  updatedAt?: string;
}

export type ConnectionRequestStatus = "pending" | "accepted" | "declined";

export interface ConnectionRequest {
  id?: string;
  fromUserId: string;
  toUserId: string;
  status: ConnectionRequestStatus;
  createdAt: string; // ISO
  respondedAt?: string; // ISO
}

// Family Tree
export type FamilyRelation =
  | "parent"
  | "child"
  | "sibling"
  | "spouse"
  | "grandparent"
  | "grandchild"
  | "cousin";

export interface FamilyTreeMember {
  id: string; // uuid
  fullName: string;
  gender?: "male" | "female";
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  occupation?: string;
  notes?: string;
  photoUrl?: string;
  photos?: string[];
  audioUrls?: string[]; // recorded voice notes
  mediaUrls?: string[]; // documents/videos
  tags?: string[];
  isDeceased?: boolean;
  visibility?: "public" | "relatives" | "private";
  externalIds?: Record<string, string>; // e.g., ancestry/myheritage ids
  // Canvas coordinates for interactive board rendering
  x?: number; // px
  y?: number; // px
}

export interface FamilyTreeEdge {
  fromId: string;
  toId: string;
  relation: FamilyRelation;
  certainty?: number; // 0..1
  notes?: string;
}

export interface FamilyTree {
  ownerUserId: string;
  members: FamilyTreeMember[];
  edges: FamilyTreeEdge[];
  updatedAt: string;
}
