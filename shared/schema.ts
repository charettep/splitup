import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Split Periods - defines percentage ownership for different time windows
export const splitPeriods = pgTable("split_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // null means ongoing
  sharePhilippePct: decimal("share_philippe_pct", { precision: 5, scale: 2 }).notNull(), // e.g., 40.00
  shareExPct: decimal("share_ex_pct", { precision: 5, scale: 2 }).notNull(), // e.g., 60.00
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSplitPeriodSchema = createInsertSchema(splitPeriods, {
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  endDate: z.string().optional().nullable(),
  sharePhilippePct: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Must be between 0 and 100"),
  shareExPct: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Must be between 0 and 100"),
}).omit({ id: true, createdAt: true });

export type InsertSplitPeriod = z.infer<typeof insertSplitPeriodSchema>;
export type SplitPeriod = typeof splitPeriods.$inferSelect;

// Expenses - shared expenses with attachments
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidBy: text("paid_by").notNull(), // PHILIPPE or EX
  attachmentUrl: text("attachment_url"),
  // Manual override if split period not found
  manualSharePhilippePct: decimal("manual_share_philippe_pct", { precision: 5, scale: 2 }),
  manualShareExPct: decimal("manual_share_ex_pct", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expenses, {
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  totalAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Must be greater than 0"),
  paidBy: z.enum(["PHILIPPE", "EX"]),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
}).omit({ id: true, createdAt: true });

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Assets - jointly owned items
export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }).notNull(),
  paidBy: text("paid_by").notNull(), // PHILIPPE or EX
  // Manual override for original share if split period not found
  manualOriginalSharePhilippePct: decimal("manual_original_share_philippe_pct", { precision: 5, scale: 2 }),
  manualOriginalShareExPct: decimal("manual_original_share_ex_pct", { precision: 5, scale: 2 }),
  currentEstimatedValue: decimal("current_estimated_value", { precision: 10, scale: 2 }),
  valuationDate: date("valuation_date"),
  keptBy: text("kept_by"), // PHILIPPE, EX, or null
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssetSchema = createInsertSchema(assets, {
  purchaseDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  purchasePrice: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Must be greater than 0"),
  paidBy: z.enum(["PHILIPPE", "EX"]),
  keptBy: z.enum(["PHILIPPE", "EX"]).optional().nullable(),
  name: z.string().min(1, "Name is required"),
}).omit({ id: true, createdAt: true });

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// Ledger Lines - computed owed amounts (both expense reimbursements and asset buybacks)
export const owedLines = pgTable("owed_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(), // 'expense' or 'asset'
  sourceId: varchar("source_id").notNull(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  category: text("category"), // only for expenses
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  owedPhilippe: decimal("owed_philippe", { precision: 10, scale: 2 }).notNull(),
  owedEx: decimal("owed_ex", { precision: 10, scale: 2 }).notNull(),
  paidStatus: boolean("paid_status").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OwedLine = typeof owedLines.$inferSelect;

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
