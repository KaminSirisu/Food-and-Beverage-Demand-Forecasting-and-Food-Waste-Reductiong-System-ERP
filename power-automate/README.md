# power-automate/ — D365 export → /api/ingest flow

**Owner:** Auto · branch `feature/ingestion`

**Purpose:** Exported Power Automate flow(s) and notes for L3: pick up the daily D365 `Sales_Entry` export,
rename it to `Sales_Entry_YYYY-MM-DD.xlsx`, `POST` it to `/api/ingest`, then move it to `/archive` (200) or `/failed` (4xx) and alert on failure.

**Done means:**
- The flow is exported here (zip/JSON) with screenshots or step notes so someone else can rebuild it.
- It uses the API contract in `README-ingest.md` (headers `x-api-key`, `x-file-name`, raw body).
- Tested against the running app: LOADED, DUPLICATE and a failure case each end up in the right folder.
- No secrets committed — the API key and URLs live in the flow's connection/variables only.
