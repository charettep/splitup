# Splitup - AI-Assisted Breakup Settlement Application

## Project Overview
Splitup is a comprehensive expense and asset settlement application designed for couples separating in Quebec, Canada. The app helps track shared expenses during a split period, manage assets with buyback calculations, and maintain a dual ledger showing who owes whom with automatic settlement calculations.

## Tech Stack
- **Frontend:** React + TypeScript + Wouter routing + TanStack Query + Shadcn UI
- **Backend:** Express + TypeScript + In-memory storage
- **AI Integration:** OpenAI Vision API for OCR receipt processing
- **Storage:** Google Cloud Storage for receipt attachments
- **Styling:** Tailwind CSS with custom design system

## Key Features

### 1. Split Period Management
- Define date ranges with custom percentage shares for Philippe and Ex
- Default 50/50 split or configure custom percentages
- Automatically matches expenses/assets to periods by date

### 2. Expense Tracking
- Add expenses with date, description, category, amount, and payer
- Upload receipt images for automatic OCR extraction using OpenAI Vision
- Auto-calculate owed amounts based on split period percentages
- Manual override option for custom splits per expense

### 3. Asset Management
- Track shared assets with purchase price and original ownership
- Add current valuations with buyback calculations
- Specify who keeps the asset to calculate reimbursement owed
- Supports manual share percentages or automatic period-based calculation

### 4. Dual Ledger System
- **She Owes Philippe Tab:** Shows expenses Philippe paid (Ex owes her share) and assets Ex keeps (she owes buyback)
- **Philippe Owes Her Tab:** Shows expenses Ex paid (Philippe owes his share) and assets Philippe keeps (he owes buyback)
- Real-time net settlement calculation showing final debtor and amount
- Mark items as paid to track settlement progress

### 5. CSV Import/Export
- Export all data types to CSV for backup/analysis
- Import split periods, expenses, and assets from CSV files
- Automatic validation and ledger recalculation on import

## Business Logic

### Ledger Calculation Rules
1. **Expense Logic:** 
   - If Philippe paid → Ex owes her percentage share to Philippe
   - If Ex paid → Philippe owes his percentage share to Ex
2. **Asset Logic:**
   - If Ex keeps asset → She owes Philippe his percentage of current value (buyback)
   - If Philippe keeps asset → He owes Ex her percentage of current value (buyback)
3. **Bankers' Rounding:** All amounts use bankers' rounding (round 0.5 to nearest even)
4. **Share Calculation:**
   - Uses manual percentages if specified
   - Otherwise matches expense/asset date to split period percentages
   - Defaults to 50/50 if no matching period found

### Net Settlement
- Sums all unpaid amounts in "She Owes Philippe" ledger
- Sums all unpaid amounts in "Philippe Owes Her" ledger
- Calculates net: (She Owes) - (Philippe Owes)
- If positive: Ex is net debtor
- If negative: Philippe is net debtor
- Displays final settlement amount owed

## Design System

### Colors
- **Philippe Blue:** `hsl(215 85% 60%)` - Used for Philippe-related items
- **Ex Rose:** `hsl(340 75% 65%)` - Used for Ex-related items
- **Professional Dark Theme:** Primary dark mode with subtle accents
- **Material Design Adaptation:** Elevated cards, subtle shadows, clean spacing

### Typography
- **UI Font:** Inter - Clean, professional sans-serif for all interface text
- **Financial Font:** JetBrains Mono - Monospace for amounts and financial data
- **Hierarchy:** Three levels of text color (default, secondary, tertiary)

### Components
- Sidebar navigation with collapsible menu
- Card-based layouts for all data views
- Dialog forms for create/edit operations
- Badge indicators for status (paid/unpaid, payer, keeper)
- Empty states with helpful CTAs
- Loading skeletons during async operations
- Toast notifications for user feedback

## API Endpoints

### Split Periods
- `GET /api/split-periods` - List all periods
- `POST /api/split-periods` - Create new period
- `PATCH /api/split-periods/:id` - Update period

