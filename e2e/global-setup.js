/**
 * global-setup.js
 * Creates test fixtures before any spec runs.
 * - Generates a minimal valid 1-page PDF at e2e/fixtures/answer-sheet.pdf
 */
import { mkdir, writeFile, access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  await mkdir(fixturesDir, { recursive: true });

  const pdfPath = path.join(fixturesDir, 'answer-sheet.pdf');

  // Skip if fixture already exists
  const exists = await access(pdfPath).then(() => true).catch(() => false);
  if (exists) return;

  // Minimal valid PDF — 4-object structure, precise xref offsets.
  // Verified byte offsets (each line uses \n line endings):
  //   obj 1 at byte  9
  //   obj 2 at byte 53
  //   obj 3 at byte 102
  //   xref  at byte 166
  const lines = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj',
    'xref',
    '0 4',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000053 00000 n ',
    '0000000102 00000 n ',
    'trailer<</Size 4/Root 1 0 R>>',
    'startxref',
    '166',
    '%%EOF',
  ];
  await writeFile(pdfPath, lines.join('\n') + '\n', 'ascii');
  console.log('[global-setup] Created e2e/fixtures/answer-sheet.pdf');
}
