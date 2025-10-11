"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  useFamilyTreeStore,
  selectMembers,
  selectEdges,
  selectLayout,
  selectCanvasState,
} from "@/lib/family-tree-store";
import {
  FamilyMember,
  FamilyEdge,
  CanvasState,
  RenderOptions,
} from "@/types/family-tree";
import { cn } from "@/lib/utils";

interface TreeCanvasProps {
  className?: string;
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onCanvasClick?: () => void;
  presence?: Array<{
    id: string;
    name?: string;
    color?: string;
    x?: number;
    y?: number;
  }>;
  isEditMode?: boolean;
  showViewResult?: boolean;
}

export function TreeCanvas({
  className,
  onNodeClick,
  onNodeDoubleClick,
  onCanvasClick,
  presence,
  isEditMode = true,
  showViewResult = false,
}: TreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });
  const [nodeOffsets, setNodeOffsets] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);

  const members = useFamilyTreeStore(selectMembers);
  const edges = useFamilyTreeStore(selectEdges);
  const layout = useFamilyTreeStore(selectLayout);
  const canvasState = useFamilyTreeStore(selectCanvasState);
  const {
    setLayout,
    updateCanvasState,
    setSelectedNode,
    setEditingNode,
    renderOptions,
    updateMember,
  } = useFamilyTreeStore();

  // ===== Build edit mode layout (preserves manual positions)
  const buildEditModeLayout = () => {
    const nodeWidth = 200;
    const nodeHeight = 100;

    // Safety check for empty members
    if (!members || members.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodes: any[] = [];

    // Create nodes with manual positions or default positions
    members.forEach((member) => {
      const x = member.x !== undefined ? member.x : 100 + nodes.length * 250;
      const y =
        member.y !== undefined
          ? member.y
          : 100 + Math.floor(nodes.length / 4) * 150;

      nodes.push({
        id: member.id,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        generation: 0,
        member,
      });
    });

    const nodeById: Record<string, any> = Object.fromEntries(
      nodes.map((n) => [n.id, n])
    );

    const edgePaths = (edges || []).map((e) => {
      const a = nodeById[e.fromId];
      const b = nodeById[e.toId];
      if (!a || !b)
        return {
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          path: "",
          type: e.type,
        };

      const fromX = a.x + a.width / 2;
      const fromY = a.y + a.height / 2;
      const toX = b.x + b.width / 2;
      const toY = b.y + b.height / 2;

      return {
        id: e.id,
        fromId: e.fromId,
        toId: e.toId,
        path: `M ${fromX} ${fromY} L ${toX} ${toY}`,
        type: e.type,
      };
    });

    return { nodes, edges: edgePaths };
  };

  // ===== Build hierarchical layout like the reference image
  const buildHierarchicalLayout = () => {
    const nodeWidth = 200;
    const nodeHeight = 80;
    const horizontalSpacing = 250;
    const verticalSpacing = 150;

    // Safety check for empty members
    if (!members || members.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Find the focal person (head of family or first member)
    const focalPerson = members.find((m) => m.isHeadOfFamily) || members[0];
    if (!focalPerson) return { nodes: [], edges: [] };

    const nodes: any[] = [];
    const visited = new Set<string>();

    // Position focal person in center
    const centerX = canvasState.width / 2;
    const centerY = canvasState.height / 2;

    const addNode = (member: any, x: number, y: number, generation: number) => {
      if (visited.has(member.id)) return;
      visited.add(member.id);

      nodes.push({
        id: member.id,
        x: x - nodeWidth / 2,
        y: y - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
        generation,
        member,
      });
    };

    // Start with focal person
    addNode(focalPerson, centerX, centerY, 0);

    // Build family tree hierarchically
    const buildFamily = (
      member: any,
      centerX: number,
      centerY: number,
      generation: number
    ) => {
      // Find parents
      const parents = (edges || [])
        .filter((e) => e.toId === member.id && e.type === "parent")
        .map((e) => members.find((m) => m.id === e.fromId))
        .filter(Boolean);

      // Find children
      const children = (edges || [])
        .filter((e) => e.fromId === member.id && e.type === "parent")
        .map((e) => members.find((m) => m.id === e.toId))
        .filter(Boolean);

      // Position parents above
      if (parents.length > 0) {
        const parentY = centerY - verticalSpacing;
        const startX = centerX - ((parents.length - 1) * horizontalSpacing) / 2;

        parents.forEach((parent, i) => {
          if (parent && !visited.has(parent.id)) {
            const parentX = startX + i * horizontalSpacing;
            addNode(
              parent,
              parentX - nodeWidth / 2,
              parentY - nodeHeight / 2,
              generation - 1
            );
            buildFamily(parent, parentX, parentY, generation - 1);
          }
        });
      }

      // Position children below
      if (children.length > 0) {
        const childY = centerY + verticalSpacing;
        const startX =
          centerX - ((children.length - 1) * horizontalSpacing) / 2;

        children.forEach((child, i) => {
          if (child && !visited.has(child.id)) {
            const childX = startX + i * horizontalSpacing;
            addNode(
              child,
              childX - nodeWidth / 2,
              childY - nodeHeight / 2,
              generation + 1
            );
            buildFamily(child, childX, childY, generation + 1);
          }
        });
      }
    };

    buildFamily(focalPerson, centerX, centerY, 0);

    // Add any remaining members (spouses, etc.) in a grid
    (members || []).forEach((member, i) => {
      if (!visited.has(member.id)) {
        const x = 50 + (i % 6) * horizontalSpacing;
        const y = 50 + Math.floor(i / 6) * verticalSpacing;
        addNode(member, x, y, 999);
      }
    });

    const nodeById: Record<string, any> = Object.fromEntries(
      nodes.map((n) => [n.id, n])
    );

    const edgePaths = (edges || []).map((e) => {
      const a = nodeById[e.fromId];
      const b = nodeById[e.toId];
      if (!a || !b)
        return {
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          path: "",
          type: e.type,
        };

      const fromX = a.x + a.width / 2;
      const fromY = a.y + a.height / 2;
      const toX = b.x + b.width / 2;
      const toY = b.y + b.height / 2;

      let path = "";
      if (e.type === "spouse") {
        path = `M ${fromX} ${fromY} L ${toX} ${toY}`;
      } else {
        const midY = (fromY + toY) / 2;
        const controlOffset = Math.abs(toY - fromY) * 0.4;
        const c1y = fromY + controlOffset;
        const c2y = toY - controlOffset;
        path = `M ${fromX} ${fromY} C ${fromX} ${c1y}, ${toX} ${c2y}, ${toX} ${toY}`;
      }

      return { id: e.id, fromId: e.fromId, toId: e.toId, path, type: e.type };
    });

    return { nodes, edges: edgePaths };
  };

  // ===== Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvasRef.current.width = rect.width * dpr;
        canvasRef.current.height = rect.height * dpr;
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
        updateCanvasState({ width: rect.width, height: rect.height });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateCanvasState]);

  // ===== Draw crown icon
  const drawCrown = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) => {
    ctx.save();
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.6);
    ctx.lineTo(x - size * 0.5, y + size * 0.6);
    ctx.lineTo(x - size * 0.4, y);
    ctx.lineTo(x - size * 0.2, y + size * 0.4);
    ctx.lineTo(x, y - size * 0.1);
    ctx.lineTo(x + size * 0.2, y + size * 0.4);
    ctx.lineTo(x + size * 0.4, y);
    ctx.lineTo(x + size * 0.5, y + size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(x + i * size * 0.2, y + size * 0.1, size * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
    }

    ctx.restore();
  };

  // ===== Render edges with smooth curves
  const [hoveredEdge, setHoveredEdge] = useState<null | {
    fromId: string;
    toId: string;
    type: string;
  }>(null);

  const renderEdges = (ctx: CanvasRenderingContext2D, edges: any[]) => {
    if (!edges || edges.length === 0) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    edges.forEach((edge) => {
      if (!edge.path) return;

      switch (edge.type) {
        case "spouse":
          ctx.strokeStyle = "#dc2626";
          ctx.lineWidth = 3;
          ctx.setLineDash([]);
          ctx.shadowColor = "rgba(220, 38, 38, 0.3)";
          ctx.shadowBlur = 8;
          break;
        case "adoptive":
        case "step":
          ctx.strokeStyle = "#6366f1";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([8, 6]);
          ctx.shadowColor = "rgba(99, 102, 241, 0.3)";
          ctx.shadowBlur = 6;
          break;
        default:
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
          ctx.shadowColor = "rgba(59, 130, 246, 0.3)";
          ctx.shadowBlur = 6;
      }

      const path2d = new Path2D(edge.path);
      ctx.stroke(path2d);

      // If hovered, draw animated glow
      if (
        hoveredEdge &&
        hoveredEdge.fromId === edge.fromId &&
        hoveredEdge.toId === edge.toId &&
        hoveredEdge.type === edge.type
      ) {
        ctx.save();
        ctx.shadowColor = "rgba(234, 179, 8, 0.9)";
        ctx.shadowBlur = 18;
        ctx.lineWidth = (ctx.lineWidth || 2) + 1.5;
        ctx.strokeStyle = "#f59e0b";
        ctx.stroke(path2d);
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    });
  };

  // ===== Render nodes with modern styling
  const renderNodes = (
    ctx: CanvasRenderingContext2D,
    nodes: any[],
    members: FamilyMember[],
    options: RenderOptions
  ) => {
    if (!nodes || nodes.length === 0 || !members || members.length === 0)
      return;

    nodes.forEach((node) => {
      const member = members.find((m) => m.id === node.id);
      if (!member) return;

      const isSelected = options.selectedNode === node.id;
      const isHighlighted = options.highlightPath?.includes(node.id);
      const isHovered = hoveredNode === node.id;
      const isDragging = draggingNode === node.id;
      const isHead = member.isHeadOfFamily;

      ctx.save();

      if (isDragging) {
        ctx.globalAlpha = 0.8;
      }

      const borderRadius = 12;
      const x = node.x;
      const y = node.y;
      const w = node.width;
      const h = node.height;

      if (isSelected || isHovered) {
        ctx.shadowColor = isSelected
          ? "rgba(59, 130, 246, 0.5)"
          : "rgba(168, 85, 247, 0.4)";
        ctx.shadowBlur = isSelected ? 20 : 15;
        ctx.shadowOffsetY = 4;
      }

      ctx.beginPath();
      ctx.moveTo(x + borderRadius, y);
      ctx.lineTo(x + w - borderRadius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + borderRadius);
      ctx.lineTo(x + w, y + h - borderRadius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - borderRadius, y + h);
      ctx.lineTo(x + borderRadius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - borderRadius);
      ctx.lineTo(x, y + borderRadius);
      ctx.quadraticCurveTo(x, y, x + borderRadius, y);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(x, y, x, y + h);
      if (isSelected) {
        gradient.addColorStop(0, "#3b82f6");
        gradient.addColorStop(1, "#2563eb");
        ctx.fillStyle = gradient;
      } else if (isHighlighted) {
        gradient.addColorStop(0, "#f59e0b");
        gradient.addColorStop(1, "#d97706");
        ctx.fillStyle = gradient;
      } else if (isHovered) {
        gradient.addColorStop(0, "#a855f7");
        gradient.addColorStop(1, "#9333ea");
        ctx.fillStyle = gradient;
      } else {
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(1, "#f8fafc");
        ctx.fillStyle = gradient;
      }

      ctx.fill();

      ctx.strokeStyle = isSelected
        ? "#2563eb"
        : isHovered
        ? "#9333ea"
        : isHighlighted
        ? "#d97706"
        : "#cbd5e1";
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 2;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      if (isHead) {
        drawCrown(ctx, x + w / 2, y - 15, 20);
      }

      if (options.showNames && member.fullName) {
        const textColor =
          isSelected || isHighlighted || isHovered ? "#ffffff" : "#0f172a";
        ctx.fillStyle = textColor;
        ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const name = member.fullName;
        const maxWidth = w - 20;
        const metrics = ctx.measureText(name);

        if (metrics.width > maxWidth) {
          const ellipsis = "...";
          let truncated = name;
          while (
            ctx.measureText(truncated + ellipsis).width > maxWidth &&
            truncated.length > 0
          ) {
            truncated = truncated.slice(0, -1);
          }
          ctx.fillText(truncated + ellipsis, x + w / 2, y + h / 2 - 8);
        } else {
          ctx.fillText(name, x + w / 2, y + h / 2 - 8);
        }

        if (member.birthYear || member.deathYear) {
          ctx.font = "12px system-ui, -apple-system, sans-serif";
          ctx.fillStyle =
            isSelected || isHighlighted || isHovered
              ? "rgba(255,255,255,0.9)"
              : "#64748b";
          const dates = `${member.birthYear || "?"} - ${
            member.deathYear || "Present"
          }`;
          ctx.fillText(dates, x + w / 2, y + h / 2 + 12);
        }

        // XP/Level badge (bottom-right)
        if (typeof member.xp === "number" || typeof member.level === "number") {
          const badgeW = 72;
          const badgeH = 22;
          const bx = x + w - badgeW - 8;
          const by = y + h - badgeH - 8;
          ctx.save();
          ctx.fillStyle =
            isSelected || isHovered ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.15)";
          ctx.beginPath();
          ctx.roundRect(bx, by, badgeW, badgeH, 8);
          ctx.fill();
          ctx.font = "12px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#ffffff";
          const lvl = typeof member.level === "number" ? member.level : 1;
          const xp = typeof member.xp === "number" ? member.xp : 0;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            `Lvl ${lvl} · ${xp} XP`,
            bx + badgeW / 2,
            by + badgeH / 2
          );
          ctx.restore();
        }
      }

      ctx.restore();
    });
  };

  // ===== Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasState.width, canvasState.height);

    ctx.save();
    ctx.translate(canvasState.panX, canvasState.panY);
    ctx.scale(canvasState.zoom, canvasState.zoom);

    // Use hierarchical layout for "View Result" mode, otherwise use edit mode layout
    const localLayout = showViewResult
      ? buildHierarchicalLayout()
      : isEditMode
      ? buildEditModeLayout()
      : layout || { nodes: [], edges: [] };
    renderEdges(ctx, localLayout.edges as any[]);
    renderNodes(ctx, localLayout.nodes as any[], members, renderOptions);

    ctx.restore();
    // Draw presence cursors overlay
    if (presence && presence.length > 0) {
      ctx.save();
      ctx.translate(canvasState.panX, canvasState.panY);
      ctx.scale(canvasState.zoom, canvasState.zoom);
      presence.forEach((p) => {
        if (typeof p.x !== "number" || typeof p.y !== "number") return;
        ctx.fillStyle = p.color || "#10b981";
        ctx.strokeStyle = "#065f46";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (p.name) {
          ctx.font = "12px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#111827";
          ctx.fillText(p.name, p.x + 10, p.y - 10);
        }
      });
      ctx.restore();
    }
  }, [
    members,
    edges,
    canvasState,
    renderOptions,
    hoveredNode,
    draggingNode,
    presence,
    showViewResult,
    layout,
  ]);

  // ===== Get node at position
  const getNodeAtPosition = (worldX: number, worldY: number) => {
    const localLayout = showViewResult
      ? buildHierarchicalLayout()
      : isEditMode
      ? buildEditModeLayout()
      : layout || { nodes: [], edges: [] };
    return localLayout.nodes.find(
      (node) =>
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
    );
  };

  // Hit-test edges for hover tooltip
  const getEdgeAtPosition = (worldX: number, worldY: number) => {
    const localLayout = showViewResult
      ? buildHierarchicalLayout()
      : isEditMode
      ? buildEditModeLayout()
      : layout || { nodes: [], edges: [] };
    const { edges: epaths } = localLayout;
    const radius = 6; // hover tolerance
    for (const e of epaths) {
      if (!e.path) continue;
      const path2d = new Path2D(e.path);
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) continue;
      // approximate by drawing a thicker invisible stroke and use isPointInStroke
      ctx.save();
      ctx.lineWidth = 10;
      const hit = ctx.isPointInStroke(
        path2d,
        worldX * canvasState.zoom + 0,
        worldY * canvasState.zoom + 0
      );
      ctx.restore();
      if (hit) return e;
    }
    return null;
  };

  // ===== Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    const clickedNode = getNodeAtPosition(worldX, worldY);

    if (clickedNode && isEditMode) {
      setDraggingNode(clickedNode.id);
      setNodeOffsets({ x: worldX - clickedNode.x, y: worldY - clickedNode.y });
      setSelectedNode(clickedNode.id);
      onNodeClick?.(clickedNode.id);
    } else if (isEditMode) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPan({ x: canvasState.panX, y: canvasState.panY });
      setSelectedNode(null);
      onCanvasClick?.();
    } else {
      // In view mode, just select nodes without dragging
      if (clickedNode) {
        setSelectedNode(clickedNode.id);
        onNodeClick?.(clickedNode.id);
      } else {
        setSelectedNode(null);
        onCanvasClick?.();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;

    if (draggingNode && isEditMode) {
      const newX = worldX - nodeOffsets.x;
      const newY = worldY - nodeOffsets.y;

      const memberToUpdate = members.find((m) => m.id === draggingNode);
      if (memberToUpdate) {
        updateMember(draggingNode, { ...memberToUpdate, x: newX, y: newY });
      }
    } else if (isDraggingCanvas && isEditMode) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      updateCanvasState({ panX: lastPan.x + deltaX, panY: lastPan.y + deltaY });
    } else {
      const hoveredNode = getNodeAtPosition(worldX, worldY);
      setHoveredNode(hoveredNode?.id || null);
      const edge = getEdgeAtPosition(worldX, worldY);
      if (edge)
        setHoveredEdge({
          fromId: edge.fromId,
          toId: edge.toId,
          type: edge.type,
        });
      else setHoveredEdge(null);
    }
  };

  const handleMouseUp = () => {
    const wasDraggingNode = !!draggingNode;
    setIsDraggingCanvas(false);
    setDraggingNode(null);

    // After moving a node, tidy the layout to keep things neat
    if (wasDraggingNode) {
      tidyLayout();
    }
  };

  // ===== Touch events (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    setContextMenu(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = e.touches[0];
    const worldX =
      (t.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (t.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    const tappedNode = getNodeAtPosition(worldX, worldY);
    if (tappedNode) {
      setDraggingNode(tappedNode.id);
      setNodeOffsets({ x: worldX - tappedNode.x, y: worldY - tappedNode.y });
      setSelectedNode(tappedNode.id);
      onNodeClick?.(tappedNode.id);
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: t.clientX, y: t.clientY });
      setLastPan({ x: canvasState.panX, y: canvasState.panY });
      setSelectedNode(null);
      onCanvasClick?.();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = e.touches[0];
    const worldX =
      (t.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (t.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    if (draggingNode) {
      const newX = worldX - nodeOffsets.x;
      const newY = worldY - nodeOffsets.y;
      const memberToUpdate = members.find((m) => m.id === draggingNode);
      if (memberToUpdate) {
        updateMember(draggingNode, { ...memberToUpdate, x: newX, y: newY });
      }
    } else if (isDraggingCanvas) {
      const deltaX = t.clientX - dragStart.x;
      const deltaY = t.clientY - dragStart.y;
      updateCanvasState({ panX: lastPan.x + deltaX, panY: lastPan.y + deltaY });
    }
  };

  const handleTouchEnd = () => {
    const wasDraggingNode = !!draggingNode;
    setIsDraggingCanvas(false);
    setDraggingNode(null);
    if (wasDraggingNode) {
      tidyLayout();
    }
  };

  // ===== Tidy layout: compute generations and distribute nodes per row
  const tidyLayout = () => {
    // Assign generation levels based on parent -> child edges
    const parentMap: Record<string, string[]> = {};
    const childMap: Record<string, string[]> = {};
    edges.forEach((e) => {
      if (e.type === "parent") {
        parentMap[e.toId] = parentMap[e.toId] || [];
        parentMap[e.toId].push(e.fromId);
        childMap[e.fromId] = childMap[e.fromId] || [];
        childMap[e.fromId].push(e.toId);
      }
    });

    const level: Record<string, number> = {};
    const roots = members.filter(
      (m) => !(parentMap[m.id!] && parentMap[m.id!].length)
    );
    const queue: string[] = [];
    roots.forEach((r) => {
      level[r.id!] = 0;
      queue.push(r.id!);
    });
    while (queue.length) {
      const cur = queue.shift()!;
      const children = childMap[cur] || [];
      children.forEach((c) => {
        const next = (level[cur] || 0) + 1;
        if (!(c in level) || next > level[c]) {
          level[c] = next;
          queue.push(c);
        }
      });
    }

    // Fallback for isolated nodes
    members.forEach((m) => {
      if (!(m.id! in level)) level[m.id!] = 0;
    });

    // Group by level and compute positions
    const spacingX = 260;
    const spacingY = 170;
    const marginX = 120;
    const marginY = 120;
    const levels: Record<number, FamilyMember[]> = {};
    members.forEach((m) => {
      const lv = level[m.id!] || 0;
      (levels[lv] = levels[lv] || []).push(m);
    });

    Object.keys(levels)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b)
      .forEach((lv) => {
        const row = levels[lv];
        // keep rough order by current x to reduce jumps
        row.sort((a, b) => (a.x || 0) - (b.x || 0));
        row.forEach((m, idx) => {
          const targetX = Math.round((marginX + idx * spacingX) / 10) * 10; // snap 10px
          const targetY = Math.round((marginY + lv * spacingY) / 10) * 10;
          if (m.x !== targetX || m.y !== targetY) {
            updateMember(m.id!, { ...m, x: targetX, y: targetY });
          }
        });
      });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    const clickedNode = getNodeAtPosition(worldX, worldY);

    if (clickedNode) {
      setEditingNode(clickedNode.id);
      onNodeDoubleClick?.(clickedNode.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    const clickedNode = getNodeAtPosition(worldX, worldY);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: clickedNode?.id || null,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Avoid calling preventDefault in passive listeners; only compute
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - canvasState.panX) / canvasState.zoom;
    const worldY = (mouseY - canvasState.panY) / canvasState.zoom;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(5, canvasState.zoom * zoomFactor));

    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    updateCanvasState({ zoom: newZoom, panX: newPanX, panY: newPanY });
  };

  const toggleHeadOfFamily = (nodeId: string) => {
    const member = members.find((m) => m.id === nodeId);
    if (member) {
      updateMember(nodeId, {
        ...member,
        isHeadOfFamily: !member.isHeadOfFamily,
      });
    }
    setContextMenu(null);
  };

  // ===== Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const panStep = 50;
      const zoomStep = 0.15;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        updateCanvasState({ panX: canvasState.panX + panStep });
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        updateCanvasState({ panX: canvasState.panX - panStep });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        updateCanvasState({ panY: canvasState.panY + panStep });
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        updateCanvasState({ panY: canvasState.panY - panStep });
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        updateCanvasState({ zoom: Math.min(5, canvasState.zoom + zoomStep) });
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        updateCanvasState({ zoom: Math.max(0.1, canvasState.zoom - zoomStep) });
      }
      if (e.key === "0") {
        e.preventDefault();
        updateCanvasState({ zoom: 1, panX: 0, panY: 0 });
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canvasState, updateCanvasState]);

  // ===== Render trigger
  useEffect(() => {
    render();
  }, [render]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-gradient-to-br from-slate-50 to-blue-50",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "none" }}
      />

      {/* Relation tooltip */}
      {hoveredEdge && (
        <div className="pointer-events-none absolute left-2 top-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {hoveredEdge.type === "spouse"
            ? "Spouse"
            : hoveredEdge.type === "parent"
            ? "Parent → Child"
            : hoveredEdge.type.replace("_", " ")}
        </div>
      )}

      {/* Enhanced zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-gray-200">
        <button
          onClick={() =>
            updateCanvasState({ zoom: Math.min(5, canvasState.zoom + 0.2) })
          }
          className="w-10 h-10 bg-white hover:bg-blue-50 border border-gray-300 rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-105 font-bold text-lg"
          title="Zoom In"
        >
          +
        </button>
        <div className="text-center text-xs font-medium text-gray-600 py-1">
          {Math.round(canvasState.zoom * 100)}%
        </div>
        <button
          onClick={() =>
            updateCanvasState({ zoom: Math.max(0.1, canvasState.zoom - 0.2) })
          }
          className="w-10 h-10 bg-white hover:bg-blue-50 border border-gray-300 rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-105 font-bold text-lg"
          title="Zoom Out"
        >
          −
        </button>
        <div className="h-px bg-gray-300 my-1" />
        <button
          onClick={() => updateCanvasState({ zoom: 1, panX: 0, panY: 0 })}
          className="w-10 h-10 bg-white hover:bg-blue-50 border border-gray-300 rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-105 text-lg"
          title="Reset View"
        >
          ⌂
        </button>
      </div>

      {/* Enhanced context menu */}
      {contextMenu && (
        <div
          className="absolute bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-xl py-1 text-sm min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {contextMenu.nodeId ? (
            <>
              <button
                onClick={() => {
                  setEditingNode(contextMenu.nodeId!);
                  setContextMenu(null);
                }}
                className="block w-full text-left hover:bg-blue-50 px-4 py-2 transition-colors"
              >
                ✏️ Edit Member
              </button>
              <button
                onClick={() => toggleHeadOfFamily(contextMenu.nodeId!)}
                className="block w-full text-left hover:bg-yellow-50 px-4 py-2 transition-colors"
              >
                👑 Toggle Head of Family
              </button>
              <div className="h-px bg-gray-200 my-1" />
              <button className="block w-full text-left hover:bg-red-50 px-4 py-2 transition-colors text-red-600">
                🗑️ Delete Member
              </button>
            </>
          ) : (
            <button className="block w-full text-left hover:bg-green-50 px-4 py-2 transition-colors">
              ➕ Add Member
            </button>
          )}
        </div>
      )}

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-gray-200 text-xs text-gray-600">
        <div className="font-medium">Controls:</div>
        <div>🖱️ Drag nodes to reposition • Drag canvas to pan</div>
        <div>🔍 Scroll to zoom • Arrow keys to pan</div>
        <div>👆 Double-click to edit • Right-click for menu</div>
      </div>
    </div>
  );
}
