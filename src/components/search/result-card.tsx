"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  MapPin,
  Calendar,
  Users,
  MessageCircle,
  Eye,
  Target,
  CheckCircle,
  Clock,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

interface SearchResult {
  id: string;
  type: "user" | "family_member";
  name: string;
  matchScore: number;
  matchReasons: string[];
  preview: {
    location?: string;
    birthDate?: string;
    relationshipContext?: string;
    profilePicture?: string;
  };
  contactInfo?: {
    canConnect: boolean;
    connectionStatus?: "none" | "pending" | "connected";
  };
}

interface ResultCardProps {
  result: SearchResult;
  onConnect?: (userId: string) => Promise<void>;
  className?: string;
}

export default function ResultCard({
  result,
  onConnect,
  className = "",
}: ResultCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth() as any;
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<"none" | "pending" | "connected">(
    result.contactInfo?.connectionStatus || "none"
  );

  const handleConnect = async () => {
    // Disabled on search results: connect from the profile page
    return;
  };

  const handleViewProfile = () => {
    if (result.type === "user") {
      router.push(`/dashboard/profile/${result.id}`);
    }
  };

  const handleMessage = () => {
    if (result.type === "user" && status === "connected") {
      router.push(`/dashboard/messages?peer=${result.id}`);
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-blue-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-gray-500";
  };

  const getConnectionStatusIcon = (status?: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <UserPlus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConnectionStatusText = (status?: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "pending":
        return "Pending";
      default:
        return "Connect";
    }
  };

  useEffect(() => {
    if (result.type !== "user" || !user?.uid) return;
    let ignore = false;
    async function load() {
      try {
        const reqRef = collection(db, "connectionRequests");
        const conRef = collection(db, "connections");
        const [outgoing, connectedA, connectedB] = await Promise.all([
          getDocs(
            query(
              reqRef,
              where("fromUserId", "==", user.uid),
              where("toUserId", "==", result.id),
              where("status", "==", "pending")
            )
          ),
          getDocs(
            query(
              conRef,
              where("participants", "array-contains", user.uid),
              where("status", "==", "connected")
            )
          ),
          getDocs(
            query(
              conRef,
              where("participants", "array-contains", result.id),
              where("status", "==", "connected")
            )
          ),
        ]);
        const isPending = outgoing.size > 0;
        const isConnected =
          connectedA.docs.some((d) => {
            const arr = ((d.data() as any)?.participants || []) as string[];
            return Array.isArray(arr) && arr.includes(result.id);
          }) || connectedB.size > 0;
        if (!ignore)
          setStatus(isConnected ? "connected" : isPending ? "pending" : "none");
      } catch {}
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user?.uid, result.type, result.id]);

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage
              src={result.preview.profilePicture}
              alt={result.name}
            />
            <AvatarFallback>
              {result.type === "user" ? (
                <User className="h-6 w-6" />
              ) : (
                <Users className="h-6 w-6" />
              )}
            </AvatarFallback>
          </Avatar>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header with name and match score */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg truncate pr-2">
                {result.name}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant="secondary"
                  className={`${getMatchScoreColor(
                    result.matchScore
                  )} text-white`}
                >
                  <Target className="h-3 w-3 mr-1" />
                  {result.matchScore}% match
                </Badge>
                {result.type === "family_member" && (
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    Family Tree
                  </Badge>
                )}
              </div>
            </div>

            {/* Location and birth date */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
              {result.preview.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{result.preview.location}</span>
                </div>
              )}
              {result.preview.birthDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Born {result.preview.birthDate}</span>
                </div>
              )}
            </div>

            {/* Relationship context for family members */}
            {result.preview.relationshipContext && (
              <p className="text-sm text-muted-foreground mb-3">
                {result.preview.relationshipContext}
              </p>
            )}

            {/* Match reasons */}
            <div className="flex flex-wrap gap-1 mb-4">
              {result.matchReasons.map((reason, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {reason}
                </Badge>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {result.type === "user" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewProfile}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  View Profile
                </Button>
              )}

              {result.type === "user" && status === "connected" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMessage}
                  className="flex items-center gap-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  Message
                </Button>
              )}

              {/* Connect suppressed in search; use View Profile to connect */}

              {/* Pending badge hidden here to keep results clean */}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
