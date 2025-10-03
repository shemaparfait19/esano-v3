"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, RefreshCw, Database, AlertTriangle } from "lucide-react";

interface UsageData {
  totalCollections: number;
  totalDocuments: number;
  collections: Array<{
    name: string;
    documentCount: number;
    avgFieldsPerDoc: number;
    avgSizePerDoc: number;
    estimatedTotalSize: number;
  }>;
  largestCollections: Array<{
    name: string;
    documentCount: number;
    estimatedTotalSize: number;
  }>;
  suspiciousCollections: Array<{
    name: string;
    documentCount: number;
    reason: string;
  }>;
}

interface Recommendation {
  type: string;
  priority: string;
  message: string;
  action: string;
}

export default function FirestoreDebugPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState<string | null>(null);

  const analyzeUsage = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/debug/firestore-usage");
      const data = await response.json();

      if (data.success) {
        setUsage(data.usage);
        setRecommendations(data.recommendations || []);
      } else {
        console.error("Analysis failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to analyze usage:", error);
    } finally {
      setLoading(false);
    }
  };

  const cleanupCollection = async (collectionName: string, action: string) => {
    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete data from "${collectionName}".\n\n` +
        `Action: ${action}\n\n` +
        `Type "YES DELETE" in the next prompt to confirm.`
    );

    if (!confirmed) return;

    const finalConfirm = window.prompt(
      `Final confirmation: Type "YES_DELETE_ALL" to proceed with deleting from ${collectionName}:`
    );

    if (finalConfirm !== "YES_DELETE_ALL") {
      alert("Cleanup cancelled - confirmation text did not match.");
      return;
    }

    setCleanupLoading(collectionName);
    try {
      const response = await fetch("/api/debug/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          collectionName,
          confirm: "YES_DELETE_ALL",
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Success: ${data.message}`);
        // Refresh usage data
        analyzeUsage();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
      alert("❌ Cleanup failed - check console for details");
    } finally {
      setCleanupLoading(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8" />
            Firestore Usage Analyzer
          </h1>
          <p className="text-muted-foreground mt-2">
            Diagnose and clean up Firestore quota issues
          </p>
        </div>

        <Button
          onClick={analyzeUsage}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing..." : "Analyze Usage"}
        </Button>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Recommendations
          </h2>
          {recommendations.map((rec, index) => (
            <Alert
              key={index}
              className={
                rec.priority === "high" ? "border-red-500" : "border-orange-500"
              }
            >
              <AlertDescription>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge
                      variant={
                        rec.priority === "high" ? "destructive" : "secondary"
                      }
                      className="mb-2"
                    >
                      {rec.priority.toUpperCase()} PRIORITY
                    </Badge>
                    <p className="font-medium">{rec.message}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rec.action}
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Usage Overview */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usage.totalCollections}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usage.totalDocuments}</div>
              {usage.totalDocuments > 100 && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ High document count
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Estimated Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(
                  usage.collections.reduce(
                    (sum, c) => sum + c.estimatedTotalSize,
                    0
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Largest Collections */}
      {usage?.largestCollections && usage.largestCollections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Largest Collections</CardTitle>
            <CardDescription>
              Collections using the most storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usage.largestCollections.map((collection) => (
                <div
                  key={collection.name}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{collection.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {collection.documentCount} documents •{" "}
                      {formatBytes(collection.estimatedTotalSize)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        cleanupCollection(collection.name, "clean_test_data")
                      }
                      disabled={cleanupLoading === collection.name}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clean Test Data
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        cleanupCollection(collection.name, "delete_collection")
                      }
                      disabled={cleanupLoading === collection.name}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete All
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Collections */}
      {usage?.collections && usage.collections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Collections</CardTitle>
            <CardDescription>
              Complete breakdown of your Firestore usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usage.collections.map((collection) => (
                <div
                  key={collection.name}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{collection.name}</span>
                      {collection.documentCount > 50 && (
                        <Badge variant="destructive" className="text-xs">
                          High Count
                        </Badge>
                      )}
                      {collection.avgSizePerDoc > 3000 && (
                        <Badge variant="secondary" className="text-xs">
                          Large Docs
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {collection.documentCount} docs •
                      {collection.avgFieldsPerDoc} fields/doc •
                      {formatBytes(collection.avgSizePerDoc)}/doc
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-medium">
                      {formatBytes(collection.estimatedTotalSize)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!usage && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground mb-4">
              Click "Analyze Usage" to check your Firestore collections and
              identify quota issues.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
