# Splitup - Design Guidelines

## Design Approach: Professional Financial System

**Selected Approach:** Design System (Material Design adaptation for financial data)
**Justification:** This is a utility-focused financial settlement tool requiring clarity, trust, and data density. Users need to process sensitive financial information accurately, making established patterns and professional presentation essential.

**Core Design Principles:**
- Data clarity over visual flair - every element serves information hierarchy
- Trust through professionalism - clean, organized, business-like aesthetic
- Efficiency in data entry and review workflows
- Clear visual distinction between debts owed in each direction

---

## Color Palette

### Dark Mode (Primary)
- **Background Base:** 222 15% 12%
- **Surface Primary:** 222 15% 16%
- **Surface Secondary:** 222 15% 20%
- **Text Primary:** 0 0% 95%
- **Text Secondary:** 0 0% 70%

### Accent Colors
- **Philippe Color (Blue):** 215 85% 60% - represents Philippe's transactions
- **Ex Color (Rose):** 340 75% 65% - represents Ex's transactions
- **Positive/Owed:** 142 70% 50% - amounts owed/received
- **Warning/Unresolved:** 38 92% 60% - unresolved transactions
- **Error:** 0 85% 60%

### Light Mode
- **Background Base:** 0 0% 98%
- **Surface Primary:** 0 0% 100%
- **Surface Secondary:** 0 0% 95%
- **Text Primary:** 0 0% 10%
- **Text Secondary:** 0 0% 40%

---

## Typography

**Font Families:**
- Primary: Inter (via Google Fonts) - body text, UI elements
- Monospace: JetBrains Mono - currency amounts, dates, calculations

**Scale & Weights:**
- Headings: 600 weight, sizes: 2xl (page titles), xl (section headers), lg (card titles)
- Body: 400 weight, size: base
- Labels: 500 weight, size: sm
- Financial data: 500-600 weight (mono), size: base-lg
- Captions: 400 weight, size: xs-sm

---

## Layout System

**Spacing Primitives:** Tailwind units of 3, 4, 6, 8, 12, 16 (p-3, m-4, gap-6, etc.)

**Grid Structure:**
- Main container: max-w-7xl with px-4 lg:px-8
- Dashboard cards: grid-cols-1 lg:grid-cols-3 gap-6
- Ledger tables: Full width with horizontal scroll on mobile
- Forms: max-w-2xl centered in their container

**Page Layout:**
- Persistent top navigation (h-16) with app name, current split period indicator, and settings
- Sidebar navigation (w-64) on desktop showing: Split Periods, Expenses, Assets, Ledger (with badge counts)
- Main content area with consistent py-6 to py-8 padding

---

## Component Library

### Navigation
- **Top Bar:** Dark surface with app logo/name left, unresolved count badge center, user settings right
- **Sidebar:** Vertical nav with icons, active state using Philippe blue accent, collapse to icons-only on tablet

### Data Tables
- **Ledger Tables:** Alternating row backgrounds (surface/surface-secondary), hover states, sticky header
- **Columns:** Date (100px), Description (flex-1), Category (120px), Amount (120px mono), Paid By (100px), You Owe/She Owes (120px mono each), Actions (80px)
- **Row States:** Unpaid (default), Paid (reduced opacity with checkmark), Unresolved (warning background)

### Forms & Inputs
- **Text Inputs:** h-11, rounded-lg, border-2 with focus ring matching accent colors
- **Select Dropdowns:** Same styling as text inputs with chevron icon
- **Date Pickers:** Calendar icon prefix, formatted DD/MM/YYYY
- **Currency Inputs:** CAD $ prefix, monospace font, right-aligned, 2 decimal enforcement

### Cards
- **Split Period Cards:** border-l-4 with Philippe/Ex color gradient, shows date range, percentages, and quick-edit action
- **Expense Cards:** Compact view with thumbnail (if attachment), date, amount large (mono), category badge
- **Asset Cards:** Shows purchase info top, current valuation bottom, buyback calculation highlighted

### Upload Area
- **Receipt Upload:** Dashed border drop zone (h-48), drag-and-drop or click, shows preview thumbnails in grid
- **OCR Processing:** Loading spinner overlay, then editable draft form with extracted fields highlighted in yellow for review

### Buttons
- **Primary:** Philippe blue bg, white text, h-11, font-medium, rounded-lg
- **Secondary:** Border variant with hover:bg-surface-secondary
- **Danger:** Rose/red for delete actions
- **Icon Buttons:** w-10 h-10 rounded-lg for actions column

### Badges & Indicators
- **Category Tags:** Rounded-full, px-3, py-1, text-xs, muted background colors (groceries: green, utilities: blue, etc.)
- **Paid Status:** Small checkmark icon with "Paid" text in green
- **Unresolved Badge:** Warning triangle icon with count, pulsing animation

### Modals & Overlays
- **Upload Modal:** max-w-4xl, shows OCR extraction results with side-by-side original image and editable form
- **Confirmation Dialogs:** max-w-md, clear action buttons (Cancel secondary, Confirm primary)
- **Asset Valuation Modal:** Calculator-style layout with original price, new value, computed buyback prominent

---

## Ledger-Specific Design

### Three-Tab View
- **Tab Bar:** Sticky below header, shows "She Owes Philippe" (count), "Philippe Owes Her" (count), "Net Summary"
- **Active Tab:** Underline with Philippe blue, bold text

### Summary Panel
- **Net Settlement Card:** Large centered display, shows who owes whom final amount
- **Calculation Breakdown:** Expandable details showing sum of paid vs unpaid per direction
- **Export Actions:** CSV download buttons for each view

### Filters Bar
- **Horizontal Layout:** Date range picker, category multi-select, paid status toggle, paid_by filter
- **Clear Filters:** X button to reset, shows active filter count badge

---

## Animations

**Minimal Motion:**
- Hover transitions: 150ms ease
- Modal/drawer enter/exit: 200ms ease-in-out slide
- Loading states: Subtle pulse on skeleton screens
- NO scroll-driven or elaborate animations

---

## Receipt/Attachment Viewing

- **Thumbnail Grid:** 4 columns on desktop, 2 on mobile, rounded-lg with hover zoom preview
- **Full View Modal:** max-w-6xl, image left (or PDF viewer), extracted data right in scrollable panel
- **Edit Inline:** Click any extracted field to edit, auto-saves on blur with visual confirmation

---

## Error & Empty States

- **Unresolved Transactions:** Warning card at top of ledger with "Fix Now" CTA
- **No Data:** Centered illustration (simple icon), heading, description, primary action button
- **Import Errors:** Inline red alerts with specific row/column error details

---

## Responsive Behavior

- **Desktop (lg+):** Sidebar + main content, 3-column cards, full tables
- **Tablet (md):** Collapsed sidebar, 2-column cards, horizontal scroll tables
- **Mobile:** Bottom nav, stacked cards, simplified table views with expandable rows for details

---

## Images

**No hero images required.** This is a utility application focused on data.

**Icon System:** Use **Heroicons** (outline style) via CDN for consistent iconography:
- Upload: cloud-arrow-up
- Expense: receipt-percent  
- Asset: home
- Ledger: table-cells
- Paid: check-circle
- Unresolved: exclamation-triangle
- Export: arrow-down-tray

---

**Key Differentiator:** This design prioritizes financial data legibility and trustworthiness over visual creativity. The dual-color system (Philippe blue, Ex rose) provides instant visual parsing of who-owes-whom across all interfaces.