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
  Menu,
  X,
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
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        className={`sidebar ${
          isMobile ? (sidebarOpen ? "translate-x-0" : "-translate-x-full") : ""
        }`}
      >
        <SidebarHeader className="bg-sidebar border-b border-sidebar-border">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <Logo className="h-10 w-28" />
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SidebarHeader>
        <SidebarContent className="bg-sidebar">
          <SidebarMenu className="px-2 py-4">
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className="block"
                >
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={{ children: item.label }}
                    className="w-full transition-all duration-300 ease-in-out hover:scale-105"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border bg-background md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden transition-all duration-300 hover:scale-110"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Logo className="h-8 w-20" />
          <div className="w-8" /> {/* Spacer for centering */}
        </div>
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
