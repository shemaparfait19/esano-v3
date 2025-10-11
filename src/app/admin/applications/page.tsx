"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Users,
  Heart,
  Info,
} from "lucide-react";
import type { FamilyTreeApplication } from "@/types/firestore";

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<FamilyTreeApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] =
    useState<FamilyTreeApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const response = await fetch("/api/admin/applications");
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error("Failed to load applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (
    applicationId: string,
    decision: "approved" | "denied"
  ) => {
    if (!reviewNotes.trim() && decision === "denied") {
      alert("Please provide notes when denying an application");
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/admin/applications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          decision,
          adminNotes: reviewNotes,
        }),
      });

      if (response.ok) {
        await loadApplications(); // Reload applications
        setSelectedApplication(null);
        setReviewNotes("");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to process application");
      }
    } catch (error) {
      console.error("Failed to review application:", error);
      alert("Failed to process application");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </span>
        );
      case "denied":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Denied
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border border-gray-300">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Family Tree Applications
        </h1>
        <p className="text-gray-600 mt-2">
          Review and approve family tree creation applications
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Applications List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Applications ({applications.length})
              </CardTitle>
              <CardDescription>
                Click on an application to review it
              </CardDescription>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No applications found
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedApplication?.id === app.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedApplication(app)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {app.userFullName}
                          </span>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {app.userEmail}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">
                        Expected members: {app.applicationData.expectedMembers}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Application Details */}
        <div className="lg:col-span-1">
          {selectedApplication ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Application Details
                </CardTitle>
                <CardDescription>
                  Review this application and make a decision
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Applicant</Label>
                  <div className="text-sm text-gray-600">
                    {selectedApplication.userFullName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedApplication.userEmail}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    Reason for Tree
                  </Label>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedApplication.applicationData.reasonForTree}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Family Background
                  </Label>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedApplication.applicationData.familyBackground}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">
                    Expected Members
                  </Label>
                  <div className="text-sm text-gray-600">
                    {selectedApplication.applicationData.expectedMembers}
                  </div>
                </div>

                {selectedApplication.applicationData.culturalSignificance && (
                  <div>
                    <Label className="text-sm font-medium">
                      Cultural Significance
                    </Label>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {selectedApplication.applicationData.culturalSignificance}
                    </div>
                  </div>
                )}

                {selectedApplication.applicationData.additionalInfo && (
                  <div>
                    <Label className="text-sm font-medium">
                      Additional Information
                    </Label>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {selectedApplication.applicationData.additionalInfo}
                    </div>
                  </div>
                )}

                {selectedApplication.status === "pending" && (
                  <>
                    <div>
                      <Label htmlFor="reviewNotes">Review Notes</Label>
                      <Textarea
                        id="reviewNotes"
                        placeholder="Add notes about your decision (required for denials)"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          handleReview(selectedApplication.id!, "approved")
                        }
                        disabled={processing}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() =>
                          handleReview(selectedApplication.id!, "denied")
                        }
                        disabled={processing || !reviewNotes.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Deny
                      </Button>
                    </div>
                  </>
                )}

                {selectedApplication.status !== "pending" && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm font-medium mb-1">
                      Status: {selectedApplication.status}
                    </div>
                    {selectedApplication.adminNotes && (
                      <div className="text-sm text-gray-600">
                        <strong>Admin Notes:</strong>{" "}
                        {selectedApplication.adminNotes}
                      </div>
                    )}
                    {selectedApplication.reviewedAt && (
                      <div className="text-xs text-gray-500 mt-2">
                        Reviewed:{" "}
                        {new Date(
                          selectedApplication.reviewedAt
                        ).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>Select an application to review</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
