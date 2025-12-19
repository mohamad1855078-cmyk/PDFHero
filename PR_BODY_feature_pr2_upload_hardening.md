Title: feat(security): upload validation middleware & wire endpoints (PR2)

Summary
-------
Adds an upload validation middleware to the server to harden file uploads against malformed or malicious files and resource exhaustion.

What changed
------------
- Added `server/middleware/validateUpload.ts`:
  - Enforces per-file size limit, total size limit, and max number of files (env-configurable).
  - Performs a magic-bytes check for files that look like PDFs (checks for `%PDF-`).
  - Cleans up temporary files on validation failure or error.
- Wired `validateUpload` into upload endpoints in `server/routes.ts` (merge, split, compress, protect, unlock, remove-pages, rotate, organize, crop, to-word, to-excel, to-ppt, repair).
- Added tests: `server/tests/upload.validation.test.ts` covering valid PDFs, invalid magic bytes, per-file size limit, and max-files enforcement.

Why
---
Current upload handling relied solely on `multer`'s mimetype and filename checks and did not verify content or enforce aggregate limits. This change improves security by:

- Preventing non-PDF files masquerading as PDFs from being processed.
- Reducing risk of resource exhaustion by enforcing reasonable limits.
- Ensuring temporary files are removed on validation failure.

Testing
-------
- Ran Jest locally: all server tests pass (3 test suites including the new upload validation tests).

Deployment / Environment
------------------------
New optional environment variables (defaults applied if unset):

- `UPLOAD_MAX_FILE_SIZE` (bytes) — default 31457280 (30 MB)
- `UPLOAD_MAX_TOTAL_SIZE` (bytes) — default 125829120 (120 MB)
- `UPLOAD_MAX_FILES` — default 10

Notes & follow-ups
------------------
- Consider integrating a virus/malware scanner (e.g., ClamAV or commercial scanner) as a scanning hook after successful validation.
- Consider switching to direct-to-cloud uploads (presigned URLs) to avoid server-side temp storage and improve scalability.
- Current magic-byte check only verifies PDFs; extend to other formats (Office files) if needed.

Files changed
-------------
- Added: `server/middleware/validateUpload.ts`
- Added: `server/tests/upload.validation.test.ts`
- Modified: `server/routes.ts` (import + middleware wiring)

How to create the PR
--------------------
Create the PR on GitHub from branch `feature/pr2-upload-hardening`. The branch is already pushed; GitHub suggests:

https://github.com/mohamad1855078-cmyk/PDFHero/pull/new/feature/pr2-upload-hardening

You can copy this file's contents into the PR body or use it as the PR description.
