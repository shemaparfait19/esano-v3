"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, Users, Key } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FamilyCodeGeneratorProps {
  userProfile: any;
  onCodeGenerated?: (code: string) => void;
}

export function FamilyCodeGenerator({
  userProfile,
  onCodeGenerated,
}: FamilyCodeGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [familyName, setFamilyName] = useState<string>("");

  const generateFamilyCode = async () => {
    if (!familyName.trim()) {
      toast({
        title: "Family Name Required",
        description: "Please enter a family name before generating a code.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/family-code/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          familyName: familyName.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedCode(data.code);
        onCodeGenerated?.(data.code);
        toast({
          title: "Family Code Generated!",
          description: `Your family code is: ${data.code}`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to generate family code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating family code:", error);
      toast({
        title: "Error",
        description: "Failed to generate family code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedCode) {
      try {
        await navigator.clipboard.writeText(generatedCode);
        toast({
          title: "Copied!",
          description: "Family code copied to clipboard",
        });
      } catch (error) {
        console.error("Failed to copy:", error);
        toast({
          title: "Copy Failed",
          description: "Could not copy to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  if (!userProfile?.isFamilyHead) {
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5 text-blue-600" />
          Generate Family Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="familyName">Family Name</Label>
          <Input
            id="familyName"
            placeholder="Enter your family name"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            disabled={isGenerating}
          />
          <p className="text-xs text-gray-500">
            This will be used to identify your family tree
          </p>
        </div>

        <Button
          onClick={generateFamilyCode}
          disabled={isGenerating || !familyName.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Key className="h-4 w-4 mr-2" />
              Generate Family Code
            </>
          )}
        </Button>

        {generatedCode && (
          <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Family Code Generated
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-lg px-3 py-1"
                >
                  {generatedCode}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="h-8"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              <div className="text-xs text-green-700 space-y-1">
                <p>• Share this code with family members</p>
                <p>• They can use it during signup to join your tree</p>
                <p>• Code expires after 30 days</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium">How it works:</p>
          <p>1. Generate a unique family code</p>
          <p>2. Share the code with family members</p>
          <p>3. They enter it during signup to join your tree</p>
          <p>4. You can upgrade their access to editor later</p>
        </div>
      </CardContent>
    </Card>
  );
}
