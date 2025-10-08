import type { AnalyzeDnaAndPredictRelativesOutput } from "@/ai/schemas/ai-dna-prediction";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dna, Link2, ExternalLink } from "lucide-react";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";

type RelativeCardProps = {
  relative: AnalyzeDnaAndPredictRelativesOutput[0];
};

export function RelativeCard({ relative }: RelativeCardProps) {
  const fallback = relative.userId.substring(0, 2).toUpperCase() || "P";
  // Relationship probability is between 0 and 1, so multiply by 100 for percentage
  const probabilityPercent = relative.relationshipProbability
    ? Math.round(relative.relationshipProbability * 100)
    : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage
            src={`https://picsum.photos/seed/${relative.userId}/100`}
            data-ai-hint="person face"
          />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle className="font-headline text-lg">
            Potential Relative
          </CardTitle>
          <CardDescription>User ID: {relative.userId}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-primary">
            {relative.predictedRelationship || "Unknown Relationship"}
          </h3>
          <p className="text-sm text-muted-foreground">Confidence:</p>
          <div className="flex items-center gap-2">
            <Progress value={probabilityPercent} className="h-2" />
            <span className="text-xs font-medium text-muted-foreground">
              {probabilityPercent}%
            </span>
          </div>
        </div>

        {relative.sharedCentimorgans && (
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Dna className="h-4 w-4 text-primary" />
            Shared DNA:{" "}
            <span className="font-semibold text-foreground">
              {relative.sharedCentimorgans} cM
            </span>
          </div>
        )}

        {relative.commonAncestors && relative.commonAncestors.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Common Ancestors
            </h4>
            <div className="flex flex-wrap gap-2">
              {relative.commonAncestors.map((ancestor) => (
                <Badge key={ancestor} variant="secondary">
                  {ancestor}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="secondary" className="w-full">
          <a
            href={`/dashboard/profile?userId=${encodeURIComponent(
              relative.userId
            )}`}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> View Profile
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
