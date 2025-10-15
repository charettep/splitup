import {
  users,
  settlements,
  settlementParticipants,
  splitPeriods,
  expenses,
  assets,
  owedLines,
  aiChatMessages,
  type User,
  type UpsertUser,
  type Settlement,
  type InsertSettlement,
  type SettlementParticipant,
  type InsertSettlementParticipant,
  type SplitPeriod,
  type InsertSplitPeriod,
  type Expense,
  type InsertExpense,
  type Asset,
  type InsertAsset,
  type OwedLine,
  type AIChatMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Storage interface for all database operations
export interface IStorage {
  // ============ User Operations (Required by Replit Auth) ============
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // ============ Settlement Operations ============
  createSettlement(settlementData: InsertSettlement, creatorId: string, creatorName: string): Promise<Settlement>;
  getSettlement(id: string): Promise<Settlement | undefined>;
  getSettlementByName(name: string): Promise<Settlement | undefined>;
  updateSettlement(id: string, updates: Partial<InsertSettlement>): Promise<Settlement>;
  getUserSettlements(userId: string): Promise<Settlement[]>;

  // ============ Settlement Participant Operations ============
  addParticipant(participantData: InsertSettlementParticipant): Promise<SettlementParticipant>;
  getSettlementParticipants(settlementId: string): Promise<SettlementParticipant[]>;
  getParticipantByUserAndSettlement(userId: string, settlementId: string): Promise<SettlementParticipant | undefined>;

  // ============ Split Periods ============
  getAllSplitPeriods(settlementId: string): Promise<SplitPeriod[]>;
  getSplitPeriod(id: string): Promise<SplitPeriod | undefined>;
  createSplitPeriod(period: InsertSplitPeriod, settlementId: string): Promise<SplitPeriod>;
  updateSplitPeriod(id: string, period: Partial<InsertSplitPeriod>): Promise<SplitPeriod>;

  // ============ Expenses ============
  getAllExpenses(settlementId: string): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense, settlementId: string, ownerId: string): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense>;

  // ============ Assets ============
  getAllAssets(settlementId: string): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset, settlementId: string, ownerId: string): Promise<Asset>;
  updateAsset(id: string, asset: Partial<InsertAsset>): Promise<Asset>;

  // ============ Ledger ============
  getAllOwedLines(settlementId: string): Promise<OwedLine[]>;
  getOwedLine(id: string): Promise<OwedLine | undefined>;
  createOwedLine(line: Omit<OwedLine, "id" | "createdAt">, settlementId: string): Promise<OwedLine>;
  updateOwedLine(id: string, updates: Partial<OwedLine>): Promise<OwedLine>;
  deleteOwedLinesBySource(sourceType: string, sourceId: string): Promise<void>;

  // ============ AI Chat ============
  getChatHistory(settlementId: string, userId: string): Promise<AIChatMessage[]>;
  saveChatMessage(settlementId: string, userId: string, role: string, content: string): Promise<AIChatMessage>;
}

// PostgreSQL Database Storage Implementation
export class DatabaseStorage implements IStorage {
  // ============ User Operations ============
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // ============ Settlement Operations ============
  async createSettlement(
    settlementData: InsertSettlement,
    creatorId: string,
    creatorName: string
  ): Promise<Settlement> {
    const [settlement] = await db
      .insert(settlements)
      .values({
        ...settlementData,
        creatorId,
      })
      .returning();

    // Add creator as first participant (person1)
    await db.insert(settlementParticipants).values({
      settlementId: settlement.id,
      userId: creatorId,
      personName: creatorName,
      role: "creator",
    });

    return settlement;
  }

  async getSettlement(id: string): Promise<Settlement | undefined> {
    const [settlement] = await db.select().from(settlements).where(eq(settlements.id, id));
    return settlement;
  }

  async getSettlementByName(name: string): Promise<Settlement | undefined> {
    const [settlement] = await db.select().from(settlements).where(eq(settlements.name, name));
    return settlement;
  }

  async updateSettlement(id: string, updates: Partial<InsertSettlement>): Promise<Settlement> {
    const [settlement] = await db
      .update(settlements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(settlements.id, id))
      .returning();
    
    if (!settlement) {
      throw new Error("Settlement not found");
    }
    return settlement;
  }

  async getUserSettlements(userId: string): Promise<Settlement[]> {
    const userSettlements = await db
      .select({
        settlement: settlements,
      })
      .from(settlementParticipants)
      .innerJoin(settlements, eq(settlementParticipants.settlementId, settlements.id))
      .where(eq(settlementParticipants.userId, userId));

    return userSettlements.map(row => row.settlement);
  }

  // ============ Settlement Participant Operations ============
  async addParticipant(participantData: InsertSettlementParticipant): Promise<SettlementParticipant> {
    const [participant] = await db
      .insert(settlementParticipants)
      .values(participantData)
      .returning();
    return participant;
  }

  async getSettlementParticipants(settlementId: string): Promise<SettlementParticipant[]> {
    return await db
      .select()
      .from(settlementParticipants)
      .where(eq(settlementParticipants.settlementId, settlementId));
  }

