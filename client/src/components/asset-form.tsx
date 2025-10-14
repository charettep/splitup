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
  insertAssetSchema,
  type InsertAsset,
  type Asset,
  type SplitPeriod,
} from "@shared/schema";

interface AssetFormProps {
  asset?: Asset | null;
  onSuccess?: () => void;
}

export function AssetForm({ asset, onSuccess }: AssetFormProps) {
  const { toast } = useToast();

  const { data: periods } = useQuery<SplitPeriod[]>({
    queryKey: ["/api/split-periods"],
  });

  const form = useForm<InsertAsset>({
    resolver: zodResolver(insertAssetSchema),
    defaultValues: {
      name: asset?.name || "",
      purchaseDate: asset?.purchaseDate || "",
      purchasePrice: asset?.purchasePrice || "",
      paidBy: (asset?.paidBy || "PHILIPPE") as "PHILIPPE" | "EX",
      manualOriginalSharePhilippePct: asset?.manualOriginalSharePhilippePct || "",
      manualOriginalShareExPct: asset?.manualOriginalShareExPct || "",
      currentEstimatedValue: asset?.currentEstimatedValue || "",
      valuationDate: asset?.valuationDate || "",
      keptBy: (asset?.keptBy || undefined) as "PHILIPPE" | "EX" | undefined,
      notes: asset?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAsset) => {
      if (asset) {
        return apiRequest("PATCH", `/api/assets/${asset.id}`, data);
      }
      return apiRequest("POST", "/api/assets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      toast({
        title: asset ? "Asset updated" : "Asset created",
        description: asset
          ? "Asset has been updated successfully"
          : "New asset has been created",
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

  const onSubmit = (data: InsertAsset) => {
    createMutation.mutate(data);
  };

  // Check if date has matching split period
  const selectedDate = form.watch("purchaseDate");
  const hasMatchingPeriod = periods?.some((period) => {
    const purchaseDate = new Date(selectedDate);
    const start = new Date(period.startDate);
    const end = period.endDate ? new Date(period.endDate) : null;
    return purchaseDate >= start && (!end || purchaseDate <= end);
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asset Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., Dishwasher, Couch, Car"
                  data-testid="input-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="purchaseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Date (yyyy/mm/dd)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    data-testid="input-purchase-date"
                  />
                </FormControl>
                {selectedDate && !hasMatchingPeriod && (
                  <FormDescription className="text-warning text-xs">
                    No matching split period
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Price</FormLabel>
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
                      data-testid="input-purchase-price"
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
            <p className="text-sm font-medium">Manual Original Shares</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="manualOriginalSharePhilippePct"
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
                name="manualOriginalShareExPct"
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

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="Additional details about the asset"
                  className="resize-none"
                  rows={2}
                  data-testid="input-notes"
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
              ? asset
                ? "Updating..."
                : "Creating..."
              : asset
              ? "Update Asset"
              : "Create Asset"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
