import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  decimal,
  date,
  timestamp,
  boolean,
  index,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ============================================================================
// Authentication Tables (Required by Replit Auth)
// ============================================================================

// Session storage table (MANDATORY for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table (MANDATORY for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ============================================================================
// Settlement Tables (Multi-User Collaboration)
// ============================================================================

// Settlements - collaborative workspaces for expense/asset tracking
export const settlements = pgTable("settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(), // Unique for shareable URLs
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettlementSchema = createInsertSchema(settlements, {
  name: z.string().min(3, "Settlement name must be at least 3 characters")
    .max(100, "Settlement name must be less than 100 characters")
    .regex(/^[a-zA-Z0-9-_]+$/, "Settlement name can only contain letters, numbers, hyphens, and underscores"),
}).omit({ id: true, creatorId: true, createdAt: true, updatedAt: true });

export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type Settlement = typeof settlements.$inferSelect;

// Settlement Participants - 2-person model (creator + 1 invited collaborator)
export const settlementParticipants = pgTable("settlement_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull().references(() => settlements.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  personName: varchar("person_name", { length: 100 }).notNull(), // Display name in settlement (e.g., "Philippe", "Valerie")
  role: text("role").notNull(), // 'creator' or 'participant'
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.settlementId, table.userId), // User can only join a settlement once
]);

export const insertSettlementParticipantSchema = createInsertSchema(settlementParticipants, {
  personName: z.string().min(1, "Person name is required").max(100),
  role: z.enum(["creator", "participant"]),
}).omit({ id: true, joinedAt: true });

export type InsertSettlementParticipant = z.infer<typeof insertSettlementParticipantSchema>;
export type SettlementParticipant = typeof settlementParticipants.$inferSelect;

// ============================================================================
// Split Periods - defines percentage ownership for different time windows
// ============================================================================

export const splitPeriods = pgTable("split_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull().references(() => settlements.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // null means ongoing
  person1SharePct: decimal("person1_share_pct", { precision: 5, scale: 2 }).notNull(), // Creator's share
  person2SharePct: decimal("person2_share_pct", { precision: 5, scale: 2 }).notNull(), // Participant's share
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSplitPeriodSchema = createInsertSchema(splitPeriods, {
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  endDate: z.string().optional().nullable(),
  person1SharePct: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Must be between 0 and 100"),
  person2SharePct: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Must be between 0 and 100"),
}).omit({ id: true, settlementId: true, createdAt: true });

export type InsertSplitPeriod = z.infer<typeof insertSplitPeriodSchema>;
export type SplitPeriod = typeof splitPeriods.$inferSelect;

// ============================================================================
// Expenses - shared expenses with attachments
// ============================================================================

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull().references(() => settlements.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").notNull().references(() => users.id), // User who created this expense
  date: date("date").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidBy: text("paid_by").notNull(), // 'person1' or 'person2'
  receiptUrl: text("receipt_url"), // Receipt image from OCR
  documentUrl: text("document_url"), // Supporting document (PDF, image, etc.)
  // Manual override if split period not found
  manualPerson1SharePct: decimal("manual_person1_share_pct", { precision: 5, scale: 2 }),
  manualPerson2SharePct: decimal("manual_person2_share_pct", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expenses, {
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  totalAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Must be greater than 0"),
  paidBy: z.enum(["person1", "person2"]),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
}).omit({ id: true, settlementId: true, ownerId: true, createdAt: true });

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// ============================================================================
// Assets - jointly owned items
// ============================================================================

export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull().references(() => settlements.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").notNull().references(() => users.id), // User who created this asset
  name: text("name").notNull(),
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }).notNull(),
  paidBy: text("paid_by").notNull(), // 'person1' or 'person2'
  documentUrl: text("document_url"), // Supporting document (receipt, invoice, etc.)
  // Manual override for original share if split period not found
  manualOriginalPerson1SharePct: decimal("manual_original_person1_share_pct", { precision: 5, scale: 2 }),
  manualOriginalPerson2SharePct: decimal("manual_original_person2_share_pct", { precision: 5, scale: 2 }),
  currentEstimatedValue: decimal("current_estimated_value", { precision: 10, scale: 2 }),
  valuationDate: date("valuation_date"),
  keptBy: text("kept_by"), // 'person1', 'person2', or null
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssetSchema = createInsertSchema(assets, {
  purchaseDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  purchasePrice: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Must be greater than 0"),
  paidBy: z.enum(["person1", "person2"]),
  keptBy: z.enum(["person1", "person2"]).optional().nullable(),
  name: z.string().min(1, "Name is required"),
}).omit({ id: true, settlementId: true, ownerId: true, createdAt: true });

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// ============================================================================
// Ledger Lines - computed owed amounts (expense reimbursements + asset buybacks)
// ============================================================================

export const owedLines = pgTable("owed_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull().references(() => settlements.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'expense' or 'asset'
  sourceId: varchar("source_id").notNull(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  category: text("category"), // only for expenses
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  owedPerson1: decimal("owed_person1", { precision: 10, scale: 2 }).notNull(), // Debt TO person1
  owedPerson2: decimal("owed_person2", { precision: 10, scale: 2 }).notNull(), // Debt TO person2
  paidStatus: boolean("paid_status").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OwedLine = typeof owedLines.$inferSelect;

// ============================================================================
// AI Chat History - private conversation per user
// ============================================================================

export const aiChatMessages = pgTable("ai_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull().references(() => settlements.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id), // Private to this user
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AIChatMessage = typeof aiChatMessages.$inferSelect;

// ============================================================================
// Constants & Helpers
// ============================================================================

// Categories for expenses
export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Utilities",
  "Rent/Mortgage",
  "Transportation",
  "Dining",
  "Healthcare",
  "Entertainment",
  "Home Improvement",
  "Insurance",
  "Other",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// OCR extracted data structure
export const ocrExtractedDataSchema = z.object({
  date: z.string().optional(),
  vendor: z.string().optional(),
  totalAmount: z.string().optional(),
  currency: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    amount: z.string().optional(),
  })).optional(),
});

export type OCRExtractedData = z.infer<typeof ocrExtractedDataSchema>;
