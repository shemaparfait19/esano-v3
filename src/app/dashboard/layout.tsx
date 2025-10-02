"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart,
  Bot,
  Dna,
  Globe,
  LayoutGrid,
  Users,
  Loader2,
  Search,
} from "lucide-react";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";

const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/dashboard/dna-analysis", icon: Dna, label: "DNA Analysis" },
  { href: "/dashboard/relatives", icon: Users, label: "Relatives" },
  { href: "/dashboard/profile", icon: Users, label: "Profile" },
  { href: "/dashboard/family-tree", icon: Globe, label: "Family Tree" },
  { href: "/dashboard/ancestry", icon: Globe, label: "Ancestry" },
  { href: "/dashboard/insights", icon: BarChart, label: "Insights" },
  { href: "/dashboard/assistant", icon: Bot, label: "Assistant" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && pathname.startsWith("/dashboard")) {
      const isOnSetup = pathname === "/dashboard/profile-setup";
      if (!userProfile?.profileCompleted && !isOnSetup) {
        router.replace("/dashboard/profile-setup");
      }
    }
  }, [loading, user, userProfile, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo className="size-8" />
            <span className="font-headline text-lg font-bold text-primary group-data-[collapsible=icon]:hidden">
              Esano
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={{ children: item.label }}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
