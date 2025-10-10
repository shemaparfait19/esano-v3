"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveUserDna, analyzeDna } from "@/app/actions";
import { DnaProfileManager } from "@/components/dashboard/dna-profile-manager";
import { LocationSelector } from "@/components/ui/location-selector";
import {
  User,
  Calendar,
  Users,
  Globe,
  CreditCard,
  Heart,
  Phone,
  Mail,
  MapPin,
  Languages,
  Camera,
  GraduationCap,
  Briefcase,
  Building,
  Award,
  Clock,
} from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    // Personal Information
    firstName: "",
    middleName: "",
    lastName: "",
    preferredName: "",
    birthDate: "",
    gender: "",
    nationality: "",
    nid: "",
    maritalStatus: "",
    phoneNumber: "",
    email: "",
    province: "",
    district: "",
    sector: "",
    cell: "",
    village: "",
    preferredLanguage: "",
    profilePicture: "",
    // Residence Information
    residenceProvince: "",
    residenceDistrict: "",
    residenceSector: "",
    residenceCell: "",
    residenceVillage: "",
    streetName: "",
    // Legacy fields for compatibility
    fullName: "",
    birthPlace: "",
    clanOrCulturalInfo: "",
    relativesNames: "",
    socialMedias: "",
    location: "",
    spouseName: "",
    // Education and Work as arrays
    education: [] as any[],
    work: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  // DNA upload state
  const [dnaFile, setDnaFile] = useState<File | null>(null);
  const [dnaSaving, setDnaSaving] = useState(false);
  const [dnaAnalyzing, setDnaAnalyzing] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && !ignore) {
        const d = snap.data() as any;
        setForm({
          // Personal Information
          firstName: d.firstName ?? "",
          middleName: d.middleName ?? "",
          lastName: d.lastName ?? "",
          preferredName: d.preferredName ?? "",
          birthDate: d.birthDate ?? "",
          gender: d.gender ?? "",
          nationality: d.nationality ?? "",
          nid: d.nid ?? "",
          maritalStatus: d.maritalStatus ?? "",
          phoneNumber: d.phoneNumber ?? "",
          email: d.email ?? "",
          province: d.province ?? "",
          district: d.district ?? "",
          sector: d.sector ?? "",
          cell: d.cell ?? "",
          village: d.village ?? "",
          preferredLanguage: d.preferredLanguage ?? "",
          profilePicture: d.profilePicture ?? "",
          // Residence Information
          residenceProvince: d.residenceProvince ?? "",
          residenceDistrict: d.residenceDistrict ?? "",
          residenceSector: d.residenceSector ?? "",
          residenceCell: d.residenceCell ?? "",
          residenceVillage: d.residenceVillage ?? "",
          streetName: d.streetName ?? "",
          // Legacy fields for compatibility
          fullName: d.fullName ?? "",
          birthPlace: d.birthPlace ?? "",
          clanOrCulturalInfo: d.clanOrCulturalInfo ?? "",
          relativesNames: (d.relativesNames ?? []).join(", "),
          socialMedias: d.socialMedias ?? "",
          location: d.location ?? "",
          spouseName: d.spouseName ?? "",
          // Education and Work as arrays
          education: Array.isArray(d.education) ? d.education : [],
          work: Array.isArray(d.work) ? d.work : [],
        });
      }
      setLoading(false);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user]);

  const onSave = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your profile.",
        variant: "destructive",
      });
      return;
    }
    try {
      console.log("Starting save operation for user:", user.uid);
      const relatives = form.relativesNames
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Build data object, filtering out empty/undefined values
      const dataToSave: any = {
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        profileCompleted: true,
      };

      // Personal Information - only add non-empty values
      if (form.firstName?.trim()) dataToSave.firstName = form.firstName.trim();
      if (form.middleName?.trim())
        dataToSave.middleName = form.middleName.trim();
      if (form.lastName?.trim()) dataToSave.lastName = form.lastName.trim();
      if (form.preferredName?.trim())
        dataToSave.preferredName = form.preferredName.trim();
      if (form.birthDate) dataToSave.birthDate = form.birthDate;
      if (form.gender) dataToSave.gender = form.gender;
      if (form.nationality?.trim())
        dataToSave.nationality = form.nationality.trim();
      if (form.nid?.trim()) dataToSave.nid = form.nid.trim();
      if (form.maritalStatus) dataToSave.maritalStatus = form.maritalStatus;
      if (form.phoneNumber?.trim())
        dataToSave.phoneNumber = form.phoneNumber.trim();
      if (form.email?.trim()) dataToSave.email = form.email.trim();
      if (form.province?.trim()) dataToSave.province = form.province.trim();
      if (form.district?.trim()) dataToSave.district = form.district.trim();
      if (form.sector?.trim()) dataToSave.sector = form.sector.trim();
      if (form.cell?.trim()) dataToSave.cell = form.cell.trim();
      if (form.village?.trim()) dataToSave.village = form.village.trim();
      if (form.preferredLanguage)
        dataToSave.preferredLanguage = form.preferredLanguage;
      if (form.profilePicture?.trim())
        dataToSave.profilePicture = form.profilePicture.trim();

      // Residence Information
      if (form.residenceProvince?.trim())
        dataToSave.residenceProvince = form.residenceProvince.trim();
      if (form.residenceDistrict?.trim())
        dataToSave.residenceDistrict = form.residenceDistrict.trim();
      if (form.residenceSector?.trim())
        dataToSave.residenceSector = form.residenceSector.trim();
      if (form.residenceCell?.trim())
        dataToSave.residenceCell = form.residenceCell.trim();
      if (form.residenceVillage?.trim())
        dataToSave.residenceVillage = form.residenceVillage.trim();
      if (form.streetName?.trim())
        dataToSave.streetName = form.streetName.trim();

      // Legacy fields for compatibility
      if (form.fullName?.trim()) dataToSave.fullName = form.fullName.trim();
      if (form.birthPlace?.trim())
        dataToSave.birthPlace = form.birthPlace.trim();
      if (form.clanOrCulturalInfo?.trim())
        dataToSave.clanOrCulturalInfo = form.clanOrCulturalInfo.trim();
      if (relatives.length > 0) dataToSave.relativesNames = relatives;
      if (form.socialMedias?.trim())
        dataToSave.socialMedias = form.socialMedias.trim();
      if (form.location?.trim()) dataToSave.location = form.location.trim();
      if (form.spouseName?.trim())
        dataToSave.spouseName = form.spouseName.trim();

      // Education and Work as arrays - only add if they have content
      if (form.education.length > 0) dataToSave.education = form.education;
      if (form.work.length > 0) dataToSave.work = form.work;

      console.log("Data to save:", dataToSave);

      await setDoc(doc(db, "users", user.uid), dataToSave, { merge: true });

      console.log("Save operation completed successfully");
      toast({ title: "Profile updated successfully" });
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Save failed",
        description:
          error?.message ||
          "An error occurred while saving your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  async function handleSaveDna() {
    if (!user || !dnaFile) {
      toast({
        title: "No file selected",
        description: "Choose a DNA file first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setDnaSaving(true);
      const text = await dnaFile.text();
      const res = await saveUserDna(user.uid, text, dnaFile.name);
      if (!res.ok) {
        toast({
          title: "Save failed",
          description: res.error ?? "",
          variant: "destructive",
        });
      } else {
        toast({ title: "DNA saved", description: `Stored ${dnaFile.name}` });
      }
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Try again",
        variant: "destructive",
      });
    } finally {
      setDnaSaving(false);
    }
  }

  async function handleAnalyzeDna() {
    if (!user || !dnaFile) {
      toast({
        title: "No file selected",
        description: "Choose a DNA file first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setDnaAnalyzing(true);
      const text = await dnaFile.text();
      await analyzeDna(user.uid, text, dnaFile.name);
      toast({
        title: "Analysis Complete",
        description: "Open Relatives/Ancestry/Insights to view results.",
      });
    } catch (e: any) {
      toast({
        title: "Analysis failed",
        description: e?.message ?? "Try again",
        variant: "destructive",
      });
    } finally {
      setDnaAnalyzing(false);
    }
  }

  if (loading) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          Your Profile
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Build your family profile with as much or as little information as
          you'd like. All details are optional and help improve AI-powered
          genealogy suggestions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">
            Profile
          </CardTitle>
          <CardDescription>
            Fill in your information to improve AI suggestions. All fields are
            optional - provide as much or as little detail as you prefer. Basic
            information like name and location helps provide better personalized
            recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="font-headline text-lg text-primary mb-4">
              Personal Information (Optional)
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Middle Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.middleName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, middleName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Preferred Name / Nickname
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.preferredName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, preferredName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="date"
                    value={form.birthDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, birthDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Gender</label>
                <div className="relative">
                  <Select
                    value={form.gender}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, gender: value }))
                    }
                  >
                    <SelectTrigger className="pl-10">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Nationality</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.nationality}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nationality: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">
                  ID / National Number
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.nid}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nid: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Marital Status</label>
                <div className="relative">
                  <Select
                    value={form.maritalStatus}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, maritalStatus: value }))
                    }
                  >
                    <SelectTrigger className="pl-10">
                      <Heart className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                      <SelectItem value="separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.phoneNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="md:col-span-4">
                <label className="text-sm font-medium mb-2 block">
                  Birth Location
                </label>
                <LocationSelector
                  province={form.province}
                  district={form.district}
                  sector={form.sector}
                  village={form.village}
                  onLocationChange={(location) =>
                    setForm((f) => ({
                      ...f,
                      province: location.province,
                      district: location.district,
                      sector: location.sector,
                      village: location.village,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Preferred Language
                </label>
                <div className="relative">
                  <Select
                    value={form.preferredLanguage}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, preferredLanguage: value }))
                    }
                  >
                    <SelectTrigger className="pl-10">
                      <Languages className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kinyarwanda">Kinyarwanda</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="swahili">Swahili</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Profile Picture</label>
                <div className="relative">
                  <Camera className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        console.log(
                          "File selected:",
                          file.name,
                          file.size,
                          file.type
                        );
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          if (user?.uid) formData.append("userId", user.uid);
                          console.log("Sending FormData to API");

                          const response = await fetch(
                            "/api/upload-profile-picture",
                            {
                              method: "POST",
                              body: formData,
                            }
                          );

                          console.log("API response status:", response.status);

                          if (response.ok) {
                            const data = await response.json();
                            console.log("Upload successful, URL:", data.url);
                            // Avoid saving giant data URLs directly in profile to bypass 1MB field limit
                            setForm((f) => ({
                              ...f,
                              profilePicture: data.url,
                            }));
                            toast({
                              title: "Profile picture uploaded successfully",
                            });
                          } else {
                            let errorMsg = "Failed to upload profile picture";
                            try {
                              const err = await response.json();
                              errorMsg = err?.error || errorMsg;
                            } catch {}
                            console.log("Upload failed:", errorMsg);
                            toast({
                              title: "Upload failed",
                              description: errorMsg,
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          console.error("Error uploading file:", error);
                          toast({
                            title: "Upload failed",
                            description:
                              "An error occurred while uploading the file",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  />
                </div>
                {form.profilePicture && (
                  <div className="mt-2">
                    <img
                      src={form.profilePicture}
                      alt="Profile preview"
                      className="w-20 h-20 object-cover rounded-full border"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-headline text-lg text-primary mb-4">
              Residence Information (Optional)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Residence Location
                </label>
                <LocationSelector
                  province={form.residenceProvince}
                  district={form.residenceDistrict}
                  sector={form.residenceSector}
                  village={form.residenceVillage}
                  onLocationChange={(location) =>
                    setForm((f) => ({
                      ...f,
                      residenceProvince: location.province,
                      residenceDistrict: location.district,
                      residenceSector: location.sector,
                      residenceVillage: location.village,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Street Name</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={form.streetName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, streetName: e.target.value }))
                    }
                    placeholder="e.g., KG 123 St"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-headline text-lg text-primary mb-4">
              Education Information (Optional)
            </h3>
            <div className="space-y-4">
              {(form.education || []).map((edu, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Education #{index + 1}</h4>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          education: f.education.filter((_, i) => i !== index),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">
                        Institution Type
                      </label>
                      <div className="relative">
                        <Select
                          value={edu.institutionType}
                          onValueChange={(value) => {
                            const newEdu = [...form.education];
                            newEdu[index] = {
                              ...newEdu[index],
                              institutionType: value,
                            };
                            setForm((f) => ({ ...f, education: newEdu }));
                          }}
                        >
                          <SelectTrigger className="pl-10">
                            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="school">School</SelectItem>
                            <SelectItem value="college">College</SelectItem>
                            <SelectItem value="university">
                              University
                            </SelectItem>
                            <SelectItem value="training">
                              Training Center
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Institution Name
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          value={edu.institutionName}
                          onChange={(e) => {
                            const newEdu = [...form.education];
                            newEdu[index] = {
                              ...newEdu[index],
                              institutionName: e.target.value,
                            };
                            setForm((f) => ({ ...f, education: newEdu }));
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Level of Education
                      </label>
                      <div className="relative">
                        <Select
                          value={edu.level}
                          onValueChange={(value) => {
                            const newEdu = [...form.education];
                            newEdu[index] = { ...newEdu[index], level: value };
                            setForm((f) => ({ ...f, education: newEdu }));
                          }}
                        >
                          <SelectTrigger className="pl-10">
                            <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">Primary</SelectItem>
                            <SelectItem value="secondary">Secondary</SelectItem>
                            <SelectItem value="high_school">
                              High School
                            </SelectItem>
                            <SelectItem value="diploma">Diploma</SelectItem>
                            <SelectItem value="bachelor">Bachelor's</SelectItem>
                            <SelectItem value="master">Master's</SelectItem>
                            <SelectItem value="phd">PhD</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Field of Study
                      </label>
                      <div className="relative">
                        <Select
                          value={edu.fieldOfStudy}
                          onValueChange={(value) => {
                            const newEdu = [...form.education];
                            newEdu[index] = {
                              ...newEdu[index],
                              fieldOfStudy: value,
                            };
                            setForm((f) => ({ ...f, education: newEdu }));
                          }}
                        >
                          <SelectTrigger className="pl-10">
                            <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="science">Science</SelectItem>
                            <SelectItem value="arts">Arts</SelectItem>
                            <SelectItem value="it">IT</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="agriculture">
                              Agriculture
                            </SelectItem>
                            <SelectItem value="health">Health</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Start Year</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          type="number"
                          value={edu.startYear}
                          onChange={(e) => {
                            const newEdu = [...form.education];
                            newEdu[index] = {
                              ...newEdu[index],
                              startYear: e.target.value,
                            };
                            setForm((f) => ({ ...f, education: newEdu }));
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">End Year</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          type="number"
                          value={edu.endYear}
                          onChange={(e) => {
                            const newEdu = [...form.education];
                            newEdu[index] = {
                              ...newEdu[index],
                              endYear: e.target.value,
                            };
                            setForm((f) => ({ ...f, education: newEdu }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">
                        Result / Grade
                      </label>
                      <div className="relative">
                        <Select
                          value={edu.result}
                          onValueChange={(value) => {
                            const newEdu = [...form.education];
                            newEdu[index] = { ...newEdu[index], result: value };
                            setForm((f) => ({ ...f, education: newEdu }));
                          }}
                        >
                          <SelectTrigger className="pl-10">
                            <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <SelectValue placeholder="Select result" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="very_good">Very Good</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="average">Average</SelectItem>
                            <SelectItem value="pass">Pass/Fail</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    education: [
                      ...f.education,
                      {
                        institutionType: "",
                        institutionName: "",
                        level: "",
                        fieldOfStudy: "",
                        startYear: "",
                        endYear: "",
                        result: "",
                      },
                    ],
                  }));
                }}
              >
                Add Education
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-headline text-lg text-primary mb-4">
              Work/Job Information (Optional)
            </h3>
            <div className="space-y-4">
              {(form.work || []).map((job, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Job #{index + 1}</h4>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          work: f.work.filter((_, i) => i !== index),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">
                        Company / Organization Name
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          value={job.companyName}
                          onChange={(e) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              companyName: e.target.value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Company Type
                      </label>
                      <div className="relative">
                        <Select
                          value={job.companyType}
                          onValueChange={(value) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              companyType: value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        >
                          <SelectTrigger className="pl-10">
                            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="government">
                              Government
                            </SelectItem>
                            <SelectItem value="ngo">NGO</SelectItem>
                            <SelectItem value="self_employed">
                              Self-employed
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Job Title / Role
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          value={job.jobTitle}
                          onChange={(e) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              jobTitle: e.target.value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Department / Team
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          value={job.department}
                          onChange={(e) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              department: e.target.value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Employment Type
                      </label>
                      <div className="relative">
                        <Select
                          value={job.employmentType}
                          onValueChange={(value) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              employmentType: value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        >
                          <SelectTrigger className="pl-10">
                            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_time">Full-time</SelectItem>
                            <SelectItem value="part_time">Part-time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="internship">
                              Internship
                            </SelectItem>
                            <SelectItem value="freelance">Freelance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Start Year</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          type="number"
                          value={job.startYear}
                          onChange={(e) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              startYear: e.target.value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">End Year</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          type="number"
                          value={job.endYear}
                          onChange={(e) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              endYear: e.target.value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          value={job.location}
                          onChange={(e) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              location: e.target.value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">
                        Skills Used / Technologies
                      </label>
                      <div className="relative">
                        <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          value={job.skills}
                          onChange={(e) => {
                            const newWork = [...form.work];
                            newWork[index] = {
                              ...newWork[index],
                              skills: e.target.value,
                            };
                            setForm((f) => ({ ...f, work: newWork }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    work: [
                      ...f.work,
                      {
                        companyName: "",
                        companyType: "",
                        jobTitle: "",
                        department: "",
                        employmentType: "",
                        startYear: "",
                        endYear: "",
                        location: "",
                        skills: "",
                      },
                    ],
                  }));
                }}
              >
                Add Job
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Button onClick={onSave}>Save Profile</Button>
              <p className="text-sm text-muted-foreground mt-2">
                Save anytime - you can always add more information later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DnaProfileManager />

      <DnaProfileManager />
    </div>
  );
}
