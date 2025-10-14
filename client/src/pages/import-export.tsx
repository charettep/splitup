import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function ImportExportPage() {
  const { toast } = useToast();
  const [importing, setImporting] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/import/${type}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/${variables.type}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      toast({
        title: "Import successful",
        description: `${data.count} ${variables.type} imported successfully`,
      });
      setImporting(null);
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
      setImporting(null);
    },
  });

  const handleFileUpload = (type: string, file: File) => {
    if (file && file.type === "text/csv") {
      setImporting(type);
      importMutation.mutate({ type, file });
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleExport = async (type: string) => {
    try {
      const response = await fetch(`/api/export/${type}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Export successful",
        description: `${type} data exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export data",
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = (type: string) => {
    const templates = {
      "split-periods":
        "start_date,end_date,share_philippe_pct,share_ex_pct,note\n2023-01-01,2023-06-30,50.00,50.00,Living together\n2023-07-01,,40.00,60.00,Post-separation",
      expenses:
        "date,description,category,total_amount,paid_by,attachment_url\n2023-10-03,Grocery shopping,Groceries,120.50,PHILIPPE,\n2023-10-05,Electricity bill,Utilities,85.00,EX,",
      assets:
        "name,purchase_date,purchase_price,paid_by,original_share_philippe_pct,current_estimated_value,valuation_date,kept_by,notes\nDishwasher,2023-07-01,1000.00,PHILIPPE,60.00,500.00,2024-01-15,EX,Kitchen appliance\nCouch,2023-05-15,1500.00,EX,50.00,800.00,2024-01-15,PHILIPPE,Living room furniture",
    };

    const content = templates[type as keyof typeof templates] || "";
    const blob = new Blob([content], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Import & Export
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk import data from CSV files or export for backup and audit
        </p>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import" data-testid="tab-import">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">CSV Import Guidelines</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Download the template for the correct column format</li>
                  <li>• Dates must be in YYYY-MM-DD format</li>
                  <li>• Amounts should be decimal numbers (e.g., 120.50)</li>
                  <li>• Leave optional fields empty if not applicable</li>
                  <li>• Import will validate all data before processing</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Split Periods</CardTitle>
                <CardDescription className="text-xs">
                  Import time windows with percentage shares
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("split-periods")}
                  data-testid="button-download-template-split-periods"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <div>
                  <input
                    id="import-split-periods"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("split-periods", file);
                    }}
                    className="hidden"
                    data-testid="input-import-split-periods"
                  />
                  <Button
                    className="w-full"
                    onClick={() =>
                      document.getElementById("import-split-periods")?.click()
                    }
                    disabled={importing === "split-periods"}
                    data-testid="button-import-split-periods"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {importing === "split-periods" ? "Importing..." : "Import CSV"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Expenses</CardTitle>
                <CardDescription className="text-xs">
                  Bulk import expense records
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("expenses")}
                  data-testid="button-download-template-expenses"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <div>
                  <input
                    id="import-expenses"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("expenses", file);
                    }}
                    className="hidden"
                    data-testid="input-import-expenses"
                  />
                  <Button
                    className="w-full"
                    onClick={() =>
                      document.getElementById("import-expenses")?.click()
                    }
                    disabled={importing === "expenses"}
                    data-testid="button-import-expenses"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {importing === "expenses" ? "Importing..." : "Import CSV"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assets</CardTitle>
                <CardDescription className="text-xs">
                  Import jointly owned items
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("assets")}
                  data-testid="button-download-template-assets"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <div>
                  <input
                    id="import-assets"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("assets", file);
                    }}
                    className="hidden"
                    data-testid="input-import-assets"
                  />
                  <Button
                    className="w-full"
                    onClick={() => document.getElementById("import-assets")?.click()}
                    disabled={importing === "assets"}
                    data-testid="button-import-assets"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {importing === "assets" ? "Importing..." : "Import CSV"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card className="border-positive/20 bg-positive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-positive mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Export Features</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Download current data for backup or external analysis</li>
                  <li>• Export includes all fields in CSV format</li>
                  <li>• Files are timestamped for easy versioning</li>
                  <li>• Use exported files to re-import data if needed</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Split Periods</CardTitle>
                <CardDescription className="text-xs">
                  Export all split period definitions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport("split-periods")}
                  data-testid="button-export-split-periods"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Expenses</CardTitle>
                <CardDescription className="text-xs">
                  Export all expense records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport("expenses")}
                  data-testid="button-export-expenses"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assets</CardTitle>
                <CardDescription className="text-xs">
                  Export all asset records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport("assets")}
                  data-testid="button-export-assets"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
