"use client";

import React, { useState, useEffect } from "react";
import { useFamilyTreeStore } from "@/lib/family-tree-store";
import { FamilyMember } from "@/types/family-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Trash2, Crown } from "lucide-react";

interface NodeEditorProps {
  nodeId: string | null;
  onClose: () => void;
  onSave: (member: FamilyMember) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeEditor({
  nodeId,
  onClose,
  onSave,
  onDelete,
}: NodeEditorProps) {
  const { getMember, updateMember } = useFamilyTreeStore();
  const [formData, setFormData] = useState<Partial<FamilyMember>>({});
  const [isDirty, setIsDirty] = useState(false);

  const member = nodeId ? getMember(nodeId) : null;

  useEffect(() => {
    if (member) {
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        fullName: member.fullName,
        birthDate: member.birthDate,
        deathDate: member.deathDate,
        gender: member.gender,
        location: member.location,
        notes: member.notes,
        tags: member.tags,
      });
      setIsDirty(false);
    }
  }, [member]);

  const handleInputChange = (field: keyof FamilyMember, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!member || !isDirty) return;

    const updatedMember: FamilyMember = {
      ...member,
      ...formData,
      fullName: `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
      updatedAt: new Date().toISOString(),
    };

    updateMember(member.id, updatedMember);
    onSave(updatedMember);
    setIsDirty(false);
  };

  const toggleHead = () => {
    if (!member) return;
    const updated: FamilyMember = {
      ...member,
      isHeadOfFamily: !member.isHeadOfFamily,
      updatedAt: new Date().toISOString(),
    };
    updateMember(member.id, updated);
    onSave(updated);
  };

  const handleDelete = () => {
    if (!member) return;
    onDelete(member.id);
    onClose();
  };

  if (!member) return null;

  return (
    <Card className="w-80 max-h-[80vh] overflow-y-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Edit Member</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={formData.firstName || ""}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              placeholder="First name"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={formData.lastName || ""}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="birthDate">Birth Date</Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate || ""}
              onChange={(e) => handleInputChange("birthDate", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="deathDate">Death Date</Label>
            <Input
              id="deathDate"
              type="date"
              value={formData.deathDate || ""}
              onChange={(e) => handleInputChange("deathDate", e.target.value)}
            />
          </div>
        </div>

        {/* Gender */}
        <div>
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={formData.gender || ""}
            onValueChange={(value) => handleInputChange("gender", value)}
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

        {/* Location */}
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location || ""}
            onChange={(e) => handleInputChange("location", e.target.value)}
            placeholder="Birth place, residence, etc."
          />
        </div>

        {/* Tags */}
        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={formData.tags?.join(", ") || ""}
            onChange={(e) =>
              handleInputChange(
                "tags",
                e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            }
            placeholder="profession, military, etc. (comma separated)"
          />
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes || ""}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="Additional information, stories, etc."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant={member.isHeadOfFamily ? "default" : "outline"}
            onClick={toggleHead}
            className="flex-1"
          >
            <Crown className="h-4 w-4 mr-2" />
            {member.isHeadOfFamily ? "Head of Family" : "Set as Head"}
          </Button>
          <Button onClick={handleSave} disabled={!isDirty} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="destructive" onClick={handleDelete} className="px-3">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
