import { useQuery, useMutation } from "@tanstack/react-query";
import { Download, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { OwedLine } from "@shared/schema";

export default function LedgerPage() {
  const { toast } = useToast();
  
  const { data: ledgerData, isLoading } = useQuery<{
    sheOwesPhilippe: OwedLine[];
    philippeOwesHer: OwedLine[];
    summary: {
      totalSheOwes: number;
      totalPhilippeOwes: number;
      netAmount: number;
      netDebtor: string;
    };
  }>({
    queryKey: ["/api/ledger"],
  });

  const togglePaidMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      return apiRequest("PATCH", `/api/ledger/${id}/paid`, { paidStatus: paid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      toast({
        title: "Updated",
        description: "Payment status updated successfully",
      });
    },
  });

  const exportCSV = async (type: string) => {
    try {
      const response = await fetch(`/api/ledger/export/${type}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger_${type}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Exported",
        description: `Ledger data exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export ledger data",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string) => {
    // Format as yyyy/mm/dd
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `$${num.toFixed(2)}`;
  };

  const renderLedgerTable = (lines: OwedLine[], showOwedPhilippe: boolean) => {
    if (lines.length === 0) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <p>No transactions to display</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[120px] text-right">Total</TableHead>
              <TableHead className="w-[120px] text-right">
                {showOwedPhilippe ? "She Owes" : "He Owes"}
              </TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              // owedPhilippe = amount owed TO Philippe
              // owedEx = amount owed TO Ex
              const owedAmount = showOwedPhilippe
                ? parseFloat(line.owedPhilippe)
                : parseFloat(line.owedEx);

              return (
                <TableRow
                  key={line.id}
                  className={line.paidStatus ? "opacity-60" : ""}
                  data-testid={`row-ledger-${line.id}`}
                >
                  <TableCell className="font-mono text-sm">
                    {formatDate(line.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{line.description}</span>
                      {line.sourceType === "asset" && (
                        <Badge variant="outline" className="text-xs">
                          Buyback
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {line.category && (
                      <Badge variant="secondary" className="text-xs">
                        {line.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(line.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-positive">
                    {formatCurrency(owedAmount)}
                  </TableCell>
                  <TableCell>
                    {line.paidStatus ? (
                      <Badge variant="outline" className="border-positive text-positive">
                        <Check className="w-3 h-3 mr-1" />
                        Paid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/30">
                        Unpaid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        togglePaidMutation.mutate({
                          id: line.id,
                          paid: !line.paidStatus,
                        })
                      }
                      data-testid={`button-toggle-paid-${line.id}`}
                      className="h-8"
                    >
                      {line.paidStatus ? "Undo" : "Mark Paid"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Ledger</h1>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-96 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { sheOwesPhilippe = [], philippeOwesHer = [], summary } = ledgerData || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track who owes whom and settle accounts
          </p>
        </div>
      </div>

      <Tabs defaultValue="she-owes" className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList data-testid="tabs-ledger">
            <TabsTrigger value="she-owes" data-testid="tab-she-owes">
              She Owes Philippe ({sheOwesPhilippe.length})
            </TabsTrigger>
            <TabsTrigger value="philippe-owes" data-testid="tab-philippe-owes">
              Philippe Owes Her ({philippeOwesHer.length})
            </TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-summary">
              Summary
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV("she-owes")}
              data-testid="button-export-she-owes"
            >
              <Download className="w-4 h-4 mr-2" />
              Export She Owes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV("philippe-owes")}
              data-testid="button-export-philippe-owes"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Philippe Owes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV("all")}
              data-testid="button-export-all"
            >
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        <TabsContent value="she-owes" className="space-y-4">
          <Card>{renderLedgerTable(sheOwesPhilippe, true)}</Card>
        </TabsContent>

        <TabsContent value="philippe-owes" className="space-y-4">
          <Card>{renderLedgerTable(philippeOwesHer, false)}</Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">She Owes Philippe</p>
                  <p className="text-3xl font-mono font-bold text-philippe">
                    {formatCurrency(summary?.totalSheOwes || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sheOwesPhilippe.filter((l) => !l.paidStatus).length} unpaid items
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Philippe Owes Her</p>
                  <p className="text-3xl font-mono font-bold text-ex">
                    {formatCurrency(summary?.totalPhilippeOwes || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {philippeOwesHer.filter((l) => !l.paidStatus).length} unpaid items
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-positive/30 bg-positive/5">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Net Settlement</p>
                  <p className="text-3xl font-mono font-bold text-positive">
                    {formatCurrency(Math.abs(summary?.netAmount || 0))}
                  </p>
                  <p className="text-sm font-medium">
                    {summary?.netDebtor === "PHILIPPE"
                      ? "Philippe owes Ex"
                      : summary?.netDebtor === "EX"
                      ? "Ex owes Philippe"
                      : "Accounts balanced"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium">Settlement Instructions</p>
                  <p className="text-sm text-muted-foreground">
                    {summary?.netDebtor === "PHILIPPE"
                      ? `Philippe should pay Ex ${formatCurrency(
                          Math.abs(summary.netAmount)
                        )} to settle all accounts.`
                      : summary?.netDebtor === "EX"
                      ? `Ex should pay Philippe ${formatCurrency(
                          Math.abs(summary.netAmount)
                        )} to settle all accounts.`
                      : "All accounts are balanced. No payment required."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All calculations use bankers' rounding to cents. The invariant
                    Philippe's share + Ex's share = Total is maintained for all
                    transactions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
