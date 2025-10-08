"use client";

import { DnaUploadForm } from "@/components/dashboard/dna-upload-form";
import { DnaMatchFinder } from "@/components/dashboard/dna-match-finder";
import { useAuth } from "@/contexts/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dna, FileCheck, Lock, TestTube2 } from "lucide-react";

export default function DnaAnalysisPage() {
  const { user } = useAuth() as any;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          DNA Analysis
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Upload your raw DNA data to begin the discovery process.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary flex items-center gap-3">
            <Dna className="h-7 w-7" />
            Upload Your DNA File
          </CardTitle>
          <CardDescription>
            Drag and drop your file or click to browse. Analysis may take a few
            moments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DnaUploadForm />
        </CardContent>
      </Card>

      {user && <DnaMatchFinder userId={user.uid} />}

      <div className="grid md:grid-cols-3 gap-6 text-center">
        <Card>
          <CardHeader className="items-center">
            <div className="bg-primary/10 p-3 rounded-full">
              <FileCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-lg mt-2">
              Supported Formats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              We accept files from major providers like Ancestry, 23andMe, and
              MyHeritage.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="items-center">
            <div className="bg-primary/10 p-3 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-lg mt-2">
              Secure & Private
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Your data is encrypted and stored securely. You control your
              privacy settings.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="items-center">
            <div className="bg-primary/10 p-3 rounded-full">
              <TestTube2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-lg mt-2">
              Powerful Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Our AI provides insights into relatives, ancestry, and
              generational traits.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
