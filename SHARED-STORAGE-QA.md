# Shared notice storage — 2026-09-16

Implementation: complete. Deployment: pending. Verification: automated checks passed; browser and real-device checks not performed.

Scope: quarterly and lecture editors; shared current document and named draft lists. Existing ivory/navy/teal shell, 8px button radius, 44px new action targets retained. New status panel uses 14px text, wrapping controls, existing focus color, live status region, and print exclusion. Dynamic panel height is deducted from desktop workspace height.

Storage: Sites D1 DB, shared_notices keyed by document kind. Prepared statements and revision-checked writes prevent silent stale overwrites. No local data is automatically uploaded. The explicit legacy import action publishes the local document and saved drafts. Recovery data stays on the device until explicitly recovered. A public link currently allows both reading and editing. Polling is every 2 seconds in visible tabs, with focus and online refresh. Background tabs refresh when brought forward.

Evidence: node --test tests/*.test.mjs — 14 passed. Shared API tests use a real in-memory SQLite database. Independent client contexts test automatic propagation, initial retrieval, offline recovery, and conflicting writers. Invalid requests, cross-origin writes, missing database, and stale revisions are tested. Existing calendar, makeup date, export-layout and shell tests pass. Build succeeds with a Worker entry and schema-only Drizzle migration.

Browser functional, visual, responsive (360/390/768/1024/1440), component detail, accessibility keyboard, and real mobile checks: NOT TESTED. Managed Linux Sites preview guidance does not permit starting browser QA for ordinary editing and prohibits opening the production URL in the cloud browser. Automated checks do not substitute for those gates. No visual PASS or zero-minor-issues claim is made.

Known limits: each document payload including saved drafts must be below 1.8 MB. Oversized data stays in local recovery and reports the error. Concurrent changes to the same notice require an explicit choice, with previous unsaved input recoverable. Lecture and quarterly notices have separate shared records. Source viewports and mobile layout are preserved but rendering changes require browser verification.
