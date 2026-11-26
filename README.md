# Mould Preventive Maintenance Plan — ToolSync PM

A web-based Preventive Maintenance (PM) planning, tracking, and reporting application built for managing **70+ injection moulding tools** with monthly rosters, bulk/OCR plan import, before/after PM photo logs, JSON backup/restore, and Excel export with embedded photos.

## Key Features

- **70-Tool Monthly Roster & Exchange Tracking:** Manages up to 70 tools per month (`YYYY-MM`), including tool number editing/deletion, tool exchange notes, and cross-month search by tool code, serial number, or date.
- **3 Sub-Grids per Tool (`[P]`, `[A]`, `[PIC]`):**
  - **`[P]` (Plan):** Mark or clear scheduled PM dates cell-by-cell.
  - **`[A]` (Attended / Complete):** Track completed/attended maintenance dates.
  - **`[PIC]` (Before / After Photos):** Upload, edit, preview in lightbox, remove, and add remarks for Before PM and After PM photos.
- **Bulk Text Plan Import:** Paste date-wise schedules (e.g., `2/Nov: TOOL-001, TOOL-002` or actual mould codes) to populate `[P]` marks quickly, with an option to clear existing `[P]` marks first.
- **Manual PM Plan Auto Scanner (OCR):** Upload or capture a photo of a manual/printed PM plan sheet to extract and arrange dates and tool/serial entries using `Tesseract.js` before applying to the matrix.
- **Excel Export with Embedded Photos (`ExcelJS`):** Generates a formatted `.xlsx` workbook containing the **PM Plan Matrix** sheet and a **PM Photos** sheet with embedded Before/After images, remarks, and clickable cell hyperlinks.
- **Local Persistence & JSON Backup/Restore:** Stores state in `localStorage` and supports full JSON backup export and restore for safe offline/local workflows.
- **Prepared By / Approved By Sign-Off:** Monthly sign-off fields persisted per month.

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+), Tailwind CSS (via CDN)
- **Libraries:**
  - [ExcelJS](https://github.com/exceljs/exceljs) (`v4.4.0`) for `.xlsx` export and image embedding
  - [Tesseract.js](https://tesseract.projectnaptha.com/) (`v5`) for client-side OCR scanning
- **Deployment:** Static hosting (configured for Vercel with root `index.html` redirect)

## Project Structure

```text
├── index.html          # Root redirect entry point to frontpage.html
├── frontpage.html      # Main PM matrix UI, modals, bulk/OCR panels, and toolbar
├── frontpage.js        # Core state, roster/exchange logic, OCR parser, backup & Excel export
├── frontpage.css       # Custom grid/scroll styling
├── pm-gallery.html     # PM photo gallery view
├── pm-gallery.js       # Gallery rendering and photo management logic
└── pm-gallery.css      # Gallery styling
