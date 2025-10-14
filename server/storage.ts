import {
  type SplitPeriod,
  type InsertSplitPeriod,
  type Expense,
  type InsertExpense,
  type Asset,
  type InsertAsset,
  type OwedLine,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Split Periods
  getAllSplitPeriods(): Promise<SplitPeriod[]>;
  getSplitPeriod(id: string): Promise<SplitPeriod | undefined>;
  createSplitPeriod(period: InsertSplitPeriod): Promise<SplitPeriod>;
  updateSplitPeriod(id: string, period: Partial<InsertSplitPeriod>): Promise<SplitPeriod>;
  
  // Expenses
  getAllExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense>;
  
  // Assets
  getAllAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, asset: Partial<InsertAsset>): Promise<Asset>;
  
  // Ledger
  getAllOwedLines(): Promise<OwedLine[]>;
  getOwedLine(id: string): Promise<OwedLine | undefined>;
  createOwedLine(line: Omit<OwedLine, "id" | "createdAt">): Promise<OwedLine>;
  updateOwedLine(id: string, updates: Partial<OwedLine>): Promise<OwedLine>;
  deleteOwedLinesBySource(sourceType: string, sourceId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private splitPeriods: Map<string, SplitPeriod> = new Map();
  private expenses: Map<string, Expense> = new Map();
  private assets: Map<string, Asset> = new Map();
  private owedLines: Map<string, OwedLine> = new Map();

  // Split Periods
  async getAllSplitPeriods(): Promise<SplitPeriod[]> {
    return Array.from(this.splitPeriods.values());
  }

  async getSplitPeriod(id: string): Promise<SplitPeriod | undefined> {
    return this.splitPeriods.get(id);
  }

  async createSplitPeriod(insertPeriod: InsertSplitPeriod): Promise<SplitPeriod> {
    const id = randomUUID();
    const period: SplitPeriod = {
      ...insertPeriod,
      id,
      endDate: insertPeriod.endDate || null,
      note: insertPeriod.note || null,
      createdAt: new Date(),
    };
    this.splitPeriods.set(id, period);
    return period;
  }

  async updateSplitPeriod(id: string, updates: Partial<InsertSplitPeriod>): Promise<SplitPeriod> {
    const existing = this.splitPeriods.get(id);
    if (!existing) {
      throw new Error("Split period not found");
    }
    const updated: SplitPeriod = { ...existing, ...updates };
    this.splitPeriods.set(id, updated);
    return updated;
  }

  // Expenses
  async getAllExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values());
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = {
      ...insertExpense,
      id,
      attachmentUrl: insertExpense.attachmentUrl || null,
      manualSharePhilippePct: insertExpense.manualSharePhilippePct || null,
      manualShareExPct: insertExpense.manualShareExPct || null,
      createdAt: new Date(),
    };
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: string, updates: Partial<InsertExpense>): Promise<Expense> {
    const existing = this.expenses.get(id);
    if (!existing) {
      throw new Error("Expense not found");
    }
    const updated: Expense = { ...existing, ...updates };
    this.expenses.set(id, updated);
    return updated;
  }

  // Assets
  async getAllAssets(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const id = randomUUID();
    const asset: Asset = {
      ...insertAsset,
      id,
      manualOriginalSharePhilippePct: insertAsset.manualOriginalSharePhilippePct || null,
      manualOriginalShareExPct: insertAsset.manualOriginalShareExPct || null,
      currentEstimatedValue: insertAsset.currentEstimatedValue || null,
      valuationDate: insertAsset.valuationDate || null,
      keptBy: insertAsset.keptBy || null,
      notes: insertAsset.notes || null,
      createdAt: new Date(),
    };
    this.assets.set(id, asset);
    return asset;
  }

  async updateAsset(id: string, updates: Partial<InsertAsset>): Promise<Asset> {
    const existing = this.assets.get(id);
    if (!existing) {
      throw new Error("Asset not found");
    }
    const updated: Asset = { ...existing, ...updates };
    this.assets.set(id, updated);
    return updated;
  }

  // Ledger
  async getAllOwedLines(): Promise<OwedLine[]> {
    return Array.from(this.owedLines.values());
  }

  async getOwedLine(id: string): Promise<OwedLine | undefined> {
    return this.owedLines.get(id);
  }

  async createOwedLine(line: Omit<OwedLine, "id" | "createdAt">): Promise<OwedLine> {
    const id = randomUUID();
    const owedLine: OwedLine = {
      ...line,
      id,
      createdAt: new Date(),
    };
    this.owedLines.set(id, owedLine);
    return owedLine;
  }

  async updateOwedLine(id: string, updates: Partial<OwedLine>): Promise<OwedLine> {
    const existing = this.owedLines.get(id);
    if (!existing) {
      throw new Error("Owed line not found");
    }
    const updated: OwedLine = { ...existing, ...updates };
    this.owedLines.set(id, updated);
    return updated;
  }

  async deleteOwedLinesBySource(sourceType: string, sourceId: string): Promise<void> {
    const toDelete: string[] = [];
    this.owedLines.forEach((line, id) => {
      if (line.sourceType === sourceType && line.sourceId === sourceId) {
        toDelete.push(id);
      }
    });
    toDelete.forEach((id) => this.owedLines.delete(id));
  }
}

export const storage = new MemStorage();
