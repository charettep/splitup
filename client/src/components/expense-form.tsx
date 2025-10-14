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
import { Textarea } from "@/components/ui/textarea";
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

interface ExpenseFormProps {
  expense?: Expense | null;
  onSuccess?: () => void;
  initialData?: Partial<InsertExpense>;
}

export function ExpenseForm({ expense, onSuccess, initialData }: ExpenseFormProps) {
  const { toast } = useToast();

  const { data: periods } = useQuery<SplitPeriod[]>({
    queryKey: ["/api/split-periods"],
  });

  const form = useForm<InsertExpense>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      date: expense?.date || initialData?.date || "",
      description: expense?.description || initialData?.description || "",
      category: expense?.category || initialData?.category || "Other",
      totalAmount: expense?.totalAmount || initialData?.totalAmount || "",
      paidBy: expense?.paidBy || initialData?.paidBy || "PHILIPPE",
      attachmentUrl: expense?.attachmentUrl || initialData?.attachmentUrl || "",
      manualSharePhilippePct: expense?.manualSharePhilippePct || initialData?.manualSharePhilippePct || "",
      manualShareExPct: expense?.manualShareExPct || initialData?.manualShareExPct || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      if (expense) {
        return apiRequest("PATCH", `/api/expenses/${expense.id}`, data);
      }
      return apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
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

  // Check if date has matching split period
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
              <FormLabel>Date</FormLabel>
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-paid-by">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="PHILIPPE">Philippe</SelectItem>
                  <SelectItem value="EX">Ex</SelectItem>
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
                name="manualSharePhilippePct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Philippe %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...field}
                        value={field.value || ""}
                        className="font-mono"
                        data-testid="input-manual-philippe-pct"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manualShareExPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ex %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...field}
                        value={field.value || ""}
                        className="font-mono"
                        data-testid="input-manual-ex-pct"
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
