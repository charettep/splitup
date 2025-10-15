import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Pages
import SplitPeriodsPage from "@/pages/split-periods";
import ExpensesPage from "@/pages/expenses";
import AssetsPage from "@/pages/assets";
import LedgerPage from "@/pages/ledger";
import ImportExportPage from "@/pages/import-export";
import NotFound from "@/pages/not-found";

// Landing page for logged-out users
function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h1 className="text-5xl font-bold mb-4">Splitup</h1>
        <p className="text-xl text-muted-foreground mb-8">
          AI-assisted breakup settlement for Quebec
        </p>
        <p className="text-lg mb-8">
          Track expenses, manage assets, and settle fairly with your ex-partner.
        </p>
        <a
          href="/api/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          data-testid="button-login"
        >
          Sign In / Sign Up
        </a>
      </div>
    </div>
  );
}

// Temporary home page (will be replaced with settlement selection)
function HomePage() {
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-3xl font-bold mb-6">Your Settlements</h1>
      <p className="text-muted-foreground mb-8">
        Settlement selection page coming soon. For now, redirecting to split periods...
      </p>
      <Redirect to="/split-periods" />
    </div>
  );
}

// Protected route wrapper with unauthorized handling
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={HomePage} />} />
      <Route path="/split-periods" component={() => <ProtectedRoute component={SplitPeriodsPage} />} />
      <Route path="/expenses" component={() => <ProtectedRoute component={ExpensesPage} />} />
      <Route path="/assets" component={() => <ProtectedRoute component={AssetsPage} />} />
      <Route path="/ledger" component={() => <ProtectedRoute component={LedgerPage} />} />
      <Route path="/import-export" component={() => <ProtectedRoute component={ImportExportPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Authenticated users see the main app with sidebar
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between h-16 px-4 border-b gap-4 sticky top-0 bg-background z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="hidden md:block">
                <h2 className="font-semibold">Splitup</h2>
                <p className="text-xs text-muted-foreground">
                  AI-assisted breakup settlement
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <a
                href="/api/logout"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-logout"
              >
                Logout
              </a>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <AuthenticatedRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
