# Data Validation Report

## Source Files

- Raw data PDF: IT_Requests_Summary_Full.pdf
- Charts/report PDF reference: Strategic_IT_Request_Analysis_Final_Revised.pdf

## Extraction Result

- Extracted 157 request rows from raw PDF pages 13-24.
- Extracted executive KPI and financial summaries from raw PDF pages 1 and 36.
- Extracted status totals from raw PDF page 1.
- Extracted category financial totals from raw PDF page 1.
- Extracted department headers from raw PDF pages 13-24.
- Reviewed the charts/report PDF only as a visual/structural reference; no dashboard values were taken from it.

## Validation

- No mock data was used.
- No placeholder values were added.
- No assumed, inferred, or invented values were added.
- Values that are not clearly available in the raw PDF remain unavailable or `TBD`.
- Projects and SLA pages are hidden because project timelines/progress and SLA metrics are not clearly present in the raw PDF.
- The original PDFs are not placed in `public/` and are excluded from deployment assets.

## Reconciliation Notes

- Row-level known spend from extracted request rows: ₹2,52,65,246
- Raw PDF financial summary known spend: ₹2,52,53,147 (page 1)
- Development row-level known spend: ₹1,88,57,865
- Development summary known spend: ₹1,88,45,766 (page 1)
- Detailed request rows with `TBD` amount: 16
- Raw PDF summary/data-quality sections state requests with `TBD` amount: 11 (pages 1 and 12)
- The dashboard does not invent a correction. Executive KPI/category cards use the exact summary values from page 1, while row/table views use exact request rows from pages 13-24.

## Structured Output

- `src/data/dashboard-data.json`
