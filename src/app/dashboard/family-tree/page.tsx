"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FamilyTree,
  FamilyTreeMember,
  FamilyTreeEdge,
  FamilyRelation,
} from "@/types/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
import React from "react";

const DEFAULT_NODE = { x: 100, y: 100 };
const RELATIONS: (
  | FamilyRelation
  | "father"
  | "mother"
  | "aunt"
  | "uncle"
  | "niece"
  | "nephew"
  | "step-parent"
  | "step-child"
  | "guardian"
  | "other"
)[] = [
  "father",
  "mother",
  "parent",
  "child",
  "sibling",
  "spouse",
  "grandparent",
  "grandchild",
  "aunt",
  "uncle",
  "niece",
  "nephew",
  "cousin",
  "step-parent",
  "step-child",
  "guardian",
  "other",
];

function sanitize<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => sanitize(v)) as any;
  if (value && typeof value === "object") {
    const out: any = {};
    Object.entries(value as any).forEach(([k, v]) => {
      if (v === undefined) return;
      out[k] = sanitize(v as any);
    });
    return out;
  }
  return value;
}

export default function FamilyTreePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [relation, setRelation] = useState<FamilyRelation>("parent");
  const [customRelation, setCustomRelation] = useState("");

  // Zoom / Pan
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // Dragging Nodes
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);

  // Board prefs
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMarquee, setIsMarquee] = useState(false);
  const marqueeRef = useRef<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Add Relative Modal
  const [openAdd, setOpenAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBirthPlace, setAddBirthPlace] = useState("");
  const [addPhotoUrl, setAddPhotoUrl] = useState("");
  const [addRelation, setAddRelation] = useState<
    | FamilyRelation
    | "father"
    | "mother"
    | "aunt"
    | "uncle"
    | "niece"
    | "nephew"
    | "step-parent"
    | "step-child"
    | "guardian"
    | "other"
  >("child");
  const [addCustomRelation, setAddCustomRelation] = useState("");
  const [addLinkTo, setAddLinkTo] = useState<string>("");

  // Edit Member Modal
  const [openEdit, setOpenEdit] = useState(false);
  const [editMember, setEditMember] = useState<FamilyTreeMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editBirthPlace, setEditBirthPlace] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "familyTrees", user.uid);
    let unsub: any;
    (async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const init: FamilyTree = {
          ownerUserId: user.uid,
          members: [],
          edges: [],
          updatedAt: new Date().toISOString(),
        };
        await setDoc(ref, sanitize(init), { merge: true });
        setTree(init);
        setLastSaved(init.updatedAt);
      }
      unsub = onSnapshot(ref, (s) => {
        if (s.exists()) {
          const data = s.data() as FamilyTree;
          setTree(data);
          setLastSaved(data.updatedAt);
        }
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  const members = useMemo(() => tree?.members ?? [], [tree]);

  function memberById(id: string | undefined) {
    return members.find((m) => m.id === id);
  }

  function Minimap({
    members,
    scale,
    offset,
    onNavigate,
  }: {
    members: FamilyTreeMember[];
    scale: number;
    offset: { x: number; y: number };
    onNavigate: (next: { x: number; y: number }) => void;
  }) {
    const width = 180;
    const height = 120;
    // Compute bounds
    const xs = members.map((m) => m.x ?? DEFAULT_NODE.x);
    const ys = members.map((m) => m.y ?? DEFAULT_NODE.y);
    const minX = xs.length ? Math.min(...xs) : 0;
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxX = xs.length ? Math.max(...xs) + 220 : 220;
    const maxY = ys.length ? Math.max(...ys) + 100 : 100;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const sx = width / contentW;
    const sy = height / contentH;
    const s = Math.min(sx, sy);

    function handleClick(e: React.MouseEvent) {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const worldX = cx / s + minX;
      const worldY = cy / s + minY;
      // Rough center the viewport to clicked point
      const viewport = document.querySelector(
        "#tree-viewport"
      ) as HTMLElement | null;
      const vw = viewport?.clientWidth ?? 800;
      const vh = viewport?.clientHeight ?? 600;
      const nextX = vw / 2 - worldX * scale;
      const nextY = vh / 2 - worldY * scale;
      onNavigate({ x: nextX, y: nextY });
    }

    return (
      <div
        className="absolute bottom-3 right-3 rounded-md border bg-card/80 backdrop-blur p-2 shadow"
        style={{ width, height }}
        onClick={handleClick}
      >
        <div className="relative w-full h-full bg-background/60">
          {members.map((m) => {
            const x = ((m.x ?? DEFAULT_NODE.x) - minX) * s;
            const y = ((m.y ?? DEFAULT_NODE.y) - minY) * s;
            return (
              <div
                key={m.id}
                className="absolute bg-primary/70"
                style={{ left: x, top: y, width: 6, height: 4 }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  function assignIfMissingPosition(
    member: FamilyTreeMember,
    index: number
  ): FamilyTreeMember {
    if (typeof member.x === "number" && typeof member.y === "number")
      return member;
    const gridX = 120 + (index % 5) * 220;
    const gridY = 120 + Math.floor(index / 5) * 160;
    return { ...member, x: gridX, y: gridY };
  }

  async function persistTree(next: FamilyTree, showToast = false) {
    if (!user) return;
    try {
      const updatedAt = new Date().toISOString();
      const payload = sanitize({ ...next, updatedAt });
      await setDoc(doc(db, "familyTrees", user.uid), payload, { merge: true });
      setLastSaved(updatedAt);
      if (showToast)
        toast({ title: "Saved", description: "Family tree updated." });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Try again",
        variant: "destructive",
      });
    }
  }

  function onNodeMouseDown(e: React.MouseEvent, id: string) {
    if (!tree) return;
    const m = memberById(id);
    if (!m) return;
    if (e.shiftKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else if (!selectedIds.includes(id)) {
      setSelectedIds([id]);
    }
    setDragId(id);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      nodeX: m.x ?? DEFAULT_NODE.x,
      nodeY: m.y ?? DEFAULT_NODE.y,
    };
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (!dragId || !tree || !dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / scale;
    const dy = (e.clientY - dragRef.current.startY) / scale;
    const movingIds = new Set(selectedIds.length ? selectedIds : [dragId]);
    const nextMembers = tree.members.map((m) => {
      if (!movingIds.has(m.id)) return m;
      const baseX =
        m.id === dragId ? dragRef.current!.nodeX : m.x ?? DEFAULT_NODE.x;
      const baseY =
        m.id === dragId ? dragRef.current!.nodeY : m.y ?? DEFAULT_NODE.y;
      return {
        ...m,
        x: Math.round(baseX + dx),
        y: Math.round(baseY + dy),
      };
    });
    setTree({ ...tree, members: nextMembers });
  }

  async function onCanvasMouseUp() {
    if (!dragId || !tree) return;
    let next = tree;
    if (snapToGrid) {
      const size = 20;
      const movingIds = new Set(selectedIds.length ? selectedIds : [dragId]);
      const nextMembers = tree.members.map((m) =>
        movingIds.has(m.id)
          ? {
              ...m,
              x: Math.round((m.x ?? 0) / size) * size,
              y: Math.round((m.y ?? 0) / size) * size,
            }
          : m
      );
      next = { ...tree, members: nextMembers };
      setTree(next);
    }
    const moved = dragId;
    setDragId(null);
    dragRef.current = null;
    await persistTree(next);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setScale((s) => Math.max(0.3, Math.min(2, s * factor)));
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).dataset["nodetype"]) return;
    if (e.shiftKey) {
      setIsMarquee(true);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / scale;
      const y = (e.clientY - rect.top - offset.y) / scale;
      marqueeRef.current = { startX: x, startY: y, x, y, w: 0, h: 0 };
    } else {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: offset.x,
        originY: offset.y,
      };
    }
  }
  function onCanvasPanMove(e: React.MouseEvent) {
    if (isMarquee && marqueeRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / scale;
      const y = (e.clientY - rect.top - offset.y) / scale;
      const m = marqueeRef.current;
      m.w = x - m.startX;
      m.h = y - m.startY;
      m.x = Math.min(m.startX, x);
      m.y = Math.min(m.startY, y);
      marqueeRef.current = { ...m };
      if (tree) {
        const ids = tree.members
          .filter((mm) => {
            const mx = mm.x ?? DEFAULT_NODE.x;
            const my = mm.y ?? DEFAULT_NODE.y;
            const w = 220,
              h = 80;
            return (
              mx + w >= m.x &&
              mx <= m.x + Math.abs(m.w) &&
              my + h >= m.y &&
              my <= m.y + Math.abs(m.h)
            );
          })
          .map((mm) => mm.id);
        setSelectedIds(ids);
      }
      return;
    }
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setOffset({
      x: panRef.current.originX + dx,
      y: panRef.current.originY + dy,
    });
  }
  function onCanvasPanUp() {
    panRef.current = null;
    if (isMarquee) {
      setIsMarquee(false);
      marqueeRef.current = null;
    }
  }

  function fitToContent() {
    if (!tree || members.length === 0) return;
    const xs = members.map((m) => m.x ?? DEFAULT_NODE.x);
    const ys = members.map((m) => m.y ?? DEFAULT_NODE.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs) + 200;
    const minY = Math.min(...ys),
      maxY = Math.max(...ys) + 80;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const viewportW =
      (document.querySelector("#tree-viewport") as HTMLElement)?.clientWidth ??
      800;
    const viewportH =
      (document.querySelector("#tree-viewport") as HTMLElement)?.clientHeight ??
      600;
    const s = Math.max(
      0.3,
      Math.min(2, Math.min(viewportW / contentW, viewportH / contentH))
    );
    setScale(s);
    setOffset({
      x: (viewportW - contentW * s) / 2 - minX * s,
      y: (viewportH - contentH * s) / 2 - minY * s,
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!tree) return;
      if (e.key === "Escape") {
        setSelectedIds([]);
      }
      if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedIds(tree.members.map((m) => m.id));
      }
      if (["Delete", "Backspace"].includes(e.key)) {
        if (selectedIds.length) {
          const nextMembers = tree.members.filter(
            (m) => !selectedIds.includes(m.id)
          );
          const nextEdges = tree.edges.filter(
            (ed) =>
              !selectedIds.includes(ed.fromId) && !selectedIds.includes(ed.toId)
          );
          const next = {
            ...tree,
            members: nextMembers,
            edges: nextEdges,
          } as FamilyTree;
          setTree(next);
          persistTree(next, true);
          setSelectedIds([]);
        }
      }
      const nudge = (dx: number, dy: number) => {
        if (!selectedIds.length) return;
        const size = snapToGrid ? 20 : 1;
        const nextMembers = tree.members.map((m) =>
          selectedIds.includes(m.id)
            ? { ...m, x: (m.x ?? 0) + dx * size, y: (m.y ?? 0) + dy * size }
            : m
        );
        const next = { ...tree, members: nextMembers } as FamilyTree;
        setTree(next);
        persistTree(next);
      };
      if (e.key === "ArrowLeft") nudge(-1, 0);
      if (e.key === "ArrowRight") nudge(1, 0);
      if (e.key === "ArrowUp") nudge(0, -1);
      if (e.key === "ArrowDown") nudge(0, 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tree, selectedIds, snapToGrid]);

  function resetPositions() {
    if (!tree) return;
    const nextMembers = tree.members.map((m, i) =>
      assignIfMissingPosition({ ...m, x: undefined, y: undefined } as any, i)
    );
    const next = { ...tree, members: nextMembers } as FamilyTree;
    setTree(next);
    persistTree(next, true);
  }

  function relationToPlacement(rel: string) {
    switch (rel) {
      case "father":
      case "mother":
      case "parent":
        return { dx: 0, dy: -140 };
      case "child":
        return { dx: 0, dy: 140 };
      case "spouse":
        return { dx: 220, dy: 0 };
      case "grandparent":
        return { dx: 0, dy: -280 };
      case "grandchild":
        return { dx: 0, dy: 280 };
      default:
        return { dx: 220, dy: 0 };
    }
  }

  async function autoArrange() {
    if (!tree || members.length === 0) return;
    const parentsOf = new Map<string, string[]>();
    const childrenOf = new Map<string, string[]>();
    const sameLevel = new Map<string, string[]>();
    for (const e of tree.edges) {
      if (e.relation === "parent") {
        const parent = e.fromId,
          child = e.toId;
        parentsOf.set(child, [...(parentsOf.get(child) ?? []), parent]);
        childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child]);
      } else if (e.relation === "child") {
        const parent = e.toId,
          child = e.fromId;
        parentsOf.set(child, [...(parentsOf.get(child) ?? []), parent]);
        childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child]);
      } else if (e.relation === "spouse" || e.relation === "sibling") {
        sameLevel.set(e.fromId, [...(sameLevel.get(e.fromId) ?? []), e.toId]);
        sameLevel.set(e.toId, [...(sameLevel.get(e.toId) ?? []), e.fromId]);
      }
    }
    const anchor = members[0].id;
    const level = new Map<string, number>();
    level.set(anchor, 0);
    const queue: string[] = [anchor];
    while (queue.length) {
      const cur = queue.shift()!;
      const curLevel = level.get(cur)!;
      for (const p of parentsOf.get(cur) ?? []) {
        if (!level.has(p)) {
          level.set(p, curLevel - 1);
          queue.push(p);
        }
      }
      for (const c of childrenOf.get(cur) ?? []) {
        if (!level.has(c)) {
          level.set(c, curLevel + 1);
          queue.push(c);
        }
      }
      for (const s of sameLevel.get(cur) ?? []) {
        if (!level.has(s)) {
          level.set(s, curLevel);
          queue.push(s);
        }
      }
    }
    for (const m of members) if (!level.has(m.id)) level.set(m.id, 0);
    const byRow = new Map<number, FamilyTreeMember[]>();
    for (const m of members) {
      const row = level.get(m.id) ?? 0;
      byRow.set(row, [...(byRow.get(row) ?? []), m]);
    }
    const spacingX = 240,
      spacingY = 160;
    const rows = Array.from(byRow.keys()).sort((a, b) => a - b);
    const minRow = rows[0] ?? 0;
    const nextMembers = members.map((m) => {
      const row = (level.get(m.id) ?? 0) - minRow;
      const idx = (byRow.get(level.get(m.id) ?? 0) ?? []).findIndex(
        (x) => x.id === m.id
      );
      return {
        ...m,
        x: 120 + idx * spacingX,
        y: 120 + row * spacingY,
      } as FamilyTreeMember;
    });
    const next = { ...tree, members: nextMembers } as FamilyTree;
    setTree(next);
    await persistTree(next, true);
    fitToContent();
  }

  async function saveAddRelative() {
    if (!user || !tree || !addName.trim()) return;
    const hasAnchor = !!addLinkTo && members.length > 0;
    const anchor = hasAnchor ? memberById(addLinkTo) : undefined;
    const place = relationToPlacement(addRelation);
    const baseMember: FamilyTreeMember = {
      id: uuidv4(),
      fullName: addName.trim(),
      birthPlace: addBirthPlace || undefined,
      photoUrl: addPhotoUrl || undefined,
      x: (anchor?.x ?? DEFAULT_NODE.x) + (hasAnchor ? place.dx : 0),
      y: (anchor?.y ?? DEFAULT_NODE.y) + (hasAnchor ? place.dy : 0),
    };
    // Assign default gender as undefined; users can edit later. Gender remains restricted elsewhere.

    const relType: string =
      addRelation === "other" ? customRelation || "relative" : addRelation;
    const toParent = ["father", "mother", "parent"].includes(relType);

    let next: FamilyTree;
    if (hasAnchor) {
      const edge: FamilyTreeEdge = {
        fromId: toParent ? baseMember.id : addLinkTo!,
        toId: toParent ? addLinkTo! : baseMember.id,
        relation: toParent ? "parent" : (relType as FamilyRelation),
      } as FamilyTreeEdge;
      next = {
        ...tree,
        members: [...tree.members, baseMember],
        edges: [...tree.edges, edge],
        updatedAt: new Date().toISOString(),
      };
    } else {
      // First person: just create the member without an edge
      next = {
        ...tree,
        members: [...tree.members, baseMember],
        updatedAt: new Date().toISOString(),
      } as FamilyTree;
    }

    setOpenAdd(false);
    setAddName("");
    setAddBirthPlace("");
    setAddPhotoUrl("");
    setCustomRelation("");
    setTree(next);
    await persistTree(next, true);
  }

  // Edit / Delete / Unlink
  function openEditMember(m: FamilyTreeMember) {
    setEditMember(m);
    setEditName(m.fullName);
    setEditBirthPlace(m.birthPlace ?? "");
    setEditPhotoUrl(m.photoUrl ?? "");
    setOpenEdit(true);
  }
  async function saveEditMember() {
    if (!tree || !editMember) return;
    const nextMembers = tree.members.map((m) =>
      m.id === editMember.id
        ? {
            ...m,
            fullName: editName.trim() || m.fullName,
            birthPlace: editBirthPlace || undefined,
            photoUrl: editPhotoUrl || undefined,
          }
        : m
    );
    const next = { ...tree, members: nextMembers } as FamilyTree;
    setOpenEdit(false);
    setTree(next);
    await persistTree(next, true);
  }
  async function deleteMember(id: string) {
    if (!tree) return;
    const nextMembers = tree.members.filter((m) => m.id !== id);
    const nextEdges = tree.edges.filter(
      (e) => e.fromId !== id && e.toId !== id
    );
    const next = {
      ...tree,
      members: nextMembers,
      edges: nextEdges,
    } as FamilyTree;
    setTree(next);
    await persistTree(next, true);
  }
  async function unlinkEdge(a: string, b: string, rel: FamilyRelation) {
    if (!tree) return;
    const nextEdges = tree.edges.filter(
      (e) => !(e.fromId === a && e.toId === b && e.relation === rel)
    );
    const next = { ...tree, edges: nextEdges } as FamilyTree;
    setTree(next);
    await persistTree(next, true);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
            Family Tree
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Drag people around, add relatives, and link relationships. Changes
            save automatically.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {lastSaved
            ? `Last saved: ${new Date(lastSaved).toLocaleString()}`
            : ""}
        </div>
        {/* Minimap overlay */}
        <Minimap
          members={members}
          scale={scale}
          offset={offset}
          onNavigate={(next) => setOffset(next)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">
            Board Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Button variant="outline" onClick={() => setScale(1)}>
            Reset Zoom
          </Button>
          <Button
            variant="outline"
            onClick={() => setScale((s) => Math.min(2, s * 1.1))}
          >
            Zoom In
          </Button>
          <Button
            variant="outline"
            onClick={() => setScale((s) => Math.max(0.3, s / 1.1))}
          >
            Zoom Out
          </Button>
          <Button variant="outline" onClick={fitToContent}>
            Fit to Content
          </Button>
          <Button variant="outline" onClick={resetPositions}>
            Reset Positions
          </Button>
          <Button variant="outline" onClick={() => setShowGrid((v) => !v)}>
            {showGrid ? "Hide Grid" : "Show Grid"}
          </Button>
          <Button variant="outline" onClick={() => setSnapToGrid((v) => !v)}>
            {snapToGrid ? "Snap: On" : "Snap: Off"}
          </Button>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button>Add Relative</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Relative</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Relation</Label>
                    <Select
                      value={addRelation}
                      onValueChange={(v) => setAddRelation(v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relation" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {members.length > 0 ? (
                    <div>
                      <Label>Link To</Label>
                      <Select value={addLinkTo} onValueChange={setAddLinkTo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label>First person</Label>
                      <div className="text-xs text-muted-foreground mt-2">
                        This will create your first person in the tree. You can
                        link relatives later.
                      </div>
                    </div>
                  )}
                </div>
                {addRelation === "other" && (
                  <div>
                    <Label>Custom Relation</Label>
                    <Input
                      value={customRelation}
                      onChange={(e) => setCustomRelation(e.target.value)}
                      placeholder="e.g., great-grandmother"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Birth Place (optional)</Label>
                    <Input
                      value={addBirthPlace}
                      onChange={(e) => setAddBirthPlace(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Photo URL (optional)</Label>
                    <Input
                      value={addPhotoUrl}
                      onChange={(e) => setAddPhotoUrl(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveAddRelative}>Save Relative</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div
        id="tree-viewport"
        className="relative h-[70vh] w-full border rounded-md overflow-hidden bg-background"
        onWheel={onWheel}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={(e) => {
          onCanvasPanMove(e);
          onCanvasMouseMove(e);
        }}
        onMouseUp={() => {
          onCanvasPanUp();
          onCanvasMouseUp();
        }}
        onMouseLeave={() => {
          onCanvasPanUp();
          onCanvasMouseUp();
        }}
        style={
          showGrid
            ? {
                backgroundImage: `linear-gradient(to right, hsl(var(--muted-foreground)/.12) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--muted-foreground)/.12) 1px, transparent 1px)`,
                backgroundSize: `20px 20px`,
              }
            : undefined
        }
      >
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {(tree?.edges ?? []).map((e, idx) => {
              const a = assignIfMissingPosition(
                memberById(e.fromId) as any,
                idx
              );
              const b = assignIfMissingPosition(
                memberById(e.toId) as any,
                idx + 1
              );
              if (!a || !b) return null;
              const x1 = (a.x ?? DEFAULT_NODE.x) + 100;
              const y1 = (a.y ?? DEFAULT_NODE.y) + 40;
              const x2 = (b.x ?? DEFAULT_NODE.x) + 100;
              const y2 = (b.y ?? DEFAULT_NODE.y) + 40;
              const style =
                e.relation === "spouse"
                  ? { strokeDasharray: "6,4" }
                  : e.relation === "cousin"
                  ? { strokeDasharray: "3,3" }
                  : {};
              return (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  {...style}
                />
              );
            })}
          </svg>

          {(members ?? []).map((m, i) => {
            const mm = assignIfMissingPosition(m, i);
            const x = mm.x ?? DEFAULT_NODE.x;
            const y = mm.y ?? DEFAULT_NODE.y;
            return (
              <div
                key={mm.id}
                data-nodetype="person"
                className={`absolute w-[220px] select-none ${
                  selectedIds.includes(mm.id) ? "ring-2 ring-primary" : ""
                }`}
                style={{ transform: `translate(${x}px, ${y}px)` }}
                onMouseDown={(e) => onNodeMouseDown(e, mm.id)}
                onDoubleClick={() => openEditMember(mm)}
              >
                <div className="rounded-lg border bg-card shadow-sm p-3 relative">
                  <div className="absolute right-2 top-2 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Edit"
                      onClick={() => openEditMember(mm)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete"
                      onClick={() => deleteMember(mm.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        mm.photoUrl || `https://picsum.photos/seed/${mm.id}/80`
                      }
                      alt={mm.fullName}
                      className="h-12 w-12 rounded-full object-cover border"
                    />
                    <div>
                      <div className="font-medium leading-tight">
                        {mm.fullName}
                      </div>
                      {mm.birthPlace && (
                        <div className="text-xs text-muted-foreground">
                          {mm.birthPlace}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isMarquee && marqueeRef.current && (
            <div
              className="absolute border-2 border-primary/50 bg-primary/10 pointer-events-none"
              style={{
                left: marqueeRef.current.x,
                top: marqueeRef.current.y,
                width: Math.abs(marqueeRef.current.w),
                height: Math.abs(marqueeRef.current.h),
              }}
            />
          )}
        </div>
        {/* Minimap overlay */}
        <Minimap
          members={members}
          scale={scale}
          offset={offset}
          onNavigate={(next) => setOffset(next)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">
            Quick Link / Unlink Relationship
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Select onValueChange={setFromId} value={fromId}>
            <SelectTrigger>
              <SelectValue placeholder="From member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(v) => setRelation(v as FamilyRelation)}
            value={relation}
          >
            <SelectTrigger>
              <SelectValue placeholder="Relation" />
            </SelectTrigger>
            <SelectContent>
              {[
                "parent",
                "child",
                "sibling",
                "spouse",
                "grandparent",
                "grandchild",
                "cousin",
              ].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setToId} value={toId}>
            <SelectTrigger>
              <SelectValue placeholder="To member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={async () => {
              if (!user || !tree || !fromId || !toId || fromId === toId) return;
              const edge: FamilyTreeEdge = { fromId, toId, relation };
              const dedup = tree.edges.filter(
                (e) =>
                  !(
                    e.fromId === fromId &&
                    e.toId === toId &&
                    e.relation === relation
                  )
              );
              const updated: FamilyTree = {
                ...tree,
                edges: [...dedup, edge],
                updatedAt: new Date().toISOString(),
              };
              setTree(updated);
              await persistTree(updated, true);
            }}
          >
            Link
          </Button>
          <Button
            variant="outline"
            onClick={() => unlinkEdge(fromId, toId, relation)}
          >
            Unlink
          </Button>
        </CardContent>
      </Card>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Birth Place</Label>
                <Input
                  value={editBirthPlace}
                  onChange={(e) => setEditBirthPlace(e.target.value)}
                />
              </div>
              <div>
                <Label>Photo URL</Label>
                <Input
                  value={editPhotoUrl}
                  onChange={(e) => setEditPhotoUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenEdit(false)}>
                Cancel
              </Button>
              <Button onClick={saveEditMember}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
