import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  insertExpenseSchema,
  type InsertExpense,
  type Expense,
  EXPENSE_CATEGORIES,
  type SplitPeriod,
} from "@shared/schema";
import { useSettlement } from "@/lib/settlementContext";

interface ExpenseFormProps {
  expense?: Expense | null;
  onSuccess?: () => void;
  initialData?: Partial<InsertExpense>;
  settlementId: string;
}

export function ExpenseForm({ expense, onSuccess, initialData, settlementId }: ExpenseFormProps) {
  const { toast } = useToast();
  const { person1, person2 } = useSettlement();

  const { data: periods } = useQuery<SplitPeriod[]>({
    queryKey: ["/api/split-periods", { settlementId }],
  });

  const form = useForm<InsertExpense>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      date: expense?.date || initialData?.date || "",
      description: expense?.description || initialData?.description || "",
      category: expense?.category || initialData?.category || "Other",
      totalAmount: expense?.totalAmount || initialData?.totalAmount || "",
      paidBy: (expense?.paidBy || initialData?.paidBy || "person1") as "person1" | "person2",
      receiptUrl: expense?.receiptUrl || initialData?.receiptUrl || "",
      documentUrl: expense?.documentUrl || initialData?.documentUrl || "",
      manualPerson1SharePct: expense?.manualPerson1SharePct || initialData?.manualPerson1SharePct || "",
      manualPerson2SharePct: expense?.manualPerson2SharePct || initialData?.manualPerson2SharePct || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      if (expense) {
        return apiRequest("PATCH", `/api/expenses/${expense.id}`, data);
      }
      return apiRequest("POST", "/api/expenses", {
        ...data,
        settlementId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", { settlementId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      toast({
        title: expense ? "Expense updated" : "Expense created",
        description: expense
          ? "Expense has been updated successfully"
          : "New expense has been created",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertExpense) => {
    createMutation.mutate(data);
  };

  const selectedDate = form.watch("date");
  const hasMatchingPeriod = periods?.some((period) => {
    const expenseDate = new Date(selectedDate);
    const start = new Date(period.startDate);
    const end = period.endDate ? new Date(period.endDate) : null;
    return expenseDate >= start && (!end || expenseDate <= end);
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date (yyyy/mm/dd)</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  data-testid="input-date"
                />
              </FormControl>
              {selectedDate && !hasMatchingPeriod && (
                <FormDescription className="text-warning">
                  No matching split period found. Manual shares required.
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., Grocery shopping at Loblaws"
                  data-testid="input-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (CAD)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      className="pl-7 font-mono"
                      data-testid="input-amount"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="paidBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paid By</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl>
                  <SelectTrigger data-testid="select-paid-by">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {person1 && (
                    <SelectItem value="person1">
                      {person1.personName}
                    </SelectItem>
                  )}
                  {person2 && (
                    <SelectItem value="person2">
                      {person2.personName}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedDate && !hasMatchingPeriod && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm font-medium">Manual Split Shares</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="manualPerson1SharePct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{person1?.personName || "Person 1"} %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...field}
                        value={field.value || ""}
                        className="font-mono"
                        data-testid="input-manual-person1-pct"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manualPerson2SharePct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{person2?.personName || "Person 2"} %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...field}
                        value={field.value || ""}
                        className="font-mono"
                        data-testid="input-manual-person2-pct"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="submit"
            disabled={createMutation.isPending}
            data-testid="button-submit"
          >
            {createMutation.isPending
              ? expense
                ? "Updating..."
                : "Creating..."
              : expense
              ? "Update Expense"
              : "Create Expense"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
