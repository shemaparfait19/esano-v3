'use client';

import { useAppContext } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Dna, HeartPulse, User, Map, AlertTriangle } from 'lucide-react';
import { InsightCard } from '@/components/dashboard/insight-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function InsightsPage() {
  const { insights, isAnalyzing, analysisCompleted } = useAppContext();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          Generational Insights
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover traits and predispositions passed down through your generations.
        </p>
      </div>

       <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Disclaimer</AlertTitle>
        <AlertDescription>
          The information provided is for educational and informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
        </AlertDescription>
      </Alert>

      {isAnalyzing && (
         <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/2"/></CardHeader>
                <CardContent><Skeleton className="h-20 w-full"/></CardContent>
            </Card>
             <Card>
                <CardHeader><Skeleton className="h-6 w-1/2"/></CardHeader>
                <CardContent><Skeleton className="h-20 w-full"/></CardContent>
            </Card>
             <Card>
                <CardHeader><Skeleton className="h-6 w-1/2"/></CardHeader>
                <CardContent><Skeleton className="h-20 w-full"/></CardContent>
            </Card>
        </div>
      )}

      {!isAnalyzing && !analysisCompleted && (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
              <Dna className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl text-primary mt-4">
              No Insights Available
            </CardTitle>
            <CardDescription>
              Upload your DNA file to generate your personalized insights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/dna-analysis">Upload DNA</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isAnalyzing && analysisCompleted && insights && (
        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
          <InsightCard
            icon={<HeartPulse className="h-8 w-8 text-primary" />}
            title="Health Insights"
            content={insights.healthInsights}
          />
          <InsightCard
            icon={<User className="h-8 w-8 text-primary" />}
            title="Trait Insights"
            content={insights.traitInsights}
          />
          <InsightCard
            icon={<Map className="h-8 w-8 text-primary" />}
            title="Ancestry Insights"
            content={insights.ancestryInsights}
          />
        </div>
      )}
    </div>
  );
}
