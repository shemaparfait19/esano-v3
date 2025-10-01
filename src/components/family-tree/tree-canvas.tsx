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
}

export function TreeCanvas({
  className,
  onNodeClick,
  onNodeDoubleClick,
  onCanvasClick,
}: TreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });
  const [nodeOffsets, setNodeOffsets] = useState({ x: 0, y: 0 });
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
  } = useFamilyTreeStore();

  // ===== Build layout
  const buildLayoutFromPositions = () => {
    const sorted = [...members].sort((a, b) =>
      (a.id || "").localeCompare(b.id || "")
    );
    const nodeWidth = 180;
    const nodeHeight = 80;
    const gridX = 220;
    const gridY = 140;
    const nodes = sorted.map((m, i) => {
      const x = typeof m.x === "number" ? m.x : 120 + (i % 5) * gridX;
      const y = typeof m.y === "number" ? m.y : 120 + Math.floor(i / 5) * gridY;
      return { id: m.id, x, y, width: nodeWidth, height: nodeHeight };
    });
    const nodeById: Record<string, any> = Object.fromEntries(
      nodes.map((n) => [n.id, n])
    );
    const edgePaths = edges.map((e) => {
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
      const path =
        e.type === "spouse"
          ? `M ${fromX} ${fromY} L ${toX} ${toY}`
          : (() => {
              const midY = (fromY + toY) / 2;
              const c1 = fromY + (midY - fromY) * 0.5;
              const c2 = toY - (toY - midY) * 0.5;
              return `M ${fromX} ${fromY} C ${fromX} ${c1} ${toX} ${c2} ${toX} ${toY}`;
            })();
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
    const localLayout = buildLayoutFromPositions();
    renderEdges(ctx, localLayout.edges as any[]);
    renderNodes(ctx, localLayout.nodes as any[], members, renderOptions);
    ctx.restore();
  }, [members, edges, canvasState, renderOptions]);

  // ===== Keyboard pan/zoom
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const panStep = 40;
      const zoomStep = 0.1;
      if (e.key === "ArrowLeft")
        updateCanvasState({ panX: canvasState.panX + panStep });
      if (e.key === "ArrowRight")
        updateCanvasState({ panX: canvasState.panX - panStep });
      if (e.key === "ArrowUp")
        updateCanvasState({ panY: canvasState.panY + panStep });
      if (e.key === "ArrowDown")
        updateCanvasState({ panY: canvasState.panY - panStep });
      if (e.key === "+" || e.key === "=")
        updateCanvasState({ zoom: Math.min(5, canvasState.zoom + zoomStep) });
      if (e.key === "-" || e.key === "_")
        updateCanvasState({ zoom: Math.max(0.1, canvasState.zoom - zoomStep) });
      if (e.key.toLowerCase() === "0")
        updateCanvasState({ zoom: 1, panX: 0, panY: 0 });
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canvasState.panX, canvasState.panY, canvasState.zoom, updateCanvasState]);

  // ===== Edges
  const renderEdges = (ctx: CanvasRenderingContext2D, edges: any[]) => {
    ctx.lineWidth = 2.5;
    edges.forEach((edge) => {
      if (!edge.path) return;
      switch (edge.type) {
        case "spouse":
          ctx.strokeStyle = "#b45309";
          ctx.setLineDash([]);
          break;
        case "adoptive":
        case "step":
          ctx.strokeStyle = "#374151";
          ctx.setLineDash([5, 5]);
          break;
        default:
          ctx.strokeStyle = "#94a3b8";
          ctx.setLineDash([]);
      }
      ctx.stroke(new Path2D(edge.path));
    });
  };

  // ===== Nodes
  const renderNodes = (
    ctx: CanvasRenderingContext2D,
    nodes: any[],
    members: FamilyMember[],
    options: RenderOptions
  ) => {
    nodes.forEach((node) => {
      const member = members.find((m) => m.id === node.id);
      if (!member) return;
      const isSelected = options.selectedNode === node.id;
      const isHighlighted = options.highlightPath?.includes(node.id);
      ctx.fillStyle = isSelected
        ? "#1d4ed8"
        : isHighlighted
        ? "#f59e0b"
        : "#ffffff";
      ctx.strokeStyle = isSelected ? "#1e40af" : "#94a3b8";
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.fillRect(node.x, node.y, node.width, node.height);
      ctx.strokeRect(node.x, node.y, node.width, node.height);
      if (options.showNames) {
        ctx.fillStyle = "#0f172a";
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          member.fullName,
          node.x + node.width / 2,
          node.y + node.height / 2
        );
      }
    });
  };

  // ===== Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    const localLayout = buildLayoutFromPositions();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    const clickedNode = localLayout.nodes.find(
      (node) =>
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
    );
    if (clickedNode) {
      setDraggingNode(clickedNode.id);
      setNodeOffsets({ x: worldX - clickedNode.x, y: worldY - clickedNode.y });
      setSelectedNode(clickedNode.id);
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPan({ x: canvasState.panX, y: canvasState.panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX =
        (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
      const worldY =
        (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
      setLayout((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggingNode
            ? { ...n, x: worldX - nodeOffsets.x, y: worldY - nodeOffsets.y }
            : n
        ),
      }));
    } else if (isDraggingCanvas) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      updateCanvasState({ panX: lastPan.x + deltaX, panY: lastPan.y + deltaY });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingNode(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const localLayout = buildLayoutFromPositions();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    const clickedNode = localLayout.nodes.find(
      (node) =>
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
    );
    if (clickedNode) {
      setEditingNode(clickedNode.id);
      onNodeDoubleClick?.(clickedNode.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const localLayout = buildLayoutFromPositions();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    const clickedNode = localLayout.nodes.find(
      (node) =>
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
    );
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: clickedNode?.id || null,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const newZoom = Math.max(
      0.1,
      Math.min(5, canvasState.zoom - e.deltaY * zoomFactor * 0.001)
    );
    updateCanvasState({ zoom: newZoom });
  };

  // ===== Render trigger
  useEffect(() => {
    render();
  }, [render]);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full h-full bg-gray-50", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        style={{ touchAction: "none" }}
      />

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() =>
            updateCanvasState({ zoom: Math.min(5, canvasState.zoom + 0.2) })
          }
          className="w-8 h-8 bg-white border rounded shadow-sm"
        >
          +
        </button>
        <button
          onClick={() =>
            updateCanvasState({ zoom: Math.max(0.1, canvasState.zoom - 0.2) })
          }
          className="w-8 h-8 bg-white border rounded shadow-sm"
        >
          −
        </button>
        <button
          onClick={() => updateCanvasState({ zoom: 1, panX: 0, panY: 0 })}
          className="w-8 h-8 bg-white border rounded shadow-sm text-xs"
        >
          ⌂
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="absolute bg-white border rounded shadow p-2 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.nodeId ? (
            <>
              <button className="block w-full text-left hover:bg-gray-100 px-2 py-1">
                Edit
              </button>
              <button className="block w-full text-left hover:bg-gray-100 px-2 py-1">
                Delete
              </button>
            </>
          ) : (
            <button className="block w-full text-left hover:bg-gray-100 px-2 py-1">
              Add Member
            </button>
          )}
        </div>
      )}
    </div>
  );
}
