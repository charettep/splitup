import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { Parser } from "@json2csv/plainjs";
import Papa from "papaparse";
import OpenAI from "openai";
import {
  insertSplitPeriodSchema,
  insertExpenseSchema,
  insertAssetSchema,
  type OCRExtractedData,
  type SplitPeriod,
  type Expense,
  type Asset,
} from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Bankers' rounding function
function bankersRound(value: number): number {
  const scaled = value * 100;
  const floor = Math.floor(scaled);
  const remainder = scaled - floor;
  
  if (remainder < 0.5) {
    return floor / 100;
  } else if (remainder > 0.5) {
    return Math.ceil(scaled) / 100;
  } else {
    // Exactly 0.5 - round to nearest even
    return (floor % 2 === 0 ? floor : floor + 1) / 100;
  }
}

// Find matching split period for a date
function findSplitPeriod(date: string, periods: SplitPeriod[]): SplitPeriod | null {
  const targetDate = new Date(date);
  
  for (const period of periods) {
    const start = new Date(period.startDate);
    const end = period.endDate ? new Date(period.endDate) : null;
    
    if (targetDate >= start && (!end || targetDate <= end)) {
      return period;
    }
  }
  
  return null;
}

// Calculate owed amounts for expense
// Returns debts: owedPhilippe = amount owed TO Philippe, owedEx = amount owed TO Ex
function calculateExpenseOwed(expense: Expense, periods: SplitPeriod[]) {
  let philippePct = 50;
  let exPct = 50;
  
  if (expense.manualSharePhilippePct && expense.manualShareExPct) {
    philippePct = parseFloat(expense.manualSharePhilippePct);
    exPct = parseFloat(expense.manualShareExPct);
  } else {
    const period = findSplitPeriod(expense.date, periods);
    if (period) {
      philippePct = parseFloat(period.sharePhilippePct);
      exPct = parseFloat(period.shareExPct);
    }
  }
  
  const total = parseFloat(expense.totalAmount);
  const philippeShare = bankersRound(total * (philippePct / 100));
  const exShare = total - philippeShare; // Ensure invariant
  
  // Calculate debts based on who paid
  if (expense.paidBy === "PHILIPPE") {
    // Philippe paid, so Ex owes him her share
    return { owedPhilippe: exShare, owedEx: 0 };
  } else {
    // Ex paid, so Philippe owes her his share
    return { owedPhilippe: 0, owedEx: philippeShare };
  }
}

// Calculate buyback for asset
function calculateAssetBuyback(asset: Asset, periods: SplitPeriod[]) {
  if (!asset.currentEstimatedValue || !asset.keptBy) {
    return null;
  }
  
  let philippePct = 50;
  let exPct = 50;
  
  if (asset.manualOriginalSharePhilippePct && asset.manualOriginalShareExPct) {
    philippePct = parseFloat(asset.manualOriginalSharePhilippePct);
    exPct = parseFloat(asset.manualOriginalShareExPct);
  } else {
    const period = findSplitPeriod(asset.purchaseDate, periods);
    if (period) {
      philippePct = parseFloat(period.sharePhilippePct);
      exPct = parseFloat(period.shareExPct);
    }
  }
  
  const currentValue = parseFloat(asset.currentEstimatedValue);
  const otherPartyPct = asset.keptBy === "PHILIPPE" ? exPct : philippePct;
  const buyback = bankersRound(currentValue * (otherPartyPct / 100));
  
  return {
    buyback,
    owedPhilippe: asset.keptBy === "EX" ? buyback : 0,
    owedEx: asset.keptBy === "PHILIPPE" ? buyback : 0,
  };
}

