import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Edit2, AlertTriangle, DollarSign } from "lucide-react";
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
import { AssetForm } from "@/components/asset-form";
import { AssetValuationForm } from "@/components/asset-valuation-form";
import type { Asset } from "@shared/schema";

export default function AssetsPage() {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isValuationDialogOpen, setIsValuationDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [valuingAsset, setValuingAsset] = useState<Asset | null>(null);

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setIsFormDialogOpen(true);
  };

  const handleValuation = (asset: Asset) => {
    setValuingAsset(asset);
    setIsValuationDialogOpen(true);
  };

  const handleCloseFormDialog = () => {
    setIsFormDialogOpen(false);
    setEditingAsset(null);
  };

  const handleCloseValuationDialog = () => {
    setIsValuationDialogOpen(false);
    setValuingAsset(null);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    // Format as yyyy/mm/dd
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "—";
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Assets</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-24 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const sortedAssets = [...(assets || [])].sort((a, b) => {
    return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
  });

  const unresolvedCount = sortedAssets.filter(
    (a) => !a.manualOriginalSharePhilippePct && !a.manualOriginalShareExPct
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Assets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track jointly owned items and compute buyback amounts
          </p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-asset">
              <Plus className="w-4 h-4 mr-2" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAsset ? "Edit Asset" : "Add Asset"}
              </DialogTitle>
              <DialogDescription>
                {editingAsset
                  ? "Update the asset details"
                  : "Add a jointly owned item"}
              </DialogDescription>
            </DialogHeader>
            <AssetForm asset={editingAsset} onSuccess={handleCloseFormDialog} />
          </DialogContent>
        </Dialog>
      </div>

      {unresolvedCount > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-sm">
                {unresolvedCount} unresolved asset{unresolvedCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                These assets need manual share percentages or matching split periods
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedAssets.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <DollarSign className="w-12 h-12 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">No assets yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add jointly owned items to track and settle
              </p>
            </div>
            <Button onClick={() => setIsFormDialogOpen(true)} data-testid="button-create-first">
              <Plus className="w-4 h-4 mr-2" />
              Add First Asset
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedAssets.map((asset) => {
            const hasValuation = asset.currentEstimatedValue && asset.valuationDate;
            const isKept = asset.keptBy !== null;
            const unresolved =
              !asset.manualOriginalSharePhilippePct &&
              !asset.manualOriginalShareExPct;

            return (
              <Card
                key={asset.id}
                className="relative"
                data-testid={`card-asset-${asset.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {asset.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Purchased {formatDate(asset.purchaseDate)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(asset)}
                      data-testid={`button-edit-${asset.id}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {unresolved && (
                    <Badge variant="outline" className="border-warning text-warning">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Unresolved
                    </Badge>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Price</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(asset.purchasePrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid By</span>
                      <Badge
                        variant="secondary"
                        className={
                          asset.paidBy === "PHILIPPE"
                            ? "bg-philippe/10 text-philippe"
                            : "bg-ex/10 text-ex"
                        }
                      >
                        {asset.paidBy === "PHILIPPE" ? "Philippe" : "Ex"}
                      </Badge>
                    </div>

                    {hasValuation && (
                      <>
                        <div className="h-px bg-border my-2"></div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current Value</span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(asset.currentEstimatedValue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valued On</span>
                          <span className="font-mono text-xs">
                            {formatDate(asset.valuationDate)}
                          </span>
                        </div>
                      </>
                    )}

                    {isKept && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kept By</span>
                        <Badge
                          className={
                            asset.keptBy === "PHILIPPE"
                              ? "bg-philippe/10 text-philippe border-philippe/20"
                              : "bg-ex/10 text-ex border-ex/20"
                          }
                        >
                          {asset.keptBy === "PHILIPPE" ? "Philippe" : "Ex"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {!hasValuation && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleValuation(asset)}
                      data-testid={`button-value-${asset.id}`}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Set Valuation
                    </Button>
                  )}

                  {hasValuation && !isKept && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleValuation(asset)}
                      data-testid={`button-update-valuation-${asset.id}`}
                    >
                      Update Valuation
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isValuationDialogOpen} onOpenChange={setIsValuationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asset Valuation</DialogTitle>
            <DialogDescription>
              Set the current value and who keeps the asset
            </DialogDescription>
          </DialogHeader>
          {valuingAsset && (
            <AssetValuationForm
              asset={valuingAsset}
              onSuccess={handleCloseValuationDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
