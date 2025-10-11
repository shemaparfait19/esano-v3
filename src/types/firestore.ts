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
  // Family code system
  familyCode?: string; // 8-character family code
  isFamilyHead?: boolean; // Can generate family codes and manage permissions
  familyTreeApproved?: boolean; // Admin approval for family tree creation
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

// Family Tree Application System
export type ApplicationStatus = "pending" | "approved" | "denied";

export interface FamilyTreeApplication {
  id?: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  applicationData: {
    // Personal Information
    fullName: string;
    nationalId: string;
    phoneNumber: string;
    address: string;

    // Family Information
    reasonForTree: string;
    familyBackground: string;
    expectedMembers: number;

    // Legal Information
    isLegalGuardian: boolean;
    guardianName?: string;
    guardianRelationship?: string;
    guardianContact?: string;

    // Cultural and Additional Information
    culturalSignificance?: string;
    additionalInfo?: string;

    // Legal Declarations
    agreeToTerms: boolean;
    confirmAccuracy: boolean;
    consentToVerification: boolean;
  };
  documents?: {
    nationalId?: string; // URL to uploaded document
    proofOfFamily?: string; // URL to uploaded document
    guardianConsent?: string; // URL to uploaded document
  };
  status: ApplicationStatus;
  adminNotes?: string;
  reviewedBy?: string; // Admin user ID
  reviewedAt?: string; // ISO date
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

// Family Code System
export interface FamilyCode {
  code: string; // 8-character code
  generatedBy: string; // User ID of family head
  familyName?: string;
  isActive: boolean;
  createdAt: string; // ISO date
  expiresAt?: string; // ISO date (optional expiration)
}

// Admin System
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: "super_admin" | "admin" | "moderator";
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface FamilyTree {
  ownerUserId: string;
  members: FamilyTreeMember[];
  edges: FamilyTreeEdge[];
  updatedAt: string;
}
