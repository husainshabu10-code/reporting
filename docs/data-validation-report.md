# Data Validation Report

## Source Files

- Master source: IT_HOD_Report_Merged_HQHB_Tijaarat_Financial_Rechecked.docx
- Master table used: DOCX Table 38 only
- Physical last table: DOCX Table 39, used only as a summary checksum after user confirmation
- Reference PDF: Strategic_IT_Request_Report_Financial_Rechecked_Final_Continuous.pdf

## Extracted Data

- Request rows extracted: 244
- Departments: 30
- Total spend used by dashboard: INR 3,97,42,328
- Top department by requests: HQHB & Tijaarat Raabehah (87)

## Validation Checks

- Master table grand total row: GRAND TOTAL | 244 Requests | 30 Departments | 221 Approved | 18 Pending | 3 Under Review | 2 Not Approved | All | INR 3,97,42,328 | Known
- Status counts: Approved: 221, Pending: 18, Under Review: 3, Not Approved: 2
- Type counts: Subscription: 111, Software: 73, Development: 60
- Type spend: Subscription: INR 55,44,100, Software: INR 57,43,880, Development: INR 2,84,54,348
- Reference PDF text checksum found matching request/status signals: total requests 244, approved 221, pending 18, under review 3, not approved 2, approved percentage 90.6%, pending percentage 7.4%, and HQHB/Tijaarat top-department text.

## Data Integrity Notes

- The source DOCX was parsed once and only DOCX Table 38 was used as the master dataset.
- DOCX Tables 1-37 and Table 39 were used only as summary/checksum references, not as source rows.
- The chart-reference PDF was used only as a visual/reference checksum and not as the source dataset.
- No mock, placeholder, inferred, duplicated, or invented request rows were added.
- The physical last DOCX table is Table 39, a Metric/Value summary. User confirmed Table 38 is the final master source table.
- The master table contains one Not Approved request with raw amount INR 4,000. The DOCX grand total and category/type summaries exclude Not Approved amounts from known spend, so dashboard spend calculations exclude Not Approved rows while preserving the raw amount string in table/export output.
- Original DOCX/PDF source files are not copied to public assets.
