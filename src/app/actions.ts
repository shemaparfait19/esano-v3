"use server";

import { analyzeDnaAndPredictRelatives } from "@/ai/flows/ai-dna-prediction";
import { analyzeAncestry } from "@/ai/flows/ai-ancestry-estimation";
import { getGenerationalInsights } from "@/ai/flows/ai-generational-insights";
import { askGenealogyAssistant } from "@/ai/flows/ai-genealogy-assistant";
import type { AnalyzeDnaAndPredictRelativesInput } from "@/ai/schemas/ai-dna-prediction";
import type { AncestryEstimationInput } from "@/ai/schemas/ai-ancestry-estimation";
import type { GenerationalInsightsInput } from "@/ai/schemas/ai-generational-insights";
import { db } from "@/lib/firebase";
import {
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type {
  UserProfile,
  ConnectionRequest,
  ConnectionRequestStatus,
  FamilyTree,
  FamilyTreeMember,
  FamilyTreeEdge,
} from "@/types/firestore";

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-throw-literal
  throw lastError;
}

export async function analyzeDna(
  userId: string,
  dnaData: string,
  fileName: string
) {
  try {
    const safeDnaData = (dnaData || "").slice(0, 200_000);

    // Gather real comparator DNA from other users
    const usersSnapshot = await adminDb.collection("users").get();
    const otherUsersDnaData: string[] = [];
    const validUserIds = new Set<string>();
    usersSnapshot.docs.forEach((d) => {
      if (d.id === userId) return;
      const data = d.data() as UserProfile;
      if (
        data?.dnaData &&
        typeof data.dnaData === "string" &&
        data.dnaData.length > 0
      ) {
        otherUsersDnaData.push(data.dnaData);
        validUserIds.add(d.id);
      }
    });

    const ancestryInput: AncestryEstimationInput = { snpData: safeDnaData };
    const insightsInput: GenerationalInsightsInput = {
      geneticMarkers: safeDnaData,
    };

    // Always compute ancestry/insights for the user
    const [ancestry, insights] = await Promise.all([
      withRetry(() => analyzeAncestry(ancestryInput)),
      withRetry(() => getGenerationalInsights(insightsInput)),
    ]);

    // Only compute relatives when there is at least one real comparator
    let relatives: Awaited<ReturnType<typeof analyzeDnaAndPredictRelatives>> =
      [];
    if (otherUsersDnaData.length > 0) {
      const dnaInput: AnalyzeDnaAndPredictRelativesInput = {
        dnaData: safeDnaData,
        otherUsersDnaData: otherUsersDnaData.slice(0, 50),
        userFamilyTreeData: "None",
      };
      const raw = await withRetry(() =>
        analyzeDnaAndPredictRelatives(dnaInput)
      );

      // Post-validate: keep only matches that reference a real user with stored dna
      relatives = (raw || [])
        .filter(
          (r) =>
            !!r && typeof r.userId === "string" && validUserIds.has(r.userId)
        )
        .filter(
          (r) =>
            r.relationshipProbability === undefined ||
            r.relationshipProbability >= 0.3
        )
        .slice(0, 20);
    } else {
      relatives = [];
    }

    const userProfile: Partial<UserProfile> = {
      userId,
      dnaData: safeDnaData,
      dnaFileName: fileName,
      analysis: {
        relatives,
        ancestry,
        insights,
        completedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date().toISOString(),
    };
    await adminDb
      .collection("users")
      .doc(userId)
      .set(userProfile, { merge: true });

    return { relatives, ancestry, insights };
  } catch (error: any) {
    console.error(
      "AI Analysis or Firestore operation failed:",
      error?.message || error
    );
    throw new Error(
      error?.message || "Failed to analyze DNA data. Please try again later."
    );
  }
}

export async function getAssistantResponse(query: string) {
  try {
    const result = await askGenealogyAssistant({ query });
    return result.response;
  } catch (error) {
    console.error("AI Assistant failed:", error);
    return "I'm sorry, I'm having trouble connecting right now. Please try again later.";
  }
}

export type SaveProfileInput = {
  userId: string;
  fullName: string;
  birthDate?: string;
  birthPlace?: string;
  clanOrCulturalInfo?: string;
  relativesNames?: string[];
};

export async function saveUserProfile(input: SaveProfileInput) {
  try {
    const {
      userId,
      fullName,
      birthDate,
      birthPlace,
      clanOrCulturalInfo,
      relativesNames,
    } = input;
    if (!userId || !fullName) {
      return { ok: false as const, error: "Missing required fields" };
    }
    const nowIso = new Date().toISOString();
    const partial: Partial<UserProfile> = {
      userId,
      fullName,
      birthDate: birthDate || undefined,
      birthPlace: birthPlace || undefined,
      clanOrCulturalInfo: clanOrCulturalInfo || undefined,
      relativesNames: relativesNames?.filter(Boolean) ?? [],
      profileCompleted: true,
      updatedAt: nowIso,
    };
    await adminDb.collection("users").doc(userId).set(partial, { merge: true });
    return { ok: true as const };
  } catch (e: any) {
    console.error("saveUserProfile failed", e);
    return { ok: false as const, error: e?.message ?? "Unknown error" };
  }
}

export async function saveUserDna(
  userId: string,
  dnaData: string,
  fileName?: string
) {
  try {
    if (!userId || !dnaData)
      return { ok: false as const, error: "Missing userId or dnaData" };
    const safeDna = dnaData.slice(0, 500_000); // cap size
    const partial: Partial<UserProfile> = {
      userId,
      dnaData: safeDna,
      dnaFileName: fileName || undefined,
      updatedAt: new Date().toISOString(),
    };
    await adminDb.collection("users").doc(userId).set(partial, { merge: true });
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? "Failed to save DNA" };
  }
}