  async getParticipantByUserAndSettlement(
    userId: string,
    settlementId: string
  ): Promise<SettlementParticipant | undefined> {
    const [participant] = await db
      .select()
      .from(settlementParticipants)
      .where(
        and(
          eq(settlementParticipants.userId, userId),
          eq(settlementParticipants.settlementId, settlementId)
        )
      );
    return participant;
  }

  // ============ Split Periods ============
  async getAllSplitPeriods(settlementId: string): Promise<SplitPeriod[]> {
    return await db
      .select()
      .from(splitPeriods)
      .where(eq(splitPeriods.settlementId, settlementId));
  }

  async getSplitPeriod(id: string): Promise<SplitPeriod | undefined> {
    const [period] = await db.select().from(splitPeriods).where(eq(splitPeriods.id, id));
    return period;
  }

  async createSplitPeriod(insertPeriod: InsertSplitPeriod, settlementId: string): Promise<SplitPeriod> {
    const [period] = await db
      .insert(splitPeriods)
      .values({
        ...insertPeriod,
        settlementId,
      })
      .returning();
    return period;
  }

  async updateSplitPeriod(id: string, updates: Partial<InsertSplitPeriod>): Promise<SplitPeriod> {
    const [period] = await db
      .update(splitPeriods)
      .set(updates)
      .where(eq(splitPeriods.id, id))
      .returning();
    
    if (!period) {
      throw new Error("Split period not found");
    }
    return period;
  }

  // ============ Expenses ============
  async getAllExpenses(settlementId: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(eq(expenses.settlementId, settlementId));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(insertExpense: InsertExpense, settlementId: string, ownerId: string): Promise<Expense> {
    const [expense] = await db
      .insert(expenses)
      .values({
        ...insertExpense,
        settlementId,
        ownerId,
      })
      .returning();
    return expense;
  }

  async updateExpense(id: string, updates: Partial<InsertExpense>): Promise<Expense> {
    const [expense] = await db
      .update(expenses)
      .set(updates)
      .where(eq(expenses.id, id))
      .returning();
    
    if (!expense) {
      throw new Error("Expense not found");
    }
    return expense;
  }

  // ============ Assets ============
  async getAllAssets(settlementId: string): Promise<Asset[]> {
    return await db
      .select()
      .from(assets)
      .where(eq(assets.settlementId, settlementId));
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async createAsset(insertAsset: InsertAsset, settlementId: string, ownerId: string): Promise<Asset> {
    const [asset] = await db
      .insert(assets)
      .values({
        ...insertAsset,
        settlementId,
        ownerId,
      })
      .returning();
    return asset;
  }

  async updateAsset(id: string, updates: Partial<InsertAsset>): Promise<Asset> {
    const [asset] = await db
      .update(assets)
      .set(updates)
      .where(eq(assets.id, id))
      .returning();
    
    if (!asset) {
      throw new Error("Asset not found");
    }
    return asset;
  }

  // ============ Ledger ============
  async getAllOwedLines(settlementId: string): Promise<OwedLine[]> {
    return await db
      .select()
      .from(owedLines)
      .where(eq(owedLines.settlementId, settlementId));
  }

  async getOwedLine(id: string): Promise<OwedLine | undefined> {
    const [line] = await db.select().from(owedLines).where(eq(owedLines.id, id));
    return line;
  }

  async createOwedLine(line: Omit<OwedLine, "id" | "createdAt">, settlementId: string): Promise<OwedLine> {
    const [owedLine] = await db
      .insert(owedLines)
      .values({
        ...line,
        settlementId,
      })
      .returning();
    return owedLine;
  }

  async updateOwedLine(id: string, updates: Partial<OwedLine>): Promise<OwedLine> {
    const [line] = await db
      .update(owedLines)
      .set(updates)
      .where(eq(owedLines.id, id))
      .returning();
    
    if (!line) {
      throw new Error("Owed line not found");
    }
    return line;
  }

  async deleteOwedLinesBySource(sourceType: string, sourceId: string): Promise<void> {
    await db
      .delete(owedLines)
      .where(
        and(
          eq(owedLines.sourceType, sourceType),
          eq(owedLines.sourceId, sourceId)
        )
      );
  }

  // ============ AI Chat ============
  async getChatHistory(settlementId: string, userId: string): Promise<AIChatMessage[]> {
    return await db
      .select()
      .from(aiChatMessages)
      .where(
        and(
          eq(aiChatMessages.settlementId, settlementId),
          eq(aiChatMessages.userId, userId)
        )
      );
  }

  async saveChatMessage(
    settlementId: string,
    userId: string,
    role: string,
    content: string
  ): Promise<AIChatMessage> {
    const [message] = await db
      .insert(aiChatMessages)
      .values({
        settlementId,
        userId,
        role,
        content,
      })
      .returning();
    return message;
  }
}

// Export singleton instance
export const storage = new DatabaseStorage();
