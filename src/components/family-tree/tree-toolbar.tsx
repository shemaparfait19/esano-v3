"use client";

import React from "react";
import { useFamilyTreeStore } from "@/lib/family-tree-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Users,
  Heart,
  Eye,
  EyeOff,
  Calendar,
  CalendarOff,
  Download,
  Maximize,
  Minimize,
  Settings,
} from "lucide-react";

interface TreeToolbarProps {
  onAddMember: () => void;
  onAddRelationship: () => void;
  onExport: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function TreeToolbar({
  onAddMember,
  onAddRelationship,
  onExport,
  onToggleFullscreen,
  onOpenSettings,
  onUndo,
  onRedo,
}: TreeToolbarProps) {
  const {
    renderOptions,
    setRenderOptions,
    isFullscreen,
    canvasState,
    updateCanvasState,
    undo,
    redo,
  } = useFamilyTreeStore();

  const handleViewModeChange = (mode: string) => {
    // TODO: Implement view mode switching
    console.log("View mode changed to:", mode);
  };

  const handleZoomToFit = () => {
    // TODO: Calculate bounds and zoom to fit
    updateCanvasState({ zoom: 1, panX: 0, panY: 0 });
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200">
      {/* Add Tools */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddMember}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onAddRelationship}
          className="flex items-center gap-2"
        >
          <Heart className="h-4 w-4" />
          Add Relationship
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* View Controls */}
      <div className="flex items-center gap-1">
        <Select value="classic" onValueChange={handleViewModeChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="classic">Classic</SelectItem>
            <SelectItem value="radial">Radial</SelectItem>
            <SelectItem value="timeline">Timeline</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomToFit}
          className="px-2"
        >
          <Users className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Display Options */}
      <div className="flex items-center gap-1">
        <Button
          variant={renderOptions.showNames ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setRenderOptions({ showNames: !renderOptions.showNames })
          }
          className="px-2"
        >
          {renderOptions.showNames ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant={renderOptions.showDates ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setRenderOptions({ showDates: !renderOptions.showDates })
          }
          className="px-2"
        >
          {renderOptions.showDates ? (
            <Calendar className="h-4 w-4" />
          ) : (
            <CalendarOff className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant={renderOptions.showAvatars ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setRenderOptions({ showAvatars: !renderOptions.showAvatars })
          }
          className="px-2"
        >
          {renderOptions.showAvatars ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Zoom Info */}
      <div className="text-sm text-gray-600 min-w-16 text-center">
        {Math.round(canvasState.zoom * 100)}%
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Actions */}
      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onUndo ?? undo}
          className="px-2"
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRedo ?? redo}
          className="px-2"
        >
          Redo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleFullscreen}
          className="px-2"
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="px-2"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
