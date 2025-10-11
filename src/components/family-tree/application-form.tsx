"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Users, Heart, Info } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const applicationSchema = z.object({
  reasonForTree: z
    .string()
    .min(10, {
      message: "Please provide a detailed reason (at least 10 characters)",
    }),
  familyBackground: z
    .string()
    .min(20, {
      message: "Please provide your family background (at least 20 characters)",
    }),
  expectedMembers: z
    .number()
    .min(1, { message: "Expected members must be at least 1" })
    .max(1000, { message: "Expected members cannot exceed 1000" }),
  culturalSignificance: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export function FamilyTreeApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      reasonForTree: "",
      familyBackground: "",
      expectedMembers: 10,
      culturalSignificance: "",
      additionalInfo: "",
    },
  });

  const onSubmit = async (data: ApplicationFormData) => {
    if (!user || !userProfile) {
      toast({
        title: "Error",
        description: "You must be logged in to submit an application",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/family-tree/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          userFullName:
            userProfile.displayName || userProfile.fullName || "User",
          applicationData: data,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Application Submitted",
          description:
            "Your family tree application has been submitted for review. You will be notified of the decision.",
        });
        form.reset();
      } else {
        toast({
          title: "Submission Failed",
          description: result.error || "Failed to submit application",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Family Tree Creation Application
        </CardTitle>
        <CardDescription>
          Submit an application to create your own family tree. Our team will
          review your request and get back to you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="reasonForTree"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Reason for Creating Family Tree
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please explain why you want to create a family tree. What is your motivation? How will this benefit your family?"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="familyBackground"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Family Background
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about your family. Where are you from? What is your cultural background? Any significant family history or stories?"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expectedMembers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Number of Family Members</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="1000"
                      placeholder="10"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    How many family members do you expect to include in your
                    tree?
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="culturalSignificance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cultural Significance (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Does your family tree have any special cultural, historical, or community significance? Any notable ancestors or family traditions?"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Information (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional information you'd like to share about your family or your plans for the family tree?"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Review Process</p>
                  <p>
                    Your application will be reviewed by our team within 2-3
                    business days. You will receive a notification with the
                    decision and any feedback.
                  </p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit Application
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
