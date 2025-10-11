"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useFamilyTreeStore } from "@/lib/family-tree-store";
import { TreeCanvas } from "@/components/family-tree/tree-canvas";
import { TreeToolbar } from "@/components/family-tree/tree-toolbar";
import { NodeEditor } from "@/components/family-tree/node-editor";
import { FamilyMember, FamilyEdge } from "@/types/family-tree";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Heart,
  Undo2,
  Redo2,
  Download,
  Maximize2,
  Sparkles,
  Search,
  Users,
  Globe,
  Edit,
  Eye,
  EyeOff,
  Save,
  Undo,
  Redo,
  Fullscreen,
  Minimize,
  X,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { FamilyTreeApplicationForm } from "@/components/family-tree/application-form";
import { FamilyTreeSuggestions } from "@/components/dashboard/family-tree-suggestions";

export default function FamilyTreePage() {
  const { user, userProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ownerIdParam = searchParams?.get("ownerId") || undefined;
  const searchParam = searchParams?.get("search") || undefined;
  const {
    tree,
    members,
    edges,
    selectedNode,
    editingNode,
    isFullscreen,
    isLoading,
    isSaving,
    error,
    setTree,
    addMember,
    addEdge,
    removeMember,
    setSelectedNode,
    setEditingNode,
    setFullscreen,
    setLoading,
    setSaving,
    setLastSavedAt,
    setError,
    dirty,
    setDirty,
    undo,
    redo,
  } = useFamilyTreeStore();

  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showAddRelationshipDialog, setShowAddRelationshipDialog] =
    useState(false);
  const [newMember, setNewMember] = useState<Partial<FamilyMember>>({});
  const [newRelationship, setNewRelationship] = useState<Partial<FamilyEdge>>(
    {}
  );
  const [presence, setPresence] = useState<
    Array<{
      id: string;
      name?: string;
      color?: string;
      x?: number;
      y?: number;
      lastActive?: string;
    }>
  >([]);
  const [containerRect, setContainerRect] = useState<{
    left: number;
    top: number;
  }>({ left: 0, top: 0 });
  const [readonly, setReadonly] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"viewer" | "editor">("viewer");
  const [shares, setShares] = useState<any[]>([]);
  const [shareNames, setShareNames] = useState<Record<string, string>>({});
  const [ownerName, setOwnerName] = useState<string>("");
  const [viewerRole, setViewerRole] = useState<"viewer" | "editor" | null>(
    null
  );
  const [suggested, setSuggested] = useState<Array<any>>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [askText, setAskText] = useState("");
  const [askAnswer, setAskAnswer] = useState<string>("");
  const [joinQuery, setJoinQuery] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinResults, setJoinResults] = useState<Array<any>>([]);
  const [accessRequests, setAccessRequests] = useState<Array<any>>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<{
    hasApplication: boolean;
    status: "pending" | "approved" | "denied" | null;
    lastApplication: any;
  }>({
    hasApplication: false,
    status: null,
    lastApplication: null,
  });
  const [isEditMode, setIsEditMode] = useState(true);
  const [showViewResult, setShowViewResult] = useState(false);

  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [lastPresenceWrite, setLastPresenceWrite] = useState<number>(0);

  // Load family tree on mount
  useEffect(() => {
    if (user?.uid) {
      loadFamilyTree();
    }
  }, [user?.uid, ownerIdParam]);

  // Check application status for users without family tree approval
  useEffect(() => {
    if (!user?.uid || ownerIdParam || userProfile?.familyTreeApproved) return;

    const checkApplicationStatus = async () => {
      try {
        const res = await fetch(
          `/api/family-tree/application?userId=${user.uid}`
        );
        const data = await res.json();

        if (res.ok && data.applications) {
          const applications = data.applications;
          const lastApplication = applications[0];

          setApplicationStatus({
            hasApplication: applications.length > 0,
            status: lastApplication?.status || null,
            lastApplication,
          });
        }
      } catch (error) {
        console.error("Failed to check application status:", error);
      }
    };

    checkApplicationStatus();
  }, [user?.uid, ownerIdParam, userProfile?.familyTreeApproved]);

  // Load access requests
  useEffect(() => {
    if (!user?.uid || ownerIdParam) return;

    const loadAccessRequests = async () => {
      try {
        setRequestsLoading(true);
        const res = await fetch(
          `/api/family-tree/access-request?ownerId=${user.uid}`
        );
        const d = await res.json();
        if (res.ok && Array.isArray(d.items)) {
          setAccessRequests(d.items);
        } else {
          console.warn("Invalid access requests response:", d);
          setAccessRequests([]);
        }
      } catch (err) {
        console.error("Failed to load access requests:", err);
        setAccessRequests([]);
      } finally {
        setRequestsLoading(false);
      }
    };

    loadAccessRequests();
  }, [user?.uid, ownerIdParam]);

  // Live search for Join Existing Tree
  useEffect(() => {
    const q = joinQuery.trim();
    if (q.length < 2) {
      setJoinResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setJoinLoading(true);
        const res = await fetch(
          `/api/family-tree/search?q=${encodeURIComponent(q)}&limit=12`
        );
        const d = await res.json();
        if (res.ok) setJoinResults(d.items || []);
      } catch {
      } finally {
        setJoinLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [joinQuery]);

  // Suggestion logic
  useEffect(() => {
    if (
      !newRelationship.fromId ||
      !newRelationship.toId ||
      !newRelationship.type
    ) {
      setSuggestion(null);
      return;
    }
    if (newRelationship.type === "parent") {
      const parentId = newRelationship.fromId;
      const childId = newRelationship.toId;
      const hasOtherParent = edges.some(
        (e) =>
          e.type === "parent" && e.toId === childId && e.fromId !== parentId
      );
      if (!hasOtherParent) {
        const possibleSpouses = edges
          .filter(
            (e) =>
              e.type === "spouse" &&
              (e.fromId === parentId || e.toId === parentId)
          )
          .map((e) => (e.fromId === parentId ? e.toId : e.fromId));
        if (possibleSpouses.length > 0) {
          const name =
            members.find((m) => m.id === possibleSpouses[0])?.fullName ||
            "their spouse";
          setSuggestion(`Also add ${name} as a parent of this child?`);
          return;
        }
      }
    }
    setSuggestion(null);
  }, [newRelationship, edges, members]);

  // Highlight path
  useEffect(() => {
    if (!selectedNode) {
      useFamilyTreeStore
        .getState()
        .setRenderOptions({ highlightPath: undefined });
      return;
    }
    const visited = new Set<string>();
    const stack = [selectedNode];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      edges
        .filter((e) => e.type === "parent" && e.fromId === cur)
        .forEach((e) => stack.push(e.toId));
    }
    const up = [selectedNode];
    while (up.length) {
      const cur = up.pop()!;
      edges
        .filter((e) => e.type === "parent" && e.toId === cur)
        .forEach((e) => {
          if (!visited.has(e.fromId)) {
            visited.add(e.fromId);
            up.push(e.fromId);
          }
        });
    }
    useFamilyTreeStore
      .getState()
      .setRenderOptions({ highlightPath: Array.from(visited) });
  }, [selectedNode, edges]);

  // Container rect
  useEffect(() => {
    const treeOwner = ownerIdParam || user?.uid;
    if (!user?.uid || !treeOwner) return;
    const viewport = document.getElementById("tree-viewport");
    const updateRect = () => {
      const r = viewport?.getBoundingClientRect();
      if (r) setContainerRect({ left: r.left, top: r.top });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [user?.uid]);

  // Presence
  useEffect(() => {
    const treeOwner = ownerIdParam || user?.uid;
    if (!user?.uid || !treeOwner) return;
    try {
      const presCol = collection(db, "familyTrees", treeOwner, "presence");
      const unsub = onSnapshot(
        presCol,
        (snap) => {
          const items = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((p) => p.id !== user.uid);
          setPresence(items);
        },
        (err) => {
          console.warn("presence onSnapshot error", err?.code || err?.message);
        }
      );
      return () => unsub();
    } catch (e) {}
  }, [user?.uid, ownerIdParam]);

  // Auto-save
  useEffect(() => {
    if (!dirty || readonly) return;
    const t = setTimeout(() => {
      saveFamilyTree();
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, readonly]);

  const loadFamilyTree = async () => {
    const now = Date.now();
    if (now - lastLoadTime < 5000) {
      console.log("Skipping loadFamilyTree - too soon");
      return;
    }
    setLastLoadTime(now);

    try {
      setLoading(true);
      setError(null);
      const ownerId = ownerIdParam || user?.uid;
      if (!ownerId) return;

      if (ownerIdParam && ownerIdParam !== user?.uid) {
        const shareRes = await fetch(
          `/api/family-tree/share?sharedWithMe=1&userId=${user?.uid}`
        );
        const shareData = await shareRes.json();
        if (!shareRes.ok) {
          throw new Error(shareData.error || "Failed to verify share access");
        }
        const share = (shareData.shares || []).find(
          (s: any) => s.ownerId === ownerIdParam
        );
        if (!share) {
          throw new Error("You do not have access to this family tree");
        }
        setReadonly(share.role !== "editor");
        setViewerRole(share.role);
        try {
          const { getDoc, doc } = await import("firebase/firestore");
          const snap = await getDoc(doc(db, "users", ownerIdParam));
          const ud = snap.exists() ? (snap.data() as any) : null;
          setOwnerName(
            ud?.fullName || ud?.preferredName || ud?.firstName || ownerIdParam
          );
        } catch {}
      } else {
        setReadonly(false);
        setViewerRole(null);
        setOwnerName("");
      }

      const response = await fetch(`/api/family-tree?userId=${ownerId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load family tree");
      }

      setTree(data.tree);

      if (ownerIdParam && user?.uid) {
        try {
          await fetch("/api/notifications/mark-read-share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.uid, ownerId: ownerIdParam }),
          });
        } catch {}
      }

      if (!ownerIdParam && user?.uid) {
        try {
          const res = await fetch(`/api/family-tree/share?ownerId=${user.uid}`);
          const d = await res.json();
          if (res.ok) {
            setShares(d.shares || []);
            const loadNames = async () => {
              const entries: [string, string][] = [];
              for (const s of d.shares || []) {
                try {
                  const { getDoc, doc } = await import("firebase/firestore");
                  const snap = await getDoc(doc(db, "users", s.targetUserId));
                  const ud = snap.exists() ? (snap.data() as any) : null;
                  const name =
                    ud?.fullName ||
                    ud?.preferredName ||
                    ud?.firstName ||
                    s.targetEmail ||
                    s.targetUserId;
                  entries.push([s.targetUserId, name]);
                } catch {}
              }
              setShareNames(Object.fromEntries(entries));
            };
            loadNames();
          }
        } catch {}
      }

      if (!ownerIdParam) {
        try {
          setSuggestedLoading(true);
          const res = await fetch(`/api/family-tree/suggested?limit=12`);
          const d = await res.json();
          if (res.ok && Array.isArray(d.items)) {
            setSuggested(d.items);
          } else {
            console.warn("Invalid suggested trees response:", d);
            setSuggested([]);
          }
        } catch (err) {
          console.error("Failed to load suggested trees:", err);
          setSuggested([]);
        } finally {
          setSuggestedLoading(false);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load family tree";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveFamilyTree = async () => {
    if (!user?.uid || !tree) return;
    if (readonly) return;

    try {
      setSaving(true);
      const targetOwner = ownerIdParam || user.uid;
      const response = await fetch("/api/family-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetOwner, tree }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save family tree");
      }

      setLastSavedAt(new Date().toISOString());
      setDirty(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save family tree";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = () => {
    if (readonly) {
      toast({ title: "View only", description: "You have view access only." });
      return;
    }
    setShowAddMemberDialog(true);
    setNewMember({
      firstName: "",
      lastName: "",
      gender: undefined,
      tags: [],
      customFields: {},
    });
  };

  const handleRequestAccess = async (
    targetOwnerId: string,
    access: "viewer" | "editor"
  ) => {
    if (!user?.uid) return;
    try {
      const res = await fetch("/api/family-tree/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: targetOwnerId,
          requesterId: user.uid,
          access,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({
        title: "Request sent",
        description: `Asked for ${access} access`,
      });
    } catch (e: any) {
      toast({
        title: "Request failed",
        description: e?.message || "",
        variant: "destructive",
      });
    }
  };

  const handleSaveMember = () => {
    if (!newMember.firstName || !newMember.lastName) {
      toast({
        title: "Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    addMember({
      firstName: newMember.firstName,
      lastName: newMember.lastName,
      fullName: `${newMember.firstName} ${newMember.lastName}`,
      birthDate: newMember.birthDate,
      deathDate: newMember.deathDate,
      gender: newMember.gender,
      tags: newMember.tags || [],
      location: newMember.location,
      notes: newMember.notes,
      customFields: newMember.customFields || {},
    });

    setShowAddMemberDialog(false);
    setNewMember({});
    setDirty(true);
  };

  const handleAddRelationship = () => {
    if (readonly) {
      toast({ title: "View only", description: "You have view access only." });
      return;
    }
    if (members.length < 2) {
      toast({
        title: "Error",
        description: "You need at least 2 members to create a relationship",
        variant: "destructive",
      });
      return;
    }

    setShowAddRelationshipDialog(true);
    setNewRelationship({ type: "parent" });
  };

  const handleSaveRelationship = () => {
    if (
      !newRelationship.fromId ||
      !newRelationship.toId ||
      !newRelationship.type
    ) {
      toast({
        title: "Error",
        description: "Please select both members and relationship type",
        variant: "destructive",
      });
      return;
    }

    addEdge({
      fromId: newRelationship.fromId,
      toId: newRelationship.toId,
      type: newRelationship.type,
    });

    setShowAddRelationshipDialog(false);
    setNewRelationship({});
    setDirty(true);
  };

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  const handleNodeDoubleClick = (nodeId: string) => {
    if (readonly) return;
    setEditingNode(nodeId);
  };

  const handleCanvasClick = () => {
    setSelectedNode(null);
  };

  const handleExport = () => {
    try {
      const canvas = document.querySelector("canvas");
      if (!canvas) {
        toast({
          title: "Error",
          description: "Canvas not found",
          variant: "destructive",
        });
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `family-tree-${new Date().toISOString()}.png`;
      a.click();
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message || "Try again",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!user?.uid) return;
    if (!shareEmail) {
      toast({ title: "Email required", description: "Enter an email." });
      return;
    }
    try {
      const res = await fetch("/api/family-tree/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: user.uid,
          email: shareEmail,
          role: shareRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Share failed");
      toast({
        title: "Shared",
        description: `Granted ${shareRole} to ${shareEmail}`,
      });
      setShareDialogOpen(false);
      setShareEmail("");
      setShareRole("viewer");
    } catch (e: any) {
      toast({
        title: "Share failed",
        description: e?.message || "",
        variant: "destructive",
      });
    }
  };

  const writePresence = async (worldX: number, worldY: number) => {
    const treeOwner = ownerIdParam || user?.uid;
    if (!user?.uid || !treeOwner) return;
    const now = Date.now();
    if (now - lastPresenceWrite < 150) return;
    setLastPresenceWrite(now);
    try {
      await setDoc(
        doc(db, "familyTrees", treeOwner, "presence", user.uid),
        {
          name: user.displayName || "Me",
          color: "#10b981",
          x: worldX,
          y: worldY,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {}
  };

  const handleToggleFullscreen = () => {
    setFullscreen(!isFullscreen);
  };

  const handleAISuggestions = async () => {
    const ownerId = ownerIdParam || user?.uid;
    if (!ownerId) return;
    try {
      const res = await fetch("/api/family-tree/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const list = (data.suggestions || []).slice(0, 10);
      const conflicts = data.conflicts || [];
      const msg =
        (list.length
          ? list
              .map(
                (s: any) => `• (${Math.round(s.confidence * 100)}%) ${s.detail}`
              )
              .join("\n")
          : "No suggestions found") +
        (conflicts.length
          ? "\n\nPotential conflicts:\n" +
            conflicts.map((c: any) => `• ${c.message}`).join("\n")
          : "");
      alert(msg);
    } catch (e: any) {
      toast({
        title: "Suggestions failed",
        description: e?.message || "",
      });
    }
  };

  if (isLoading && !tree) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading family tree...</p>
        </div>
      </div>
    );
  }

  if (error && !tree) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={loadFamilyTree}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full w-full ${
        isFullscreen ? "fixed inset-0 z-50 bg-white" : ""
      }`}
    >
      {/* Show search results if search parameter is present */}
      {searchParam && (
        <div className="p-6">
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/family-tree")}
              className="mb-4"
            >
              ← Back to Family Tree
            </Button>
            <h1 className="text-2xl font-bold">
              Search Results for "{searchParam}"
            </h1>
            <p className="text-muted-foreground">
              Family trees matching your search
            </p>
          </div>
          <FamilyTreeSuggestions />
        </div>
      )}

      {/* Regular family tree interface */}
      {!searchParam && (
        <>
          <div className="flex-none border-b bg-white sticky top-0 z-20">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                {ownerIdParam && ownerIdParam !== user?.uid && (
                  <div className="mr-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
                      Shared from {ownerName || "Owner"}
                    </span>
                    {viewerRole && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs">
                        {viewerRole === "editor" ? "Editor" : "Viewer"}
                      </span>
                    )}
                  </div>
                )}
                <Button
                  onClick={handleAddMember}
                  size="sm"
                  disabled={readonly}
                  className="whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Member
                </Button>
                <Button
                  onClick={handleAddRelationship}
                  variant="outline"
                  size="sm"
                  disabled={readonly}
                  className="whitespace-nowrap"
                >
                  <Heart className="h-4 w-4 mr-1.5" />
                  Add Relationship
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="hidden sm:flex items-center text-xs text-muted-foreground mr-2 min-w-[90px] justify-end">
                  {dirty ? (
                    isSaving ? (
                      <span>Saving…</span>
                    ) : (
                      <span>Unsaved changes</span>
                    )
                  ) : (
                    <span>Saved</span>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={undo}
                    disabled={readonly}
                    className="h-8 px-2"
                    title="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={redo}
                    disabled={readonly}
                    className="h-8 px-2"
                    title="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  className="h-8 px-2 hidden sm:flex"
                  title="Export"
                >
                  <Download className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleFullscreen}
                  className="h-8 px-2 hidden sm:flex"
                  title="Fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAISuggestions}
                  className="h-8 px-2 hidden md:flex"
                  title="AI Suggestions"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>

                {!ownerIdParam && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShareDialogOpen(true)}
                    className="whitespace-nowrap h-8"
                  >
                    Share {shares.length > 0 && `(${shares.length})`}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {(!tree || (tree?.members?.length || 0) === 0) && !ownerIdParam && (
            <div className="flex-none border-b bg-white/60">
              <div className="px-4 py-6">
                {!userProfile?.familyTreeApproved &&
                !userProfile?.familyCode ? (
                  <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-semibold mb-2">
                        Welcome to Family Tree
                      </h2>
                      <p className="text-muted-foreground">
                        To create your own family tree, please submit an
                        application for review
                      </p>
                    </div>

                    {applicationStatus.hasApplication && (
                      <div className="mb-6">
                        {applicationStatus.status === "pending" && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                            <div className="text-yellow-800">
                              <h3 className="font-semibold mb-2">
                                Application Under Review
                              </h3>
                              <p className="text-sm">
                                Your family tree application is being reviewed.
                                You will be notified of the decision within 2-3
                                business days.
                              </p>
                              <p className="text-xs mt-2">
                                Submitted:{" "}
                                {new Date(
                                  applicationStatus.lastApplication?.createdAt
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )}

                        {applicationStatus.status === "denied" && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                            <div className="text-red-800">
                              <h3 className="font-semibold mb-2">
                                Application Denied
                              </h3>
                              <p className="text-sm">
                                {applicationStatus.lastApplication
                                  ?.adminNotes ||
                                  "Your application was not approved at this time."}
                              </p>
                              <p className="text-xs mt-2">
                                You can submit a new application with additional
                                information.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <FamilyTreeApplicationForm />

                    {/* Suggested Family Trees - For Non-Approved Users */}
                    <div className="mt-8 space-y-4">
                      <div>
                        <h2 className="font-headline text-2xl font-bold text-primary">
                          Suggested Family Trees
                        </h2>
                        <p className="text-muted-foreground">
                          Discover interesting family trees you might want to
                          explore once your application is approved.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="border rounded-lg p-6 bg-white text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="font-semibold mb-2">
                            Explore Public Trees
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Browse family trees shared by the community
                          </p>
                          <Button variant="outline" className="w-full" disabled>
                            Coming Soon
                          </Button>
                        </div>

                        <div className="border rounded-lg p-6 bg-white text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="font-semibold mb-2">Search by Name</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Find family trees by searching for specific names
                          </p>
                          <Button variant="outline" className="w-full" disabled>
                            Coming Soon
                          </Button>
                        </div>

                        <div className="border rounded-lg p-6 bg-white text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Globe className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="font-semibold mb-2">Regional Trees</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Explore family trees from your region
                          </p>
                          <Button variant="outline" className="w-full" disabled>
                            Coming Soon
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-semibold mb-2">
                        Welcome to Family Tree
                      </h2>
                      <p className="text-muted-foreground">
                        Start building your family tree or join an existing one
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                      <div className="border rounded-lg p-6 bg-white text-center">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Plus className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-2">
                          Start Your Own Tree
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create your family tree by adding your first member
                        </p>
                        <Button onClick={handleAddMember} className="w-full">
                          Add First Member
                        </Button>
                      </div>

                      <div className="border rounded-lg p-6 bg-white">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="font-semibold mb-2 text-center">
                          Join Existing Tree
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                          Search and request access to an existing family tree
                        </p>
                        <div className="space-y-3">
                          <Input
                            placeholder="Search by family name or owner..."
                            value={joinQuery}
                            onChange={(e) => setJoinQuery(e.target.value)}
                            className="w-full"
                          />
                          {joinLoading && (
                            <div className="text-xs text-muted-foreground text-center">
                              Searching...
                            </div>
                          )}
                          {joinResults.slice(0, 3).map((r) => (
                            <div
                              key={`${r.ownerId}`}
                              className="flex items-center justify-between border rounded p-3 bg-gray-50"
                            >
                              <div>
                                <div className="font-medium text-sm">
                                  {r.headName || "Family Tree"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {r.ownerName} · {r.membersCount} members
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleRequestAccess(r.ownerId, "viewer")
                                  }
                                >
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleRequestAccess(r.ownerId, "editor")
                                  }
                                >
                                  Edit
                                </Button>
                              </div>
                            </div>
                          ))}
                          {!joinLoading &&
                            joinQuery &&
                            joinResults.length === 0 && (
                              <div className="text-xs text-muted-foreground text-center">
                                No trees found matching your search
                              </div>
                            )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 text-center">
                      <Button
                        variant="outline"
                        onClick={() => setShowSuggestions(!showSuggestions)}
                        className="text-sm"
                      >
                        {showSuggestions ? "Hide" : "Show"} Interesting Family
                        Trees
                      </Button>
                      {showSuggestions && (
                        <div className="mt-4">
                          {suggestedLoading ? (
                            <div className="text-sm text-muted-foreground">
                              Loading...
                            </div>
                          ) : suggested.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                              {suggested.map((s) => (
                                <div
                                  key={`${s.ownerId}`}
                                  className="border rounded-md p-3 bg-white"
                                >
                                  <div className="font-semibold">
                                    {s.headName || "Family Tree"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Owner: {s.ownerName} · {s.membersCount}{" "}
                                    members
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleRequestAccess(s.ownerId, "viewer")
                                      }
                                    >
                                      Request View
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleRequestAccess(s.ownerId, "editor")
                                      }
                                    >
                                      Request Edit
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              No suggested trees available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div
            id="tree-viewport"
            className="flex-1 relative overflow-hidden bg-gray-50"
          >
            <div className="absolute top-2 left-2 z-10 bg-black/80 text-white text-xs p-2 rounded">
              Tree: {tree ? "Loaded" : "Not loaded"} | Members:{" "}
              {tree?.members?.length || 0} | Loading: {isLoading ? "Yes" : "No"}{" "}
              | Error: {error || "None"}
            </div>

            {/* Mode Toggle Controls */}
            <div className="absolute top-2 right-2 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Mode:</span>
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsEditMode(true);
                    setShowViewResult(false);
                  }}
                  className="text-xs h-8"
                >
                  ✏️ Edit
                </Button>
                <Button
                  variant={!isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsEditMode(false);
                    setShowViewResult(true);
                  }}
                  className="text-xs h-8"
                >
                  👁️ View Result
                </Button>
              </div>

              {isEditMode && (
                <div className="text-xs text-gray-500 mt-1">
                  💡 Drag nodes • Double-click to edit
                </div>
              )}

              {showViewResult && (
                <div className="text-xs text-green-600 font-medium mt-1">
                  ✨ Auto-arranged view
                </div>
              )}
            </div>

            {tree && tree.members && tree.members.length > 0 ? (
              <TreeCanvas
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onCanvasClick={handleCanvasClick}
                presence={presence}
                className="w-full h-full"
                isEditMode={isEditMode}
                showViewResult={showViewResult}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">
                    No Family Members
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Start building your family tree by adding your first member.
                  </p>
                  <Button onClick={handleAddMember} disabled={readonly}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Member
                  </Button>
                </div>
              </div>
            )}

            <div className="sm:hidden absolute bottom-4 right-4 flex flex-col gap-2">
              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg"
                onClick={handleAddMember}
                disabled={readonly}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            {editingNode && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-gray-900">
                        Edit Family Member
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingNode(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <NodeEditor
                      nodeId={editingNode}
                      onClose={() => setEditingNode(null)}
                      onSave={(member) => {
                        setEditingNode(null);
                        setTimeout(saveFamilyTree, 500);
                      }}
                      onDelete={(nodeId) => {
                        removeMember(nodeId);
                        setTimeout(saveFamilyTree, 500);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Dialog
            open={showAddMemberDialog}
            onOpenChange={setShowAddMemberDialog}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Family Member</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={newMember.firstName || ""}
                      onChange={(e) =>
                        setNewMember((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }))
                      }
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={newMember.lastName || ""}
                      onChange={(e) =>
                        setNewMember((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }))
                      }
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="birthDate">Birth Date</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={newMember.birthDate || ""}
                      onChange={(e) =>
                        setNewMember((prev) => ({
                          ...prev,
                          birthDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={newMember.gender || ""}
                      onValueChange={(value) =>
                        setNewMember((prev) => ({
                          ...prev,
                          gender: value as any,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newMember.location || ""}
                    onChange={(e) =>
                      setNewMember((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    placeholder="Birth place, residence, etc."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveMember} className="flex-1">
                    Add Member
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddMemberDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={showAddRelationshipDialog}
            onOpenChange={setShowAddRelationshipDialog}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Relationship</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="fromMember">From Member</Label>
                  <Select
                    value={newRelationship.fromId || ""}
                    onValueChange={(value) =>
                      setNewRelationship((prev) => ({ ...prev, fromId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select first member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="relationshipType">Relationship Type</Label>
                  <Select
                    value={newRelationship.type || ""}
                    onValueChange={(value) =>
                      setNewRelationship((prev) => ({
                        ...prev,
                        type: value as any,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="adoptive">Adoptive</SelectItem>
                      <SelectItem value="step">Step</SelectItem>
                      <SelectItem value="big_sister">Big Sister</SelectItem>
                      <SelectItem value="little_sister">
                        Little Sister
                      </SelectItem>
                      <SelectItem value="big_brother">Big Brother</SelectItem>
                      <SelectItem value="little_brother">
                        Little Brother
                      </SelectItem>
                      <SelectItem value="aunt">Aunt</SelectItem>
                      <SelectItem value="uncle">Uncle</SelectItem>
                      <SelectItem value="cousin_big">Cousin (Older)</SelectItem>
                      <SelectItem value="cousin_little">
                        Cousin (Younger)
                      </SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="toMember">To Member</Label>
                  <Select
                    value={newRelationship.toId || ""}
                    onValueChange={(value) =>
                      setNewRelationship((prev) => ({ ...prev, toId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select second member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {suggestion && (
                  <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded">
                    {suggestion}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveRelationship} className="flex-1">
                    Add Relationship
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddRelationshipDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Share Family Tree</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {shares.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">
                      Currently shared with
                    </Label>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {shares.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-gray-50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {shareNames[s.targetUserId] ||
                                s.targetEmail ||
                                s.targetUserId}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.role}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Select
                              value={s.role}
                              onValueChange={async (v) => {
                                try {
                                  await fetch("/api/family-tree/share", {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      ownerId: user?.uid,
                                      targetUserId: s.targetUserId,
                                      role: v,
                                    }),
                                  });
                                  setShares((prev) =>
                                    prev.map((p) =>
                                      p.id === s.id ? { ...p, role: v } : p
                                    )
                                  );
                                } catch {}
                              }}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={async () => {
                                try {
                                  await fetch(
                                    `/api/family-tree/share?ownerId=${user?.uid}&targetUserId=${s.targetUserId}`,
                                    {
                                      method: "DELETE",
                                    }
                                  );
                                  setShares((prev) =>
                                    prev.filter((p) => p.id !== s.id)
                                  );
                                } catch {}
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">
                    Share with new person
                  </Label>
                  <div className="mt-2 space-y-3">
                    <div>
                      <Label htmlFor="shareEmail" className="text-xs">
                        Email
                      </Label>
                      <Input
                        id="shareEmail"
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="friend@example.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="shareRole" className="text-xs">
                        Permission
                      </Label>
                      <Select
                        value={shareRole}
                        onValueChange={(v) => setShareRole(v as any)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">
                            Viewer (read-only)
                          </SelectItem>
                          <SelectItem value="editor">
                            Editor (can edit)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleShare} className="flex-1">
                    Share
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShareDialogOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
