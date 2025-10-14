import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import SplitPeriodsPage from "@/pages/split-periods";
import ExpensesPage from "@/pages/expenses";
import AssetsPage from "@/pages/assets";
import LedgerPage from "@/pages/ledger";
import ImportExportPage from "@/pages/import-export";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/split-periods" />} />
      <Route path="/split-periods" component={SplitPeriodsPage} />
      <Route path="/expenses" component={ExpensesPage} />
      <Route path="/assets" component={AssetsPage} />
      <Route path="/ledger" component={LedgerPage} />
      <Route path="/import-export" component={ImportExportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <header className="flex items-center justify-between h-16 px-4 border-b gap-4 sticky top-0 bg-background z-10">
                <div className="flex items-center gap-3">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <div className="hidden md:block">
                    <h2 className="font-semibold">SplitSettleQC</h2>
                    <p className="text-xs text-muted-foreground">
                      AI-assisted breakup settlement
                    </p>
                  </div>
                </div>
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
