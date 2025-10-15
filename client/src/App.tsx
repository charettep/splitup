import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { SettlementProvider } from "@/lib/settlementContext";
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

// Dashboard - Settlement selection/creation
function DashboardPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Settlements</h1>
            <p className="text-muted-foreground">
              Manage your breakup settlements or create a new one
            </p>
          </div>
          <a
            href="/api/logout"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-logout"
          >
            Logout
          </a>
        </div>
        
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            Settlement management UI coming soon
          </p>
          <p className="text-sm text-muted-foreground">
            For testing, navigate to: <code className="bg-muted px-2 py-1 rounded">/settle/[name]/split-periods</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// Settlement Layout - Wraps all settlement-scoped routes
function SettlementLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SettlementProvider>
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
                  href="/"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-dashboard"
                >
                  Dashboard
                </a>
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
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </SettlementProvider>
  );
}

// Protected route wrapper with unauthorized handling
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

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

  return (
    <Switch>
      {/* Landing page for logged-out users */}
      {!isAuthenticated && <Route path="/" component={LandingPage} />}
      
      {/* Authenticated routes */}
      {isAuthenticated && (
        <>
          {/* Dashboard - Settlement selection/creation */}
          <Route path="/" component={DashboardPage} />
          
          {/* Settlement default redirect */}
          <Route path="/settle/:settlementName">
            {(params) => <Redirect to={`/settle/${params.settlementName}/split-periods`} />}
          </Route>
          
          {/* Settlement-scoped routes */}
          <Route path="/settle/:settlementName/split-periods">
            <SettlementLayout>
              <SplitPeriodsPage />
            </SettlementLayout>
          </Route>
          
          <Route path="/settle/:settlementName/expenses">
            <SettlementLayout>
              <ExpensesPage />
            </SettlementLayout>
          </Route>
          
          <Route path="/settle/:settlementName/assets">
            <SettlementLayout>
              <AssetsPage />
            </SettlementLayout>
          </Route>
          
          <Route path="/settle/:settlementName/ledger">
            <SettlementLayout>
              <LedgerPage />
            </SettlementLayout>
          </Route>
          
          <Route path="/settle/:settlementName/import-export">
            <SettlementLayout>
              <ImportExportPage />
            </SettlementLayout>
          </Route>
        </>
      )}
      
      <Route component={NotFound} />
    </Switch>
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
