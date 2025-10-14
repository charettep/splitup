import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Asset } from "@shared/schema";

const valuationSchema = z.object({
  currentEstimatedValue: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "Must be a valid amount"),
  valuationDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  keptBy: z.enum(["PHILIPPE", "EX"]),
});

type ValuationFormData = z.infer<typeof valuationSchema>;

interface AssetValuationFormProps {
  asset: Asset;
  onSuccess?: () => void;
}

export function AssetValuationForm({ asset, onSuccess }: AssetValuationFormProps) {
  const { toast } = useToast();

  const form = useForm<ValuationFormData>({
    resolver: zodResolver(valuationSchema),
    defaultValues: {
      currentEstimatedValue: asset.currentEstimatedValue || "",
      valuationDate: asset.valuationDate || new Date().toISOString().split("T")[0],
      keptBy: (asset.keptBy || undefined) as "PHILIPPE" | "EX" | undefined,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ValuationFormData) => {
      return apiRequest("PATCH", `/api/assets/${asset.id}/valuation`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      toast({
        title: "Valuation updated",
        description: "Asset valuation and buyback have been calculated",
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

  const onSubmit = (data: ValuationFormData) => {
    updateMutation.mutate(data);
  };

  // Calculate buyback preview
  const currentValue = parseFloat(form.watch("currentEstimatedValue") || "0");
  const keptBy = form.watch("keptBy");

  // We'll need to fetch the original shares - for preview, we'll estimate
  const calculateBuyback = () => {
    if (!currentValue || !keptBy) return null;
    
    // This is a simplified preview - actual calculation happens on backend
    const ownerShare = keptBy === "PHILIPPE" ? 0.5 : 0.5; // Placeholder
    const otherShare = 1 - ownerShare;
    const buyback = Math.round(currentValue * otherShare * 100) / 100;
    
    return {
      buyback,
      keeper: keptBy === "PHILIPPE" ? "Philippe" : "Ex",
      recipient: keptBy === "PHILIPPE" ? "Ex" : "Philippe",
    };
  };

  const buybackPreview = calculateBuyback();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Asset</span>
            <span className="font-medium">{asset.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Purchase Price</span>
            <span className="font-mono">${parseFloat(asset.purchasePrice).toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="currentEstimatedValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Value</FormLabel>
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
                      data-testid="input-current-value"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="valuationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valuation Date (yyyy/mm/dd)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    data-testid="input-valuation-date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="keptBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kept By</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-kept-by">
                    <SelectValue placeholder="Who keeps this asset?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="PHILIPPE">Philippe</SelectItem>
                  <SelectItem value="EX">Ex</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className="text-xs">
                The person who will own the asset after settlement
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {buybackPreview && (
          <Card className="p-4 bg-positive/5 border-positive/20">
            <div className="flex items-start gap-3">
              <Calculator className="w-5 h-5 text-positive mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Buyback Calculation Preview</p>
                <p className="text-xs text-muted-foreground">
                  {buybackPreview.keeper} keeps the asset and owes{" "}
                  {buybackPreview.recipient}{" "}
                  <span className="font-mono font-semibold text-positive">
                    ${buybackPreview.buyback.toFixed(2)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  This will create a ledger entry based on the original ownership shares
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-submit"
          >
            {updateMutation.isPending ? "Calculating..." : "Set Valuation & Calculate Buyback"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
