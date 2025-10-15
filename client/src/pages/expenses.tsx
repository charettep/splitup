import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Upload, AlertTriangle, Eye, Edit2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpenseForm } from "@/components/expense-form";
import { ReceiptUpload } from "@/components/receipt-upload";
import type { Expense } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSettlement } from "@/lib/settlementContext";

export default function ExpensesPage() {
  const { settlement, currentUserId, person1, person2 } = useSettlement();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { settlementId: settlement.id }],
  });

  const handleEdit = (expense: Expense) => {
    if (expense.ownerId !== currentUserId) {
      return;
    }
    setEditingExpense(expense);
    setIsFormDialogOpen(true);
  };

  const handleCloseFormDialog = () => {
    setIsFormDialogOpen(false);
    setEditingExpense(null);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const isUnresolved = (expense: Expense) => {
    return !expense.manualPerson1SharePct && !expense.manualPerson2SharePct;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Expenses</h1>
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-64 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedExpenses = [...(expenses || [])].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const unresolvedCount = sortedExpenses.filter(isUnresolved).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Expenses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track shared expenses with receipt uploads and OCR
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-upload-receipt">
                <Upload className="w-4 h-4 mr-2" />
                Upload Receipt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload Receipt</DialogTitle>
                <DialogDescription>
                  Upload a receipt image or PDF. We'll extract the data automatically.
                </DialogDescription>
              </DialogHeader>
              <ReceiptUpload
                settlementId={settlement.id}
                onSuccess={() => setIsUploadDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-expense">
                <Plus className="w-4 h-4 mr-2" />
                Add Manually
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense ? "Edit Expense" : "Add Expense"}
                </DialogTitle>
                <DialogDescription>
                  {editingExpense
                    ? "Update the expense details"
                    : "Enter expense details manually"}
                </DialogDescription>
              </DialogHeader>
              <ExpenseForm
                expense={editingExpense}
                onSuccess={handleCloseFormDialog}
                settlementId={settlement.id}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {unresolvedCount > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-sm">
                {unresolvedCount} unresolved expense{unresolvedCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                These expenses need manual share percentages or matching split periods
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedExpenses.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <Receipt className="w-12 h-12 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">No expenses yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a receipt or add an expense manually to get started
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsUploadDialogOpen(true)}
                data-testid="button-upload-first"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Receipt
              </Button>
              <Button onClick={() => setIsFormDialogOpen(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Add Manually
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[120px] text-right">Amount</TableHead>
                  <TableHead className="w-[100px]">Paid By</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.map((expense) => {
                  const unresolved = isUnresolved(expense);
                  const isPerson1Payer = expense.paidBy === "person1";
                  const payerName = isPerson1Payer ? person1?.personName : person2?.personName || "Unknown";
                  const canEdit = expense.ownerId === currentUserId;
                  
                  return (
                    <TableRow
                      key={expense.id}
                      className={unresolved ? "bg-warning/5" : ""}
                      data-testid={`row-expense-${expense.id}`}
                    >
                      <TableCell className="font-mono text-sm">
                        {formatDate(expense.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{expense.description}</span>
                          {(expense.receiptUrl || expense.documentUrl) && (
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(expense.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payerName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {unresolved ? (
                          <Badge variant="outline" className="border-warning text-warning">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Unresolved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-positive text-positive">
                            Resolved
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(expense)}
                          disabled={!canEdit}
                          data-testid={`button-edit-${expense.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
