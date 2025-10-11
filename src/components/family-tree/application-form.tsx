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
import {
  Loader2,
  FileText,
  Users,
  Heart,
  Info,
  Upload,
  Checkbox,
  Shield,
  User,
  Phone,
  MapPin,
  IdCard,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Checkbox as UICheckbox } from "@/components/ui/checkbox";

const applicationSchema = z.object({
  // Personal Information
  fullName: z.string().min(2, "Full name is required"),
  nationalId: z.string().min(16, "National ID must be at least 16 characters"),
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  address: z.string().min(10, "Address is required"),

  // Family Information
  reasonForTree: z.string().min(10, {
    message: "Please provide a detailed reason (at least 10 characters)",
  }),
  familyBackground: z.string().min(20, {
    message: "Please provide your family background (at least 20 characters)",
  }),
  expectedMembers: z
    .number()
    .min(1, { message: "Expected members must be at least 1" })
    .max(1000, { message: "Expected members cannot exceed 1000" }),

  // Legal Information
  isLegalGuardian: z.boolean(),
  guardianName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianContact: z.string().optional(),

  // Cultural and Additional Information
  culturalSignificance: z.string().optional(),
  additionalInfo: z.string().optional(),

  // Legal Declarations
  agreeToTerms: z
    .boolean()
    .refine((val) => val === true, "You must agree to the terms"),
  confirmAccuracy: z
    .boolean()
    .refine((val) => val === true, "You must confirm accuracy"),
  consentToVerification: z
    .boolean()
    .refine((val) => val === true, "You must consent to verification"),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export function FamilyTreeApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<{
    nationalId?: File;
    proofOfFamily?: File;
    guardianConsent?: File;
  }>({});
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      fullName: "",
      nationalId: "",
      phoneNumber: "",
      address: "",
      reasonForTree: "",
      familyBackground: "",
      expectedMembers: 10,
      isLegalGuardian: false,
      guardianName: "",
      guardianRelationship: "",
      guardianContact: "",
      culturalSignificance: "",
      additionalInfo: "",
      agreeToTerms: false,
      confirmAccuracy: false,
      consentToVerification: false,
    },
  });

  const handleDocumentUpload = (
    type: keyof typeof uploadedDocuments,
    file: File
  ) => {
    setUploadedDocuments((prev) => ({ ...prev, [type]: file }));
  };

  const onSubmit = async (data: ApplicationFormData) => {
    if (!user || !userProfile) {
      toast({
        title: "Error",
        description: "You must be logged in to submit an application",
        variant: "destructive",
      });
      return;
    }

    // Check if required documents are uploaded
    if (!uploadedDocuments.nationalId) {
      toast({
        title: "Missing Document",
        description: "Please upload your National ID",
        variant: "destructive",
      });
      return;
    }

    if (!uploadedDocuments.proofOfFamily) {
      toast({
        title: "Missing Document",
        description: "Please upload proof of family relationship",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("userId", user.uid);
      formData.append("userEmail", user.email || "");
      formData.append(
        "userFullName",
        userProfile.displayName || userProfile.fullName || "User"
      );
      formData.append("applicationData", JSON.stringify(data));

      if (uploadedDocuments.nationalId) {
        formData.append("nationalId", uploadedDocuments.nationalId);
      }
      if (uploadedDocuments.proofOfFamily) {
        formData.append("proofOfFamily", uploadedDocuments.proofOfFamily);
      }
      if (uploadedDocuments.guardianConsent) {
        formData.append("guardianConsent", uploadedDocuments.guardianConsent);
      }

      const response = await fetch("/api/family-tree/application", {
        method: "POST",
        body: formData,
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
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Family Tree Creation Application
          </CardTitle>
          <CardDescription>
            Submit a comprehensive application to create your own family tree.
            Our team will review your request and get back to you within 2-3
            business days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Personal Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your full name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nationalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <IdCard className="h-4 w-4" />
                          National ID Number
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your National ID"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Number
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your phone number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Address
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Family Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Family Information
                </h3>

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
                      <FormLabel>Family Background</FormLabel>
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
              </div>

              {/* Legal Guardian Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Legal Guardian Information
                </h3>

                <FormField
                  control={form.control}
                  name="isLegalGuardian"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <UICheckbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I am the legal guardian or have legal authority to
                          create this family tree
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("isLegalGuardian") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="guardianName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guardian Name (if applicable)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter guardian name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="guardianRelationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship to Guardian</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Parent, Legal Guardian"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="guardianContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guardian Contact</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone or email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Document Upload Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Required Documents
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      National ID (Required)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentUpload("nationalId", file);
                        }}
                        className="hidden"
                        id="nationalId"
                      />
                      <label htmlFor="nationalId" className="cursor-pointer">
                        {uploadedDocuments.nationalId ? (
                          <div className="text-green-600">
                            <p className="font-medium">
                              ✓ {uploadedDocuments.nationalId.name}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Click to upload National ID
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Proof of Family Relationship (Required)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentUpload("proofOfFamily", file);
                        }}
                        className="hidden"
                        id="proofOfFamily"
                      />
                      <label htmlFor="proofOfFamily" className="cursor-pointer">
                        {uploadedDocuments.proofOfFamily ? (
                          <div className="text-green-600">
                            <p className="font-medium">
                              ✓ {uploadedDocuments.proofOfFamily.name}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Click to upload proof
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Guardian Consent (If applicable)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            handleDocumentUpload("guardianConsent", file);
                        }}
                        className="hidden"
                        id="guardianConsent"
                      />
                      <label
                        htmlFor="guardianConsent"
                        className="cursor-pointer"
                      >
                        {uploadedDocuments.guardianConsent ? (
                          <div className="text-green-600">
                            <p className="font-medium">
                              ✓ {uploadedDocuments.guardianConsent.name}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Click to upload consent
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Additional Information
                </h3>

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
              </div>

              {/* Legal Declarations */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Legal Declarations
                </h3>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="agreeToTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <UICheckbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to the Terms of Service and Privacy Policy
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmAccuracy"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <UICheckbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I confirm that all information provided is accurate
                            and truthful
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="consentToVerification"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <UICheckbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I consent to verification of the provided documents
                            and information
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Review Process</p>
                    <p>
                      Your application will be reviewed by our team within 2-3
                      business days. You will receive a notification with the
                      decision and any feedback. All documents will be securely
                      stored and used only for verification purposes.
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
    </div>
  );
}
