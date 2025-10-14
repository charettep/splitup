import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExpenseForm } from "@/components/expense-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { OCRExtractedData, InsertExpense } from "@shared/schema";

interface ReceiptUploadProps {
  onSuccess?: () => void;
}

export function ReceiptUpload({ onSuccess }: ReceiptUploadProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<OCRExtractedData | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Step 1: Get upload URL
      const response = await apiRequest("POST", "/api/objects/upload", {}) as { uploadURL: string };
      const { uploadURL } = response;

      // Step 2: Upload file to object storage
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      // Step 3: Extract data using OCR
      const extractedData = await apiRequest("POST", "/api/ocr/extract", {
        fileUrl: uploadURL.split("?")[0], // Remove query params
        fileType: file.type,
      }) as OCRExtractedData;

      return { uploadURL, extractedData };
    },
    onSuccess: ({ uploadURL, extractedData }) => {
      setUploadUrl(uploadURL.split("?")[0]);
      setExtractedData(extractedData);
      toast({
        title: "Receipt processed",
        description: "Data extracted successfully. Please review and confirm.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedData(null);
      setUploadUrl(null);
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type.startsWith("image/") || droppedFile.type === "application/pdf")) {
      setFile(droppedFile);
      setExtractedData(null);
      setUploadUrl(null);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an image or PDF file",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Prepare initial form data from extracted data
  const initialFormData: Partial<InsertExpense> | undefined = extractedData
    ? {
        date: extractedData.date || "",
        description: extractedData.vendor || "",
        totalAmount: extractedData.totalAmount || "",
        attachmentUrl: uploadUrl || "",
      }
    : undefined;

  if (extractedData && uploadUrl) {
    return (
      <div className="space-y-4">
        <Card className="p-4 bg-positive/5 border-positive/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-positive" />
            <div className="flex-1">
              <p className="font-medium text-sm">Receipt processed successfully</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review the extracted data below and make any necessary corrections
              </p>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">Extracted Data</p>
            <Card className="p-4 space-y-2 bg-muted/30">
              {extractedData.date && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-mono">{extractedData.date}</span>
                </div>
              )}
              {extractedData.vendor && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vendor:</span>
                  <span className="font-medium">{extractedData.vendor}</span>
                </div>
              )}
              {extractedData.totalAmount && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-mono font-semibold">
                    ${parseFloat(extractedData.totalAmount).toFixed(2)}
                  </span>
                </div>
              )}
              {extractedData.currency && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currency:</span>
                  <span className="font-mono">{extractedData.currency}</span>
                </div>
              )}
            </Card>

            {extractedData.lineItems && extractedData.lineItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Line Items</p>
                <Card className="p-3 space-y-1 max-h-40 overflow-y-auto bg-muted/30">
                  {extractedData.lineItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate flex-1">
                        {item.description}
                      </span>
                      {item.amount && (
                        <span className="font-mono ml-2">${item.amount}</span>
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Review & Confirm</p>
            <ExpenseForm
              initialData={initialFormData}
              onSuccess={onSuccess}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate cursor-pointer transition-colors"
        onClick={() => document.getElementById("file-input")?.click()}
        data-testid="dropzone-upload"
      >
        <input
          id="file-input"
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-file"
        />
        <div className="flex flex-col items-center gap-3">
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div>
                <p className="font-medium">Processing receipt...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Extracting data using AI
                </p>
              </div>
            </>
          ) : file ? (
            <>
              <FileText className="w-12 h-12 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                disabled={uploadMutation.isPending}
                data-testid="button-process"
              >
                Process Receipt
              </Button>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Drop receipt here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports PDF, JPG, PNG (max 10MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadMutation.isError && (
        <Card className="p-4 bg-destructive/5 border-destructive/20">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-medium text-sm text-destructive">Upload failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Please try again or add the expense manually
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
