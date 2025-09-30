'use client';

import { useAppContext } from '@/contexts/app-context';
import { RelativeCard } from '@/components/dashboard/relative-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dna, Users, Frown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export default function RelativesPage() {
  const { relatives, isAnalyzing, analysisCompleted } = useAppContext();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          DNA Relatives
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover and connect with potential relatives based on your DNA.
        </p>
      </div>

      {isAnalyzing && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
                 <Card key={i}>
                    <CardHeader className="flex flex-row items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                         <Skeleton className="h-10 w-1/3" />
                    </CardContent>
                 </Card>
            ))}
        </div>
      )}

      {!isAnalyzing && !analysisCompleted && (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
              <Dna className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl text-primary mt-4">
              No DNA Data Found
            </CardTitle>
            <CardDescription>
              Upload your DNA file to start finding relatives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/dna-analysis">Upload DNA</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isAnalyzing && analysisCompleted && (!relatives || relatives.length === 0) && (
         <Card className="text-center">
            <CardHeader>
                <div className="mx-auto bg-secondary p-3 rounded-full w-fit">
                    <Frown className="h-8 w-8 text-secondary-foreground" />
                </div>
                <CardTitle className="font-headline text-2xl mt-4">No Matches Found Yet</CardTitle>
                <CardDescription>
                    We couldn't find any relatives in our database at this time. As more users join, you may get new matches.
                </CardDescription>
            </CardHeader>
         </Card>
      )}

      {!isAnalyzing && analysisCompleted && relatives && relatives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {relatives.map((relative, index) => (
            <RelativeCard key={relative.userId || index} relative={relative} />
          ))}
        </div>
      )}
    </div>
  );
}
