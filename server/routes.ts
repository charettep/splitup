import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import { Parser } from "@json2csv/plainjs";
import Papa from "papaparse";
import OpenAI from "openai";
import {
  insertSettlementSchema,
  insertSplitPeriodSchema,
  insertExpenseSchema,
  insertAssetSchema,
  type OCRExtractedData,
  type SplitPeriod,
  type Expense,
  type Asset,
  type SettlementParticipant,
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
// Returns debts: owedPerson1 = amount owed TO person1, owedPerson2 = amount owed TO person2
function calculateExpenseOwed(expense: Expense, periods: SplitPeriod[]) {
  let person1Pct = 50;
  let person2Pct = 50;
  
  if (expense.manualPerson1SharePct && expense.manualPerson2SharePct) {
    person1Pct = parseFloat(expense.manualPerson1SharePct);
    person2Pct = parseFloat(expense.manualPerson2SharePct);
  } else {
    const period = findSplitPeriod(expense.date, periods);
    if (period) {
      person1Pct = parseFloat(period.person1SharePct);
      person2Pct = parseFloat(period.person2SharePct);
    }
  }
  
  const total = parseFloat(expense.totalAmount);
  const person1Share = bankersRound(total * (person1Pct / 100));
  const person2Share = total - person1Share; // Ensure invariant
  
  // Calculate debts based on who paid
  if (expense.paidBy === "person1") {
    // Person1 paid, so Person2 owes them their share
    return { owedPerson1: person2Share, owedPerson2: 0 };
  } else {
    // Person2 paid, so Person1 owes them their share
    return { owedPerson1: 0, owedPerson2: person1Share };
  }
}

// Calculate buyback for asset
function calculateAssetBuyback(asset: Asset, periods: SplitPeriod[]) {
  if (!asset.currentEstimatedValue || !asset.keptBy) {
    return null;
  }
  
  let person1Pct = 50;
  let person2Pct = 50;
  
  if (asset.manualOriginalPerson1SharePct && asset.manualOriginalPerson2SharePct) {
    person1Pct = parseFloat(asset.manualOriginalPerson1SharePct);
    person2Pct = parseFloat(asset.manualOriginalPerson2SharePct);
  } else {
    const period = findSplitPeriod(asset.purchaseDate, periods);
    if (period) {
      person1Pct = parseFloat(period.person1SharePct);
      person2Pct = parseFloat(period.person2SharePct);
    }
  }
  
  const currentValue = parseFloat(asset.currentEstimatedValue);
  const otherPartyPct = asset.keptBy === "person1" ? person2Pct : person1Pct;
  const buyback = bankersRound(currentValue * (otherPartyPct / 100));
  
  return {
    buyback,
    owedPerson1: asset.keptBy === "person2" ? buyback : 0,
    owedPerson2: asset.keptBy === "person1" ? buyback : 0,
  };
}

// Recalculate ledger for a settlement
async function recalculateLedger(settlementId: string) {
  const [expenses, assets, periods] = await Promise.all([
    storage.getAllExpenses(settlementId),
    storage.getAllAssets(settlementId),
    storage.getAllSplitPeriods(settlementId),
  ]);
  
  // Get participants to use their names in descriptions
  const participants = await storage.getSettlementParticipants(settlementId);
  const person1 = participants.find(p => p.role === "creator");
  const person2 = participants.find(p => p.role === "participant");
  
  // Process expenses
  for (const expense of expenses) {
    // Delete existing ledger lines for this expense
    await storage.deleteOwedLinesBySource("expense", expense.id);
    
    const { owedPerson1, owedPerson2 } = calculateExpenseOwed(expense, periods);
    
    // Use participant names in description
    const paidByName = expense.paidBy === "person1" ? person1?.personName : person2?.personName;
    const description = `${expense.description} (${paidByName} paid)`;
    
    await storage.createOwedLine({
      sourceType: "expense",
      sourceId: expense.id,
      date: expense.date,
      description,
      category: expense.category,
      totalAmount: expense.totalAmount,
      owedPerson1: owedPerson1.toString(),
      owedPerson2: owedPerson2.toString(),
      paidStatus: false,
      notes: null,
    } as any, settlementId);
  }
  
  // Process assets with buybacks
  for (const asset of assets) {
    // Delete existing ledger lines for this asset
    await storage.deleteOwedLinesBySource("asset", asset.id);
    
    const buybackInfo = calculateAssetBuyback(asset, periods);
    
    if (buybackInfo) {
      const keptByName = asset.keptBy === "person1" ? person1?.personName : person2?.personName;
      const description = `${asset.name} - Buyback (Kept by ${keptByName})`;
      
      await storage.createOwedLine({
        sourceType: "asset",
        sourceId: asset.id,
        date: asset.valuationDate!,
        description,
        category: null,
        totalAmount: asset.currentEstimatedValue!,
        owedPerson1: buybackInfo.owedPerson1.toString(),
        owedPerson2: buybackInfo.owedPerson2.toString(),
        paidStatus: false,
        notes: `Original price: $${parseFloat(asset.purchasePrice).toFixed(2)}`,
      } as any, settlementId);
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  const objectStorageService = new ObjectStorageService();

  // ============================================================================
  // Authentication Routes
  // ============================================================================

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============================================================================
  // Settlement Routes
  // ============================================================================

  // Create new settlement
  app.post("/api/settlements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const validated = insertSettlementSchema.parse(req.body);
      
      // Check if settlement name already exists
      const existing = await storage.getSettlementByName(validated.name);
      if (existing) {
        return res.status(400).json({ error: "Settlement name already exists" });
      }
      
      // Use user's first name or email as creator name
      const creatorName = user?.firstName || user?.email?.split('@')[0] || 'User';
      
      const settlement = await storage.createSettlement(validated, userId, creatorName);
      res.status(201).json(settlement);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all user's settlements
  app.get("/api/settlements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settlements = await storage.getUserSettlements(userId);
      res.json(settlements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get settlement by name (for joining via invite link)
  app.get("/api/settlements/by-name/:name", isAuthenticated, async (req: any, res) => {
    try {
      const settlement = await storage.getSettlementByName(req.params.name);
      if (!settlement) {
        return res.status(404).json({ error: "Settlement not found" });
      }
      
      const userId = req.user.claims.sub;
      const participants = await storage.getSettlementParticipants(settlement.id);
      
      res.json({
        settlement,
        participants,
        isParticipant: participants.some(p => p.userId === userId),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Join settlement as participant
  app.post("/api/settlements/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const settlementId = req.params.id;
      
      // Check if user is already a participant
      const existing = await storage.getParticipantByUserAndSettlement(userId, settlementId);
      if (existing) {
        return res.status(400).json({ error: "You are already a participant in this settlement" });
      }
      
      // Check if settlement already has 2 participants
      const participants = await storage.getSettlementParticipants(settlementId);
      if (participants.length >= 2) {
        return res.status(400).json({ error: "Settlement already has maximum participants (2)" });
      }
      
      // Use user's first name or email as person name
      const personName = user?.firstName || user?.email?.split('@')[0] || 'User';
      
      const participant = await storage.addParticipant({
        settlementId,
        userId,
        personName,
        role: "participant",
      });
      
      res.status(201).json(participant);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update settlement name (both participants can edit)
  app.patch("/api/settlements/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settlementId = req.params.id;
      
      // Verify user is a participant
      const participant = await storage.getParticipantByUserAndSettlement(userId, settlementId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this settlement" });
      }
      
      const validated = insertSettlementSchema.parse(req.body);
      
      // Check if new name already exists (excluding current settlement)
      const existing = await storage.getSettlementByName(validated.name);
      if (existing && existing.id !== settlementId) {
        return res.status(400).json({ error: "Settlement name already exists" });
      }
      
      const settlement = await storage.updateSettlement(settlementId, validated);
      res.json(settlement);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get settlement participants
  app.get("/api/settlements/:id/participants", isAuthenticated, async (req: any, res) => {
    try {
      const participants = await storage.getSettlementParticipants(req.params.id);
      res.json(participants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Object Storage Routes
  // ============================================================================

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      return res.sendStatus(404);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // ============================================================================
  // OCR Extraction
  // ============================================================================

  app.post("/api/ocr/extract", isAuthenticated, async (req, res) => {
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

  // ============================================================================
  // Split Periods (Both participants can edit)
  // ============================================================================

  app.get("/api/split-periods", isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = req.query.settlementId as string;
      if (!settlementId) {
        return res.status(400).json({ error: "settlementId is required" });
      }
      
      const periods = await storage.getAllSplitPeriods(settlementId);
      res.json(periods);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/split-periods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { settlementId, ...periodData } = req.body;
      
      // Verify user is a participant
      const participant = await storage.getParticipantByUserAndSettlement(userId, settlementId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this settlement" });
      }
      
      const validated = insertSplitPeriodSchema.parse(periodData);
      const period = await storage.createSplitPeriod(validated, settlementId);
      await recalculateLedger(settlementId);
      res.status(201).json(period);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/split-periods/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const period = await storage.getSplitPeriod(req.params.id);
      
      if (!period) {
        return res.status(404).json({ error: "Split period not found" });
      }
      
      // Verify user is a participant
      const participant = await storage.getParticipantByUserAndSettlement(userId, period.settlementId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this settlement" });
      }
      
      const updated = await storage.updateSplitPeriod(req.params.id, req.body);
      await recalculateLedger(period.settlementId);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================================================
  // Expenses (Only owner can edit)
  // ============================================================================

  app.get("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = req.query.settlementId as string;
      if (!settlementId) {
        return res.status(400).json({ error: "settlementId is required" });
      }
      
      const expenses = await storage.getAllExpenses(settlementId);
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { settlementId, ...expenseData } = req.body;
      
      // Verify user is a participant
      const participant = await storage.getParticipantByUserAndSettlement(userId, settlementId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this settlement" });
      }
      
      const validated = insertExpenseSchema.parse(expenseData);
      const expense = await storage.createExpense(validated, settlementId, userId);
      await recalculateLedger(settlementId);
      res.status(201).json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const expense = await storage.getExpense(req.params.id);
      
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      
      // Only owner can edit their expense
      if (expense.ownerId !== userId) {
        return res.status(403).json({ error: "You can only edit your own expenses" });
      }
      
      const updated = await storage.updateExpense(req.params.id, req.body);
      await recalculateLedger(expense.settlementId);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================================================
  // Assets (Only owner can edit)
  // ============================================================================

  app.get("/api/assets", isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = req.query.settlementId as string;
      if (!settlementId) {
        return res.status(400).json({ error: "settlementId is required" });
      }
      
      const assets = await storage.getAllAssets(settlementId);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/assets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { settlementId, ...assetData } = req.body;
      
      // Verify user is a participant
      const participant = await storage.getParticipantByUserAndSettlement(userId, settlementId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this settlement" });
      }
      
      const validated = insertAssetSchema.parse(assetData);
      const asset = await storage.createAsset(validated, settlementId, userId);
      await recalculateLedger(settlementId);
      res.status(201).json(asset);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/assets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const asset = await storage.getAsset(req.params.id);
      
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      // Only owner can edit their asset
      if (asset.ownerId !== userId) {
        return res.status(403).json({ error: "You can only edit your own assets" });
      }
      
      const updated = await storage.updateAsset(req.params.id, req.body);
      await recalculateLedger(asset.settlementId);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/assets/:id/valuation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const asset = await storage.getAsset(req.params.id);
      
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      // Only owner can update valuation
      if (asset.ownerId !== userId) {
        return res.status(403).json({ error: "You can only edit your own assets" });
      }
      
      const { currentEstimatedValue, valuationDate, keptBy } = req.body;
      const updated = await storage.updateAsset(req.params.id, {
        currentEstimatedValue,
        valuationDate,
        keptBy,
      });
      await recalculateLedger(asset.settlementId);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================================================
  // Ledger
  // ============================================================================

  app.get("/api/ledger", isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = req.query.settlementId as string;
      if (!settlementId) {
        return res.status(400).json({ error: "settlementId is required" });
      }
      
      const lines = await storage.getAllOwedLines(settlementId);
      const participants = await storage.getSettlementParticipants(settlementId);
      
      const person1OwedLines: typeof lines = [];
      const person2OwedLines: typeof lines = [];
      
      for (const line of lines) {
        const owedP1 = parseFloat(line.owedPerson1);
        const owedP2 = parseFloat(line.owedPerson2);
        
        // Group based on debt values
        // owedPerson1 > 0 means debt TO person1 (person2 owes them)
        // owedPerson2 > 0 means debt TO person2 (person1 owes them)
        if (owedP1 > 0) {
          person1OwedLines.push(line);
        } else if (owedP2 > 0) {
          person2OwedLines.push(line);
        }
      }
      
      // Calculate summary
      const totalPerson1Owed = person1OwedLines
        .filter((l) => !l.paidStatus)
        .reduce((sum, l) => sum + parseFloat(l.owedPerson1), 0);
      
      const totalPerson2Owed = person2OwedLines
        .filter((l) => !l.paidStatus)
        .reduce((sum, l) => sum + parseFloat(l.owedPerson2), 0);
      
      const netAmount = totalPerson1Owed - totalPerson2Owed;
      const netDebtor = netAmount > 0 ? "person2" : netAmount < 0 ? "person1" : null;
      
      res.json({
        person1OwedLines,
        person2OwedLines,
        participants,
        summary: {
          totalPerson1Owed,
          totalPerson2Owed,
          netAmount: Math.abs(netAmount),
          netDebtor,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ledger/:id/paid", isAuthenticated, async (req: any, res) => {
    try {
      const { paidStatus } = req.body;
      const line = await storage.updateOwedLine(req.params.id, { paidStatus });
      res.json(line);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================================================
  // CSV Export
  // ============================================================================

  app.get("/api/export/:type", isAuthenticated, async (req: any, res) => {
    const { type } = req.params;
    const settlementId = req.query.settlementId as string;
    
    if (!settlementId) {
      return res.status(400).json({ error: "settlementId is required" });
    }
    
    try {
      let data: any[] = [];
      let filename = "";
      
      if (type === "split-periods") {
        data = await storage.getAllSplitPeriods(settlementId);
        filename = "split_periods.csv";
      } else if (type === "expenses") {
        data = await storage.getAllExpenses(settlementId);
        filename = "expenses.csv";
      } else if (type === "assets") {
        data = await storage.getAllAssets(settlementId);
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

  app.get("/api/ledger/export/:type", isAuthenticated, async (req: any, res) => {
    const { type } = req.params;
    const settlementId = req.query.settlementId as string;
    
    if (!settlementId) {
      return res.status(400).json({ error: "settlementId is required" });
    }
    
    try {
      const lines = await storage.getAllOwedLines(settlementId);
      let data: any[] = [];
      
      if (type === "person1-owed") {
        data = lines.filter(line => parseFloat(line.owedPerson1) > 0);
      } else if (type === "person2-owed") {
        data = lines.filter(line => parseFloat(line.owedPerson2) > 0);
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

  // ============================================================================
  // CSV Import
  // ============================================================================

  app.post("/api/import/:type", isAuthenticated, upload.single("file"), async (req: any, res) => {
    const { type } = req.params;
    const settlementId = req.body.settlementId;
    
    if (!settlementId) {
      return res.status(400).json({ error: "settlementId is required" });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    try {
      const userId = req.user.claims.sub;
      
      // Verify user is a participant
      const participant = await storage.getParticipantByUserAndSettlement(userId, settlementId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this settlement" });
      }
      
      const csvData = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
      
      let count = 0;
      
      if (type === "split-periods") {
        for (const row of parsed.data as any[]) {
          const validated = insertSplitPeriodSchema.parse(row);
          await storage.createSplitPeriod(validated, settlementId);
          count++;
        }
      } else if (type === "expenses") {
        for (const row of parsed.data as any[]) {
          const validated = insertExpenseSchema.parse(row);
          await storage.createExpense(validated, settlementId, userId);
          count++;
        }
      } else if (type === "assets") {
        for (const row of parsed.data as any[]) {
          const validated = insertAssetSchema.parse(row);
          await storage.createAsset(validated, settlementId, userId);
          count++;
        }
      } else {
        return res.status(400).json({ error: "Invalid import type" });
      }
      
      await recalculateLedger(settlementId);
      res.json({ count, message: `Imported ${count} ${type}` });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
