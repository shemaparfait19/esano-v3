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
import { useState as useReactState } from "react";

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
  const { setDirty } = useFamilyTreeStore();
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
        ethnicity: member.ethnicity,
        originRegion: member.originRegion,
        contacts: member.contacts,
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
    setDirty(true);
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
    setDirty(true);
  };

  const [isUploading, setIsUploading] = useReactState(false);
  const [uploadError, setUploadError] = useReactState<string | null>(null);
  const [isUploadingVoice, setIsUploadingVoice] = useReactState(false);
  const [voiceError, setVoiceError] = useReactState<string | null>(null);
  const [tlUploading, setTlUploading] = useReactState(false);
  const [tlError, setTlError] = useReactState<string | null>(null);
  const [tlTitle, setTlTitle] = useReactState("");
  const [tlDate, setTlDate] = useReactState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!member) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("userId", member.id.split("_")[0] || ""); // simple placeholder; replace with owner
      form.append("memberId", member.id);
      form.append("file", file);
      const resp = await fetch("/api/family-tree/media", {
        method: "POST",
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Upload failed");
      const mediaUrls = Array.isArray(member.mediaUrls) ? member.mediaUrls : [];
      const updated: FamilyMember = {
        ...member,
        mediaUrls: [...mediaUrls, data.url],
        updatedAt: new Date().toISOString(),
      };
      updateMember(member.id, updated);
      onSave(updated);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadVoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!member) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVoice(true);
    setVoiceError(null);
    try {
      const form = new FormData();
      form.append("userId", member.id.split("_")[0] || "");
      form.append("memberId", member.id);
      form.append("file", file);
      form.append("kind", "voice");
      const resp = await fetch("/api/family-tree/media", {
        method: "POST",
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Upload failed");
      const existing = Array.isArray(member.voiceUrls) ? member.voiceUrls : [];
      const updated: FamilyMember = {
        ...member,
        voiceUrls: [...existing, data.url],
        updatedAt: new Date().toISOString(),
      };
      updateMember(member.id, updated);
      onSave(updated);
    } catch (err: any) {
      setVoiceError(err?.message || "Upload failed");
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const handleDelete = () => {
    if (!member) return;
    onDelete(member.id);
    onClose();
  };

  if (!member) return null;

  return (
    <Card className="w-[420px] max-h-[90vh] overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0 bg-white z-10 border-b">
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
        {/* Ancestry */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ethnicity">Ethnicity</Label>
            <Input
              id="ethnicity"
              value={formData.ethnicity || ""}
              onChange={(e) => handleInputChange("ethnicity", e.target.value)}
              placeholder="e.g., Banyarwanda"
            />
          </div>
          <div>
            <Label htmlFor="originRegion">Origin Region</Label>
            <Input
              id="originRegion"
              value={formData.originRegion || ""}
              onChange={(e) =>
                handleInputChange("originRegion", e.target.value)
              }
              placeholder="e.g., Bugesera, Eastern Province"
            />
          </div>
        </div>
        {/* Contacts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.contacts?.phone || ""}
              onChange={(e) =>
                handleInputChange("contacts", {
                  ...formData.contacts,
                  phone: e.target.value,
                })
              }
              placeholder="07xx..."
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={formData.contacts?.email || ""}
              onChange={(e) =>
                handleInputChange("contacts", {
                  ...formData.contacts,
                  email: e.target.value,
                })
              }
              placeholder="email@example.com"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.contacts?.address || ""}
            onChange={(e) =>
              handleInputChange("contacts", {
                ...formData.contacts,
                address: e.target.value,
              })
            }
            placeholder="Street, City"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4">
        {/* XP / Level */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Level</Label>
            <div className="text-sm text-muted-foreground mt-1">
              {member.level ?? 1}
            </div>
          </div>
          <div>
            <Label>XP</Label>
            <div className="text-sm text-muted-foreground mt-1">
              {member.xp ?? 0}
            </div>
          </div>
        </div>
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

        {/* Media */}
        <div>
          <Label>Media Attachments</Label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleUpload}
            />
            {isUploading && (
              <span className="text-xs text-muted-foreground">
                Uploading...
              </span>
            )}
            {uploadError && (
              <span className="text-xs text-destructive">{uploadError}</span>
            )}
          </div>
          {Array.isArray(member.mediaUrls) && member.mediaUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {member.mediaUrls.map((url, idx) => (
                <div key={idx} className="border rounded overflow-hidden">
                  {/* naive preview */}
                  {url.startsWith("data:image") ? (
                    <img
                      src={url}
                      alt="media"
                      className="w-full h-20 object-cover"
                    />
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      className="text-xs p-2 block truncate"
                    >
                      {url.slice(0, 40)}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Voice memories */}
        <div>
          <Label>Voice Memories</Label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="file"
              accept="audio/*"
              onChange={handleUploadVoice as any}
            />
            {isUploadingVoice && (
              <span className="text-xs text-muted-foreground">
                Uploading...
              </span>
            )}
            {voiceError && (
              <span className="text-xs text-destructive">{voiceError}</span>
            )}
          </div>
          {Array.isArray(member.voiceUrls) && member.voiceUrls.length > 0 && (
            <div className="mt-2 space-y-1">
              {member.voiceUrls.map((url, i) => (
                <audio key={i} controls src={url} className="w-full" />
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div>
          <Label>Timeline</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              placeholder="Title (e.g., Wedding)"
              value={tlTitle}
              onChange={(e) => setTlTitle(e.target.value)}
            />
            <Input
              type="date"
              value={tlDate}
              onChange={(e) => setTlDate(e.target.value)}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={async (e) => {
                if (!member) return;
                const file = e.target.files?.[0];
                if (!file) return;
                setTlUploading(true);
                setTlError(null);
                try {
                  const form = new FormData();
                  form.append("userId", member.id.split("_")[0] || "");
                  form.append("memberId", member.id);
                  form.append("file", file);
                  form.append("kind", "timeline");
                  form.append("title", tlTitle || file.name);
                  const iso = tlDate
                    ? new Date(tlDate + "T00:00:00").toISOString()
                    : new Date().toISOString();
                  form.append("date", iso);
                  const resp = await fetch("/api/family-tree/media", {
                    method: "POST",
                    body: form,
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data?.error || "Upload failed");
                  const current = Array.isArray(member.timeline)
                    ? member.timeline
                    : [];
                  const updated: FamilyMember = {
                    ...member,
                    timeline: [
                      ...current,
                      {
                        id: `tl_${Date.now()}`,
                        type: file.type.startsWith("audio")
                          ? "audio"
                          : file.type.startsWith("video")
                          ? "video"
                          : "photo",
                        date: iso,
                        title: tlTitle || file.name,
                        url: data.url,
                      },
                    ],
                    updatedAt: new Date().toISOString(),
                  };
                  updateMember(member.id, updated);
                  onSave(updated);
                  setDirty(true);
                } catch (err: any) {
                  setTlError(err?.message || "Upload failed");
                } finally {
                  setTlUploading(false);
                }
              }}
            />
            {tlUploading && (
              <span className="text-xs text-muted-foreground">Adding...</span>
            )}
            {tlError && (
              <span className="text-xs text-destructive">{tlError}</span>
            )}
          </div>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!member) return;
                if (!tlTitle) return;
                const current = Array.isArray(member.timeline)
                  ? member.timeline
                  : [];
                const iso = tlDate
                  ? new Date(tlDate + "T00:00:00").toISOString()
                  : new Date().toISOString();
                const updated: FamilyMember = {
                  ...member,
                  timeline: [
                    ...current,
                    {
                      id: `tl_${Date.now()}`,
                      type: "event",
                      date: iso,
                      title: tlTitle,
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                };
                updateMember(member.id, updated);
                onSave(updated);
                setDirty(true);
                setTlTitle("");
              }}
            >
              Add Event
            </Button>
          </div>
          {Array.isArray(member.timeline) && member.timeline.length > 0 && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {member.timeline
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((t) => (
                  <div
                    key={t.id}
                    className="text-xs p-2 border rounded flex items-center gap-2"
                  >
                    <span className="shrink-0 text-muted-foreground">
                      {new Date(t.date).toLocaleDateString()}
                    </span>
                    <span className="font-medium">{t.title || t.type}</span>
                    {t.url && (
                      <a
                        href={t.url}
                        target="_blank"
                        className="ml-auto underline"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t bg-white">
          <Button
            type="button"
            variant={member.isHeadOfFamily ? "default" : "outline"}
            onClick={toggleHead}
            className="flex-1"
          >
            <Crown className="h-4 w-4 mr-2" />
            {member.isHeadOfFamily ? "Head of Family" : "Set as Head"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={async () => {
              try {
                const ownerId = member.id.split("_")[0] || "";
                const resp = await fetch("/api/family-tree/story", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: ownerId,
                    memberId: member.id,
                  }),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data?.error || "Failed");
                const story: string = data.story;
                const currentTl = Array.isArray(member.timeline)
                  ? member.timeline
                  : [];
                const updated: FamilyMember = {
                  ...member,
                  notes: `${
                    member.notes ? member.notes + "\n\n" : ""
                  }${story}`.trim(),
                  timeline: [
                    ...currentTl,
                    {
                      id: `tl_${Date.now()}`,
                      type: "note",
                      date: new Date().toISOString(),
                      title: "AI-generated Family Story",
                      description: story,
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                };
                updateMember(member.id, updated);
                onSave(updated);
                setDirty(true);
              } catch (e: any) {
                // noop; a toast could be added if desired
              }
            }}
          >
            Generate AI Story
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
