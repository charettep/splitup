import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Edit2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { SplitPeriodForm } from "@/components/split-period-form";
import { useSettlement } from "@/lib/settlementContext";
import type { SplitPeriod } from "@shared/schema";

export default function SplitPeriodsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<SplitPeriod | null>(null);
  const { settlement, person1, person2 } = useSettlement();

  const { data: periods, isLoading } = useQuery<SplitPeriod[]>({
    queryKey: ["/api/split-periods", { settlementId: settlement.id }],
  });

  const handleEdit = (period: SplitPeriod) => {
    setEditingPeriod(period);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPeriod(null);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Ongoing";
    // Format as yyyy/mm/dd
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Split Periods</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Define percentage ownership for different time windows
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const sortedPeriods = [...(periods || [])].sort((a, b) => {
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const person1Name = person1?.personName || "Person 1";
  const person2Name = person2?.personName || "Person 2";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Split Periods
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define percentage ownership for different time windows
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-period">
              <Plus className="w-4 h-4 mr-2" />
              Add Period
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingPeriod ? "Edit Split Period" : "Add Split Period"}
              </DialogTitle>
              <DialogDescription>
                {editingPeriod
                  ? "Update the percentage shares for this period"
                  : "Create a new time window with percentage shares"}
              </DialogDescription>
            </DialogHeader>
            <SplitPeriodForm
              period={editingPeriod}
              onSuccess={handleCloseDialog}
              settlementId={settlement.id}
            />
          </DialogContent>
        </Dialog>
      </div>

      {sortedPeriods.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <Calendar className="w-12 h-12 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">No split periods yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first split period to start tracking expenses and assets
              </p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first">
              <Plus className="w-4 h-4 mr-2" />
              Create First Period
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedPeriods.map((period) => {
            const isOngoing = !period.endDate;
            const person1Pct = parseFloat(period.person1SharePct);
            const person2Pct = parseFloat(period.person2SharePct);
            const totalPct = person1Pct + person2Pct;
            const isInvalid = Math.abs(totalPct - 100) > 0.01;

            return (
              <Card
                key={period.id}
                className="relative overflow-hidden"
                data-testid={`card-period-${period.id}`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{
                    background: `linear-gradient(to bottom, hsl(var(--philippe-color)), hsl(var(--ex-color)))`,
                  }}
                />
                <CardHeader className="pb-3 gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {formatDate(period.startDate)} {!isOngoing && `→ ${formatDate(period.endDate)}`}
                      </CardTitle>
                      {isOngoing && (
                        <Badge variant="secondary" className="mt-1">
                          Ongoing
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(period)}
                        data-testid={`button-edit-${period.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {period.note && (
                    <CardDescription className="text-xs line-clamp-2">
                      {period.note}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {isInvalid && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Shares don't sum to 100%
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{person1Name}</span>
                      <span className="font-mono font-semibold text-philippe">
                        {person1Pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{person2Name}</span>
                      <span className="font-mono font-semibold text-ex">
                        {person2Pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
