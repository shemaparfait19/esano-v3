"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  useFamilyTreeStore,
  selectMembers,
  selectEdges,
  selectLayout,
  selectCanvasState,
} from "@/lib/family-tree-store";
import { ClassicLayoutEngine } from "@/lib/layout-engines/classic-layout";
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });

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

  // Layout engine
  const layoutEngine = useRef(new ClassicLayoutEngine());

  // Calculate layout when data changes
  useEffect(() => {
    if (members.length > 0) {
      const newLayout = layoutEngine.current.layout(members, edges);
      setLayout(newLayout);
    }
  }, [members, edges, setLayout]);

  // Handle canvas resize
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
        if (ctx) {
          ctx.scale(dpr, dpr);
        }

        updateCanvasState({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateCanvasState]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasState.width, canvasState.height);

    // Apply transformations
    ctx.save();
    ctx.translate(canvasState.panX, canvasState.panY);
    ctx.scale(canvasState.zoom, canvasState.zoom);

    // Render edges first (behind nodes)
    renderEdges(ctx, layout.edges);

    // Render nodes
    renderNodes(ctx, layout.nodes, members, renderOptions);

    ctx.restore();
  }, [layout, members, canvasState, renderOptions]);

  // Keyboard navigation for pan/zoom
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

  // Render edges
  const renderEdges = (ctx: CanvasRenderingContext2D, edges: any[]) => {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    edges.forEach((edge) => {
      if (!edge.path) return;

      // Different styles for different edge types
      switch (edge.type) {
        case "spouse":
          ctx.strokeStyle = "#f59e0b";
          ctx.setLineDash([]);
          break;
        case "adoptive":
        case "step":
          ctx.strokeStyle = "#6b7280";
          ctx.setLineDash([5, 5]);
          break;
        default:
          ctx.strokeStyle = "#94a3b8";
          ctx.setLineDash([]);
      }

      // Parse and draw SVG path
      const path = new Path2D(edge.path);
      ctx.stroke(path);
    });
  };

  // Render nodes
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

      // Node background
      ctx.fillStyle = isSelected
        ? "#3b82f6"
        : isHighlighted
        ? "#fbbf24"
        : "#ffffff";
      ctx.strokeStyle = isSelected ? "#1d4ed8" : "#e5e7eb";
      ctx.lineWidth = isSelected ? 3 : 1;

      ctx.fillRect(node.x, node.y, node.width, node.height);
      ctx.strokeRect(node.x, node.y, node.width, node.height);

      // Avatar placeholder
      if (options.showAvatars && member.avatarUrl) {
        // TODO: Load and draw actual avatar image
        ctx.fillStyle = "#d1d5db";
        ctx.fillRect(node.x + 4, node.y + 4, 32, 32);
      }

      // Name
      if (options.showNames) {
        ctx.fillStyle = "#1f2937";
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const nameY = member.avatarUrl ? node.y + 45 : node.y + node.height / 2;
        ctx.fillText(member.fullName, node.x + node.width / 2, nameY);
      }

      // Dates
      if (options.showDates && (member.birthDate || member.deathDate)) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "10px system-ui, -apple-system, sans-serif";

        let dateText = "";
        if (member.birthDate) {
          const birthYear = new Date(member.birthDate).getFullYear();
          dateText += birthYear;
        }
        if (member.deathDate) {
          const deathYear = new Date(member.deathDate).getFullYear();
          dateText += ` - ${deathYear}`;
        }

        const dateY = member.avatarUrl
          ? node.y + 60
          : node.y + node.height - 15;
        ctx.fillText(dateText, node.x + node.width / 2, dateY);
      }
    });
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPan({ x: canvasState.panX, y: canvasState.panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      updateCanvasState({
        panX: lastPan.x + deltaX,
        panY: lastPan.y + deltaY,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);

      // Check if this was a click (not a drag)
      const deltaX = Math.abs(e.clientX - dragStart.x);
      const deltaY = Math.abs(e.clientY - dragStart.y);

      if (deltaX < 5 && deltaY < 5) {
        handleCanvasClick(e);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!layout) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Convert screen coordinates to world coordinates
    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;

    // Find clicked node
    const clickedNode = layout.nodes.find(
      (node) =>
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
    );

    if (clickedNode) {
      setSelectedNode(clickedNode.id);
      onNodeClick?.(clickedNode.id);
    } else {
      setSelectedNode(null);
      onCanvasClick?.();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!layout) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const worldX =
      (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const worldY = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;

    const clickedNode = layout.nodes.find(
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const zoomFactor = 0.1;
    const newZoom = Math.max(
      0.1,
      Math.min(5, canvasState.zoom - e.deltaY * zoomFactor * 0.001)
    );

    updateCanvasState({ zoom: newZoom });
  };

  // Render on changes
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
        onWheel={handleWheel}
        style={{ touchAction: "none" }}
      />

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() =>
            updateCanvasState({ zoom: Math.min(5, canvasState.zoom + 0.2) })
          }
          className="w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center"
        >
          +
        </button>
        <button
          onClick={() =>
            updateCanvasState({ zoom: Math.max(0.1, canvasState.zoom - 0.2) })
          }
          className="w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center"
        >
          −
        </button>
        <button
          onClick={() => updateCanvasState({ zoom: 1, panX: 0, panY: 0 })}
          className="w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center text-xs"
        >
          ⌂
        </button>
      </div>
    </div>
  );
}
