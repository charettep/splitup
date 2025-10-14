# SplitSettleQC - AI-Assisted Breakup Settlement App

## Overview
SplitSettleQC is a comprehensive web application designed to help individuals settle shared expenses and jointly owned assets after a separation. The app uses date-based split periods with percentage ownership shares, OCR-powered receipt processing, and automated ledger calculations with bankers' rounding.

## Core Features

### 1. Split Periods Management
- Define time windows with percentage ownership shares (Philippe % / Ex %)
- Non-overlapping date ranges with validation
- Quick presets for common splits (50/50, 60/40, 40/60)
- Ongoing periods (no end date)
- Visual indicators using color gradients

### 2. Expense Tracking
- Manual expense entry with category classification
- Receipt upload with AI OCR extraction (OpenAI Vision API)
- Automatic split resolution based on expense date
- Manual share override for unresolved expenses
- Attachment storage in object storage
- Categories: Groceries, Utilities, Rent/Mortgage, Transportation, Dining, Healthcare, Entertainment, Home Improvement, Insurance, Other

### 3. Asset Management
- Track jointly owned items with purchase details
- Current valuation input with date tracking
- Automatic buyback calculation using original ownership shares
- Visual status indicators (valued, kept by, unresolved)
- Support for manual share override

### 4. Dual Ledger System
- "She Owes Philippe" table
- "Philippe Owes Her" table
- Net settlement summary with clear instructions
- Bankers' rounding to cents (invariant: Philippe's share + Ex's share = Total)
- Mark transactions as paid
- Export ledger data to CSV

### 5. CSV Import/Export
- Bulk import for split periods, expenses, and assets
- Template downloads with proper format
- Complete audit trail export
- Data backup and restoration

## Technical Stack

### Frontend
- React with TypeScript
- Wouter for routing
- TanStack Query for data fetching
- Shadcn UI components
- Tailwind CSS with custom design system
- Dark/Light theme support

### Backend
- Express.js server
- In-memory storage (MemStorage)
- OpenAI API for OCR
- Replit Object Storage for attachments
- CSV processing with Papa Parse

### Design System
- Primary colors: Philippe Blue (215 85% 60%), Ex Rose (340 75% 65%)
- Financial data emphasis with JetBrains Mono for currency/dates
- Professional, data-focused aesthetic
- Responsive design with mobile support

## Data Model

### SplitPeriod
- id, startDate, endDate (nullable), sharePhilippePct, shareExPct, note

### Expense
- id, date, description, category, totalAmount, paidBy, attachmentUrl
- manualSharePhilippePct, manualShareExPct (for unresolved)

### Asset
- id, name, purchaseDate, purchasePrice, paidBy
- manualOriginalSharePhilippePct, manualOriginalShareExPct
- currentEstimatedValue, valuationDate, keptBy

### OwedLine (computed)
- id, sourceType (expense|asset), sourceId, date, description
- totalAmount, owedPhilippe, owedEx, paidStatus, notes

## Calculation Logic

### Expense Split
1. Find matching split period by expense date
2. Calculate: owedPhilippe = round_bankers(totalAmount * sharePhilippePct / 100)
3. Calculate: owedEx = totalAmount - owedPhilippe
4. Determine reimbursement direction based on paidBy

### Asset Buyback
1. Find original share percentages by purchase date
2. Calculate: buyback = round_bankers(currentValue * otherPartyShare / 100)
3. Create ledger entry dated valuation_date

### Bankers' Rounding
- Round to nearest cent
- If exactly 0.5 cents, round to nearest even number
- Maintains invariant: Philippe's share + Ex's share = Total

## API Endpoints

### Split Periods
- GET /api/split-periods
- POST /api/split-periods
- PATCH /api/split-periods/:id

### Expenses
- GET /api/expenses
- POST /api/expenses
- PATCH /api/expenses/:id

### Assets
- GET /api/assets
- POST /api/assets
- PATCH /api/assets/:id
- PATCH /api/assets/:id/valuation

### Ledger
- GET /api/ledger (returns both tables + summary)
- PATCH /api/ledger/:id/paid
- GET /api/ledger/export/:type (she-owes|philippe-owes|all)

### OCR
- POST /api/ocr/extract

### Import/Export
- POST /api/import/:type (split-periods|expenses|assets)
- GET /api/export/:type

### Object Storage
- POST /api/objects/upload (get presigned URL)
- GET /objects/:path (serve uploaded files)

## Project Structure

```
client/
  src/
    components/
      app-sidebar.tsx
      theme-toggle.tsx
      split-period-form.tsx
      expense-form.tsx
      receipt-upload.tsx
      asset-form.tsx
      asset-valuation-form.tsx
      ui/ (shadcn components)
    pages/
      split-periods.tsx
      expenses.tsx
      assets.tsx
      ledger.tsx
      import-export.tsx
      not-found.tsx
    App.tsx
    index.css

server/
  storage.ts (in-memory data store)
  routes.ts (API endpoints)
  objectStorage.ts (file storage)
  objectAcl.ts (access control)

shared/
  schema.ts (data models and types)
```

## Environment Variables
- OPENAI_API_KEY: For OCR receipt processing
- DEFAULT_OBJECT_STORAGE_BUCKET_ID: Object storage bucket
- PUBLIC_OBJECT_SEARCH_PATHS: Public file paths
- PRIVATE_OBJECT_DIR: Private file directory

## Recent Changes
- 2024-01-XX: Initial implementation with complete schema and frontend
- All MVP features implemented with exceptional UI/UX quality
- Dark mode support with professional financial design
- Comprehensive component library following design guidelines

## User Preferences
- Currency: CAD
- Rounding: Bankers' rounding to cents
- Storage: In-memory with CSV export for backup
- Privacy: Local storage only, no external analytics
