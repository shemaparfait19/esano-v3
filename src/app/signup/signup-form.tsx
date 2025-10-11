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
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, KeyRound, Mail } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/types/firestore";

const formSchema = z.object({
  displayName: z
    .string()
    .min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
  familyCode: z.string().optional(),
});

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      familyCode: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      // Update Firebase Auth profile
      await updateProfile(user, { displayName: values.displayName });

      // Handle family code if provided
      let familyCodeData = {};
      if (values.familyCode && values.familyCode.trim()) {
        // Validate family code
        const codeResponse = await fetch("/api/family-code/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: values.familyCode.trim() }),
        });

        if (codeResponse.ok) {
          const codeData = await codeResponse.json();
          familyCodeData = {
            familyCode: values.familyCode.trim(),
            isFamilyHead: false, // New users are not family heads
          };
        } else {
          toast({
            title: "Invalid Family Code",
            description: "The family code you entered is not valid.",
            variant: "destructive",
          });
          return;
        }
      }

      // Create user profile in Firestore
      const userProfile: UserProfile = {
        userId: user.uid,
        email: values.email,
        displayName: values.displayName,
        ...familyCodeData,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", user.uid), userProfile);

      toast({
        title: "Account Created",
        description: "You have been successfully signed up.",
      });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Signup failed:", error);
      toast({
        title: "Signup Failed",
        description:
          error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input placeholder="John Doe" {...field} className="pl-9" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input
                    placeholder="name@example.com"
                    {...field}
                    className="pl-9"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    {...field}
                    className="pl-9"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="familyCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Family Code (Optional)</FormLabel>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input
                    placeholder="XXXX-XXXX"
                    {...field}
                    className="pl-9"
                    maxLength={9}
                    onChange={(e) => {
                      // Format as XXXX-XXXX
                      let value = e.target.value
                        .replace(/[^A-Z0-9]/g, "")
                        .toUpperCase();
                      if (value.length > 4) {
                        value = value.slice(0, 4) + "-" + value.slice(4, 8);
                      }
                      field.onChange(value);
                    }}
                  />
                </FormControl>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a family code to join an existing family tree, or leave
                blank to start your own
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
      </form>
    </Form>
  );
}
