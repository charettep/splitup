import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertSplitPeriodSchema, type InsertSplitPeriod, type SplitPeriod } from "@shared/schema";

interface SplitPeriodFormProps {
  period?: SplitPeriod | null;
  onSuccess?: () => void;
}

export function SplitPeriodForm({ period, onSuccess }: SplitPeriodFormProps) {
  const { toast } = useToast();

  const form = useForm<InsertSplitPeriod>({
    resolver: zodResolver(insertSplitPeriodSchema),
    defaultValues: {
      startDate: period?.startDate || "",
      endDate: period?.endDate || "",
      sharePhilippePct: period?.sharePhilippePct || "50.00",
      shareExPct: period?.shareExPct || "50.00",
      note: period?.note || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertSplitPeriod) => {
      if (period) {
        return apiRequest("PATCH", `/api/split-periods/${period.id}`, data);
      }
      return apiRequest("POST", "/api/split-periods", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-periods"] });
      toast({
        title: period ? "Period updated" : "Period created",
        description: period
          ? "Split period has been updated successfully"
          : "New split period has been created",
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

  const onSubmit = (data: InsertSplitPeriod) => {
    createMutation.mutate(data);
  };

  // Quick presets for common splits
  const applyPreset = (philippe: number, ex: number) => {
    form.setValue("sharePhilippePct", philippe.toFixed(2));
    form.setValue("shareExPct", ex.toFixed(2));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date (yyyy/mm/dd)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    data-testid="input-start-date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date (yyyy/mm/dd)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-end-date"
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Leave empty for ongoing
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(50, 50)}
              data-testid="button-preset-50-50"
            >
              50/50
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(60, 40)}
              data-testid="button-preset-60-40"
            >
              60/40
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(40, 60)}
              data-testid="button-preset-40-60"
            >
              40/60
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="sharePhilippePct"
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
                    data-testid="input-philippe-pct"
                    className="font-mono"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shareExPct"
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
                    data-testid="input-ex-pct"
                    className="font-mono"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="e.g., Living together, Post-separation"
                  className="resize-none"
                  rows={2}
                  data-testid="input-note"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="submit"
            disabled={createMutation.isPending}
            data-testid="button-submit"
          >
            {createMutation.isPending
              ? period
                ? "Updating..."
                : "Creating..."
              : period
              ? "Update Period"
              : "Create Period"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
