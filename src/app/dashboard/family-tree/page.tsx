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

export default function FamilyTreePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ownerIdParam = searchParams?.get("ownerId") || undefined;
  const {
    tree,
    members,
    edges,
    selectedNode,
    editingNode,
    isFullscreen,
    isLoading,
    error,
    setTree,
    addMember,
    addEdge,
    removeMember,
    setSelectedNode,
    setEditingNode,
    setFullscreen,
    setLoading,
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

  // Load family tree on mount
  useEffect(() => {
    if (user?.uid) {
      loadFamilyTree();
    }
  }, [user?.uid, ownerIdParam]);

  // Lightweight polling to reflect remote edits in near real-time, including shared trees
  useEffect(() => {
    if (!user?.uid) return;
    const interval = setInterval(() => {
      if (!dirty && !isLoading) {
        loadFamilyTree();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user?.uid, ownerIdParam, dirty, isLoading]);

  const loadFamilyTree = async () => {
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
      } else {
        setReadonly(false);
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
                  const snap = await (
                    await import("firebase/firestore")
                  ).getDoc(
                    (
                      await import("firebase/firestore")
                    ).doc(db, "users", s.targetUserId)
                  );
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
      setLoading(true);

      const targetOwner = ownerIdParam || user.uid;
      const response = await fetch("/api/family-tree", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: targetOwner,
          tree,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save family tree");
      }

      toast({
        title: "Success",
        description: "Family tree saved successfully",
      });
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dirty || readonly) return;
    const t = setTimeout(() => {
      saveFamilyTree();
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, readonly]);

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
    setNewRelationship({
      type: "parent",
    });
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

  const [suggestion, setSuggestion] = useState<string | null>(null);
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

  const [lastPresenceWrite, setLastPresenceWrite] = useState<number>(0);
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

  const handleOpenSettings = () => {
    toast({
      title: "Settings",
      description: "Settings panel coming soon",
    });
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
      {/* Fixed Toolbar Header */}
      <div className="flex-none border-b bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {/* Left section - Main actions */}
          <div className="flex items-center gap-2 flex-wrap">
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

          {/* Right section - Tools */}
          <div className="flex items-center gap-2 flex-wrap">
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

      {/* Canvas Container */}
      <div
        id="tree-viewport"
        className="flex-1 relative overflow-hidden bg-gray-50"
      >
        <TreeCanvas
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onCanvasClick={handleCanvasClick}
          presence={presence}
          className="w-full h-full"
        />

        {/* Mobile Floating Action Button */}
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

        {/* Node Editor Sidebar */}
        {editingNode && (
          <div className="absolute top-4 right-4 z-30 max-w-sm w-full sm:w-96">
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
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
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
                    setNewMember((prev) => ({ ...prev, gender: value as any }))
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

      {/* Add Relationship Dialog */}
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
                  <SelectItem value="little_sister">Little Sister</SelectItem>
                  <SelectItem value="big_brother">Big Brother</SelectItem>
                  <SelectItem value="little_brother">Little Brother</SelectItem>
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

      {/* Share Dialog */}
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
                                headers: { "Content-Type": "application/json" },
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
                                { method: "DELETE" }
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
                      <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                      <SelectItem value="editor">Editor (can edit)</SelectItem>
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
    </div>
  );
}