### Expenses
- `GET /api/expenses` - List all expenses
- `POST /api/expenses` - Create expense
- `PATCH /api/expenses/:id` - Update expense

### Assets
- `GET /api/assets` - List all assets
- `POST /api/assets` - Create asset
- `PATCH /api/assets/:id` - Update asset
- `PATCH /api/assets/:id/valuation` - Update valuation & calculate buyback

### Ledger
- `GET /api/ledger` - Get dual ledger with summary
- `PATCH /api/ledger/:id/paid` - Mark line as paid/unpaid

### OCR & Storage
- `POST /api/objects/upload` - Get upload URL for receipt
- `GET /objects/:path` - Retrieve uploaded object
- `POST /api/ocr/extract` - Extract data from receipt via OpenAI Vision

### CSV Operations
- `GET /api/export/:type` - Export to CSV (split-periods, expenses, assets, ledger)
- `POST /api/import/:type` - Import from CSV with validation

## File Structure
```
shared/
  └── schema.ts           # Shared types, Zod schemas, constants
server/
  ├── index.ts           # Express server setup
  ├── routes.ts          # All API routes & business logic
  ├── storage.ts         # In-memory storage implementation
  └── objectStorage.ts   # GCS integration for receipts
client/src/
  ├── App.tsx           # Main app with routing & layout
  ├── pages/            # Page components (split-periods, expenses, assets, ledger, import-export)
  ├── components/       # Reusable components (forms, dialogs, upload)
  └── lib/              # Utilities (queryClient)
```

## Recent Changes (October 14, 2025)
- ✅ Implemented complete data model with TypeScript interfaces and Zod validation
- ✅ Built all frontend pages with professional financial design system
- ✅ Implemented backend API with ledger calculations and bankers' rounding
- ✅ Integrated OpenAI Vision for OCR receipt processing
- ✅ Added object storage for receipt attachments
- ✅ Implemented CSV import/export functionality
- ✅ **Date Formatting Standardization:**
  - All dates display as yyyy/mm/dd with slashes across entire app
  - Added "(yyyy/mm/dd)" format guidance to all date input labels
  - HTML5 date inputs use yyyy-MM-dd format (browser standard)
- ✅ **Ledger Refactoring - Debt-Based Grouping:**
  - Changed ledger grouping from paidBy/keptBy-based to debt-value-based (robust)
  - Summary calculation now sums debt fields directly
  - CSV export updated to use debt-based filtering
  - Fixed summary totals showing $0 bug
  - All ledger logic now consistently uses debt semantic (owedPhilippe = debt TO Philippe, owedEx = debt TO Ex)
- ✅ All TypeScript LSP errors resolved
- ✅ Comprehensive E2E testing passed with all calculations verified
- ✅ Architect review passed - robust and maintainable implementation

## Environment Variables Required
- `OPENAI_API_KEY` - For OCR extraction
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - GCS bucket for receipts
- `SESSION_SECRET` - Express session security
- `PUBLIC_OBJECT_SEARCH_PATHS` - Object storage public paths
- `PRIVATE_OBJECT_DIR` - Object storage private directory

## Running the Application
```bash
npm run dev  # Starts Express backend and Vite frontend on port 5000
```

## User Workflow
1. **Setup:** Create split periods defining date ranges and share percentages
2. **Track Expenses:** Add expenses with receipts, optionally using OCR extraction
3. **Manage Assets:** Add assets and update valuations with keeper designation
4. **Review Ledger:** Check dual ledger to see who owes what
5. **Settle:** Mark items as paid and monitor net settlement amount
6. **Export:** Download CSV reports for record-keeping

## Future Enhancements
- Database persistence (PostgreSQL with Drizzle ORM)
- User authentication for multi-user access
- Email/SMS settlement reminders
- Advanced reporting and analytics
- Mobile-responsive optimizations
- Receipt image gallery view