// Recalculate ledger
async function recalculateLedger() {
  const [expenses, assets, periods] = await Promise.all([
    storage.getAllExpenses(),
    storage.getAllAssets(),
    storage.getAllSplitPeriods(),
  ]);
  
  // Process expenses
  for (const expense of expenses) {
    // Delete existing ledger lines for this expense
    await storage.deleteOwedLinesBySource("expense", expense.id);
    
    const { owedPhilippe, owedEx } = calculateExpenseOwed(expense, periods);
    
    // Ledger logic: owedPhilippe = amount owed TO Philippe, owedEx = amount owed TO Ex
    const description = `${expense.description} (${expense.paidBy === "PHILIPPE" ? "Philippe" : "Ex"} paid)`;
    
    await storage.createOwedLine({
      sourceType: "expense",
      sourceId: expense.id,
      date: expense.date,
      description,
      category: expense.category,
      totalAmount: expense.totalAmount,
      owedPhilippe: owedPhilippe.toString(),
      owedEx: owedEx.toString(),
      paidStatus: false,
      notes: null,
    });
  }
  
  // Process assets with buybacks
  for (const asset of assets) {
    // Delete existing ledger lines for this asset
    await storage.deleteOwedLinesBySource("asset", asset.id);
    
    const buybackInfo = calculateAssetBuyback(asset, periods);
    
    if (buybackInfo) {
      const description = `${asset.name} - Buyback (Kept by ${asset.keptBy === "PHILIPPE" ? "Philippe" : "Ex"})`;
      
      await storage.createOwedLine({
        sourceType: "asset",
        sourceId: asset.id,
        date: asset.valuationDate!,
        description,
        category: null,
        totalAmount: asset.currentEstimatedValue!,
        owedPhilippe: buybackInfo.owedPhilippe.toString(),
        owedEx: buybackInfo.owedEx.toString(),
        paidStatus: false,
        notes: `Original price: $${parseFloat(asset.purchasePrice).toFixed(2)}`,
      });
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Object Storage routes
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      return res.sendStatus(404);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // OCR extraction endpoint
  app.post("/api/ocr/extract", async (req, res) => {
    try {
      const { fileUrl, fileType } = req.body;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the following information from this receipt/invoice image:
- Date (in YYYY-MM-DD format)
- Vendor/merchant name
- Total amount (numbers only, no currency symbol)
- Currency (e.g., CAD, USD)
- Line items with descriptions and amounts if visible

Return the data in this exact JSON format:
{
  "date": "YYYY-MM-DD or empty string if not found",
  "vendor": "vendor name or empty string",
  "totalAmount": "amount as decimal number or empty string",
  "currency": "currency code or empty string",
  "lineItems": [{"description": "item", "amount": "decimal"}, ...]
}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: fileUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const extractedData: OCRExtractedData = JSON.parse(content);
      
      res.json(extractedData);
    } catch (error) {
      console.error("OCR extraction error:", error);
      res.status(500).json({ error: "Failed to extract data from receipt" });
    }
  });

  // Split Periods
  app.get("/api/split-periods", async (req, res) => {
    const periods = await storage.getAllSplitPeriods();
    res.json(periods);
  });

  app.post("/api/split-periods", async (req, res) => {
    try {
      const validated = insertSplitPeriodSchema.parse(req.body);
      const period = await storage.createSplitPeriod(validated);
      await recalculateLedger();
      res.status(201).json(period);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/split-periods/:id", async (req, res) => {
    try {
      const period = await storage.updateSplitPeriod(req.params.id, req.body);
      await recalculateLedger();
      res.json(period);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Expenses
  app.get("/api/expenses", async (req, res) => {
    const expenses = await storage.getAllExpenses();
    res.json(expenses);
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const validated = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validated);
      await recalculateLedger();
      res.status(201).json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.updateExpense(req.params.id, req.body);
      await recalculateLedger();
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Assets
  app.get("/api/assets", async (req, res) => {
    const assets = await storage.getAllAssets();
    res.json(assets);
  });

  app.post("/api/assets", async (req, res) => {
    try {
      const validated = insertAssetSchema.parse(req.body);
      const asset = await storage.createAsset(validated);
      await recalculateLedger();
      res.status(201).json(asset);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/assets/:id", async (req, res) => {
    try {
      const asset = await storage.updateAsset(req.params.id, req.body);
      await recalculateLedger();
      res.json(asset);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/assets/:id/valuation", async (req, res) => {
    try {
      const { currentEstimatedValue, valuationDate, keptBy } = req.body;
      // First update the asset with new valuation
      const asset = await storage.updateAsset(req.params.id, {
        currentEstimatedValue,
        valuationDate,
        keptBy,
      });
      // Then recalculate ledger with updated values
      await recalculateLedger();
      res.json(asset);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Ledger
  app.get("/api/ledger", async (req, res) => {
    const lines = await storage.getAllOwedLines();
    
    const sheOwesPhilippe: typeof lines = [];
    const philippeOwesHer: typeof lines = [];
    
    for (const line of lines) {
      const owedP = parseFloat(line.owedPhilippe);
      const owedE = parseFloat(line.owedEx);
      
      // Group based on debt values (new debt semantic)
      // owedPhilippe > 0 means debt TO Philippe (She owes him)
      // owedEx > 0 means debt TO Ex (He owes her)
      if (owedP > 0) {
        sheOwesPhilippe.push(line);
      } else if (owedE > 0) {
        philippeOwesHer.push(line);
      }
    }
    
    // Calculate summary
    // With new debt semantic: owedPhilippe = debt TO Philippe, owedEx = debt TO Ex
    const totalSheOwes = sheOwesPhilippe
      .filter((l) => !l.paidStatus)
      .reduce((sum, l) => sum + parseFloat(l.owedPhilippe), 0);
    
    const totalPhilippeOwes = philippeOwesHer
      .filter((l) => !l.paidStatus)
      .reduce((sum, l) => sum + parseFloat(l.owedEx), 0);
    
    const netAmount = totalSheOwes - totalPhilippeOwes;
    const netDebtor = netAmount > 0 ? "EX" : netAmount < 0 ? "PHILIPPE" : null;
    
    res.json({
      sheOwesPhilippe,
      philippeOwesHer,
      summary: {
        totalSheOwes,
        totalPhilippeOwes,
        netAmount: Math.abs(netAmount),
        netDebtor,
      },
    });
  });

  app.patch("/api/ledger/:id/paid", async (req, res) => {
    try {
      const { paidStatus } = req.body;
      const line = await storage.updateOwedLine(req.params.id, { paidStatus });
      res.json(line);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CSV Export
  app.get("/api/export/:type", async (req, res) => {
    const { type } = req.params;
    
    try {
      let data: any[] = [];
      let filename = "";
      
      if (type === "split-periods") {
        data = await storage.getAllSplitPeriods();
        filename = "split_periods.csv";
      } else if (type === "expenses") {
        data = await storage.getAllExpenses();
        filename = "expenses.csv";
      } else if (type === "assets") {
        data = await storage.getAllAssets();
        filename = "assets.csv";
      }
      
      const parser = new Parser();
      const csv = parser.parse(data);
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.get("/api/ledger/export/:type", async (req, res) => {
    const { type } = req.params;
    
    try {
      const lines = await storage.getAllOwedLines();
      let data: any[] = [];
      
      if (type === "she-owes") {
        // Export lines where owedPhilippe > 0 (debts TO Philippe)
        data = lines.filter(line => parseFloat(line.owedPhilippe) > 0);
      } else if (type === "philippe-owes") {
        // Export lines where owedEx > 0 (debts TO Ex)
        data = lines.filter(line => parseFloat(line.owedEx) > 0);
      } else {
        data = lines;
      }
      
      const parser = new Parser();
      const csv = parser.parse(data);
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="ledger_${type}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Export failed" });
    }
  });

  // CSV Import
  app.post("/api/import/:type", upload.single("file"), async (req, res) => {
    const { type } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    try {
      const csvData = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
      
      let count = 0;
      
      if (type === "split-periods") {
        for (const row of parsed.data as any[]) {
          const validated = insertSplitPeriodSchema.parse(row);
          await storage.createSplitPeriod(validated);
          count++;
        }
      } else if (type === "expenses") {
        for (const row of parsed.data as any[]) {
          const validated = insertExpenseSchema.parse(row);
          await storage.createExpense(validated);
          count++;
        }
      } else if (type === "assets") {
        for (const row of parsed.data as any[]) {
          const validated = insertAssetSchema.parse(row);
          await storage.createAsset(validated);
          count++;
        }
      } else {
        return res.status(400).json({ error: "Invalid import type" });
      }
      
      await recalculateLedger();
      res.json({ count, message: `Imported ${count} ${type}` });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