export type SuggestedMatch = {
  userId: string;
  fullName?: string;
  score: number; // 0..1
  reasons: string[];
};

export async function getSuggestedMatches(
  currentUserId: string
): Promise<SuggestedMatch[]> {
  // Simple heuristic suggestions based on profile overlap (non-DNA)
  const currentDoc = await adminDb.collection("users").doc(currentUserId).get();
  if (!currentDoc.exists) return [];
  const me = currentDoc.data() as UserProfile;
  const usersSnapshot = await adminDb.collection("users").get();

  const suggestions: SuggestedMatch[] = [];
  for (const d of usersSnapshot.docs) {
    const otherId = d.id;
    if (otherId === currentUserId) continue;
    const other = d.data() as UserProfile;

    let score = 0;
    const reasons: string[] = [];

    const myNames = (me.relativesNames ?? []).map((n) => n.toLowerCase());
    const otherNames = (other.relativesNames ?? []).map((n) => n.toLowerCase());
    const sharedNames = myNames.filter((n) => otherNames.includes(n));
    if (sharedNames.length > 0) {
      score += Math.min(0.4, sharedNames.length * 0.1);
      reasons.push(`Shared relatives: ${sharedNames.slice(0, 3).join(", ")}`);
    }

    if (
      me.birthPlace &&
      other.birthPlace &&
      me.birthPlace.toLowerCase() === other.birthPlace.toLowerCase()
    ) {
      score += 0.25;
      reasons.push("Same birth place");
    }

    if (
      me.clanOrCulturalInfo &&
      other.clanOrCulturalInfo &&
      me.clanOrCulturalInfo.toLowerCase() ===
        other.clanOrCulturalInfo.toLowerCase()
    ) {
      score += 0.25;
      reasons.push("Matching clan/cultural info");
    }

    if (me.fullName && other.fullName) {
      const a = me.fullName.toLowerCase();
      const b = other.fullName.toLowerCase();
      if (a.includes(b) || b.includes(a)) {
        score += 0.1;
        reasons.push("Similar full name");
      }
    }

    if (score > 0) {
      suggestions.push({
        userId: otherId,
        fullName: other.fullName,
        score: Math.min(1, score),
        reasons,
      });
    }
  }

  suggestions.sort((x, y) => y.score - x.score);
  return suggestions.slice(0, 9);
}

// Connection Requests
export async function sendConnectionRequest(
  fromUserId: string,
  toUserId: string
) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    throw new Error("Invalid users");
  }
  const id = `${fromUserId}_${toUserId}`;
  const req: ConnectionRequest = {
    fromUserId,
    toUserId,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await adminDb
    .collection("connectionRequests")
    .doc(id)
    .set(req, { merge: true });
  // Create notification for recipient
  try {
    await adminDb.collection("notifications").add({
      userId: toUserId,
      type: "incoming_connection_request",
      relatedUserId: fromUserId,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch {}
  return { ok: true } as const;
}

export async function respondToConnectionRequest(
  id: string,
  status: ConnectionRequestStatus
) {
  if (!["accepted", "declined"].includes(status)) {
    throw new Error("Invalid status");
  }
  await adminDb
    .collection("connectionRequests")
    .doc(id)
    .set({ status, respondedAt: new Date().toISOString() }, { merge: true });
  return { ok: true } as const;
}

export async function getMyConnectionRequests(userId: string) {
  const snap = await adminDb.collection("connectionRequests").get();
  const all = snap.docs.map((d: any) => ({
    id: d.id,
    ...(d.data() as ConnectionRequest),
  }));
  const incoming = all.filter(
    (r: ConnectionRequest) => r.toUserId === userId && r.status === "pending"
  );
  const outgoing = all.filter(
    (r: ConnectionRequest) => r.fromUserId === userId && r.status === "pending"
  );
  return { incoming, outgoing };
}

// Family Tree actions
export async function getFamilyTree(ownerUserId: string): Promise<FamilyTree> {
  const ref = fsDoc(db, "familyTrees", ownerUserId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as FamilyTree;
  }
  const empty: FamilyTree = {
    ownerUserId,
    members: [],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, empty, { merge: true });
  return empty;
}

export async function addFamilyMember(
  ownerUserId: string,
  member: FamilyTreeMember
): Promise<FamilyTree> {
  const tree = await getFamilyTree(ownerUserId);
  const updated: FamilyTree = {
    ...tree,
    members: [...tree.members.filter((m) => m.id !== member.id), member],
    updatedAt: new Date().toISOString(),
  };
  await setDoc(fsDoc(db, "familyTrees", ownerUserId), updated, { merge: true });
  return updated;
}

export async function linkFamilyRelation(
  ownerUserId: string,
  edge: FamilyTreeEdge
): Promise<FamilyTree> {
  const tree = await getFamilyTree(ownerUserId);
  const withoutDup = tree.edges.filter(
    (e) =>
      !(
        e.fromId === edge.fromId &&
        e.toId === edge.toId &&
        e.relation === edge.relation
      )
  );
  const updated: FamilyTree = {
    ...tree,
    edges: [...withoutDup, edge],
    updatedAt: new Date().toISOString(),
  };
  await setDoc(fsDoc(db, "familyTrees", ownerUserId), updated, { merge: true });
  return updated;
}
