# CV extraction

## Libraries and decision

The existing Node.js stack is retained, with corrected integration:

- PDF text and page rendering: https://github.com/mehmet-kozan/pdf-parse
- DOCX raw text: https://github.com/mwilliamson/mammoth.js
- English/Vietnamese OCR: https://github.com/naptha/tesseract.js

PDF rendering must use the same PDF.js version as text extraction. Mixing the
direct pdfjs-dist package with pdf-parse reproduced a worker/API version mismatch.
Both operations now use PDFParse. Next.js treats it as a server external package.

Docling (https://github.com/docling-project/docling) was also considered for
advanced layout recognition. It is not integrated: it requires a separate Python
runtime and model deployment, and needs comparison against actual problem CVs
before replacing the current pipeline.

## Pipeline

1. Extract native text per PDF page, without synthetic page-number markers.
2. Pages with fewer than 40 letters or excessive broken characters need OCR.
3. Render only these pages, at scale 3, capped at 16 million pixels per page.
4. Recognize English and Vietnamese with automatic page segmentation.
5. Preserve native metadata on OCRed pages and insert recognized pages in original order.
6. If native extraction fails, attempt rendering/OCR of the document.
7. Normalize text, then use the existing field parser or optional Gemini scan.

There is no three-page truncation. Rendering is sequential. OCR jobs share a
serialized worker queue; a failed worker is discarded so later jobs can recover.
Empty documents and password-protected PDFs return explicit scan errors.
Candidate upload extracts before writing the file, preventing orphan files when
extraction fails.

DOCX uses Mammoth raw-text extraction. TXT accepts UTF-8 and BOM-marked UTF-16.
Image uploads use the same OCR queue.

## Verification

Run `npm run test:parser` for fast regression tests.
Enable real OCR integration tests with `CV_TEST_OCR=1 npm run test:parser` on Linux
or `$env:CV_TEST_OCR='1'; npm run test:parser` in PowerShell.

Tests generate synthetic PDFs and images; no candidate data is included.
Integration coverage includes a scanned fourth page after three native pages and
simultaneous image uploads. Tesseract requires cached eng/vie traineddata or
network access to download its language models on first use. Production needs
writable language-cache storage and sufficient request timeouts for long scans.

## Known limits

OCR is not guaranteed accurate for blurred scans, unusual fonts, handwriting or
complex multi-column layouts. The per-page heuristic cannot detect all missing
image text on pages that already contain substantial native text. DOCX embedded
images are not OCRed. Legacy .doc is not supported. Long PDFs can take substantial
CPU time; this remains an HTTP pipeline, not a persistent background job queue.
AI Scan now sends the original PDF or supported image to Gemini alongside a
structured extraction prompt, so the model can interpret columns and visual
context. DOCX and TXT use extracted text. The response is schema-validated, and
AI results are not merged with potentially incorrect heuristic field guesses.
Source is only populated from an explicit source label; inferred job titles are
marked with a review warning. Gemini calls require the user's configured key
and model, and have a 120-second request timeout.

Validate against representative Vietnamese/English CVs before making accuracy
claims. A user-provided four-page scanned TopCV sample reproduced missing school,
missing source and branding mistaken for a job title. The local parser was
checked against that document. Its private contents are not committed as test
fixtures. Tests cover an anonymized equivalent and mocked Gemini requests;
mocked API responses do not establish real-model extraction accuracy.
