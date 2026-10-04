import test from "node:test";
import assert from "node:assert/strict";
import { extractDocumentContent } from "../src/lib/extractor.ts";

/**
 * Helper to generate a minimal, valid multi-page PDF binary in memory
 */
function createValidMultiPagePdf(pagesText) {
  const streamObjs = pagesText.map((t) => {
    const stream = `BT /F1 12 Tf 50 700 Td (${t.replace(/[()\\]/g, "\\$&")}) Tj ET`;
    return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  const count = pagesText.length;
  const lines = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    `2 0 obj << /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${count} >> endobj`,
    "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  pagesText.forEach((_, i) => {
    const pageObjNum = 4 + i * 2;
    const streamObjNum = 5 + i * 2;
    lines.push(
      `${pageObjNum} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamObjNum} 0 R >> endobj`
    );
    lines.push(`${streamObjNum} 0 obj ${streamObjs[i]} endobj`);
  });

  lines.push("xref");
  lines.push(`0 ${lines.length + 1}`);
  lines.push(`trailer << /Size ${lines.length + 1} /Root 1 0 R >>`);
  lines.push("startxref");
  lines.push("9999");
  lines.push("%%EOF");

  return Buffer.from(lines.join("\n"));
}

/**
 * Helper to generate a minimal, valid DOCX archive in memory
 */
function createValidDocx(textContent) {
  // Minimal ZIP creator for uncompressed entries
  const files = [
    {
      name: "word/document.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${textContent}</w:t></w:r></w:p></w:body></w:document>`,
    },
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
    },
  ];

  const localHeaders = [];
  const centralDirs = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const contentBuf = Buffer.from(file.content, "utf8");

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(10, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(contentBuf.length, 18);
    localHeader.writeUInt32LE(contentBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    const centralDir = Buffer.alloc(46 + nameBuf.length);
    centralDir.writeUInt32LE(0x02014b50, 0);
    centralDir.writeUInt16LE(10, 4);
    centralDir.writeUInt16LE(10, 6);
    centralDir.writeUInt16LE(0, 8);
    centralDir.writeUInt16LE(0, 10);
    centralDir.writeUInt16LE(0, 12);
    centralDir.writeUInt32LE(0, 14);
    centralDir.writeUInt32LE(contentBuf.length, 16);
    centralDir.writeUInt32LE(contentBuf.length, 20);
    centralDir.writeUInt32LE(contentBuf.length, 24);
    centralDir.writeUInt16LE(nameBuf.length, 28);
    centralDir.writeUInt16LE(0, 30);
    centralDir.writeUInt16LE(0, 32);
    centralDir.writeUInt16LE(0, 34);
    centralDir.writeUInt16LE(0, 36);
    centralDir.writeUInt32LE(0, 38);
    centralDir.writeUInt32LE(offset, 42);
    nameBuf.copy(centralDir, 46);

    localHeaders.push(localHeader, contentBuf);
    centralDirs.push(centralDir);
    offset += localHeader.length + contentBuf.length;
  }

  const centralDirBuf = Buffer.concat(centralDirs);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirBuf.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, centralDirBuf, endRecord]);
}

test("1. TXT Extraction — extracts text and does NOT invent page numbers", async () => {
  const content = "DocuLens AI investigation agreement.\nSection 1: Scope of review.";
  const buffer = Buffer.from(content, "utf-8");

  const result = await extractDocumentContent(buffer, {
    fileName: "agreement.txt",
    fileSize: buffer.length,
  });

  assert.equal(result.fullText, content);
  assert.equal(result.characterCount, content.length);
  assert.equal(result.wordCount, 9);
  assert.equal(result.pages, undefined, "TXT documents must not have fake page structures");
  assert.equal(result.pageCount, undefined, "TXT documents must not have fake page numbers");
});

test("2. MD Extraction — extracts markdown text cleanly without fake page numbers", async () => {
  const content = "# Project Roadmap\n\n- Phase 1: Foundation\n- Phase 2: Document Extraction";
  const buffer = Buffer.from(content, "utf-8");

  const result = await extractDocumentContent(buffer, {
    fileName: "roadmap.md",
    fileSize: buffer.length,
  });

  assert.ok(result.fullText.includes("Phase 2: Document Extraction"));
  assert.equal(result.pages, undefined);
  assert.equal(result.pageCount, undefined);
});

test("3. PDF Extraction — preserves page boundaries and 1-indexed page numbers", async () => {
  const page1Text = "Annual Financial Audit 2025: Net revenue reported $14.2M";
  const page2Text = "Executive Summary: Milestone delivery date moved to Q4";
  const pdfBuffer = createValidMultiPagePdf([page1Text, page2Text]);

  const result = await extractDocumentContent(pdfBuffer, {
    fileName: "audit_report.pdf",
    fileSize: pdfBuffer.length,
  });

  assert.equal(result.pageCount, 2, "Page count must equal 2");
  assert.ok(Array.isArray(result.pages), "Pages array must exist for PDFs");
  assert.equal(result.pages.length, 2, "Must contain exactly 2 page items");

  // Verify exact 1-indexed page preservation
  assert.equal(result.pages[0].pageNumber, 1);
  assert.ok(result.pages[0].text.includes("Annual Financial Audit"));

  assert.equal(result.pages[1].pageNumber, 2);
  assert.ok(result.pages[1].text.includes("Executive Summary"));

  // Verify fullText contains page identifiers
  assert.ok(result.fullText.includes("[Page 1]"));
  assert.ok(result.fullText.includes("[Page 2]"));
});

test("4. DOCX Extraction — extracts raw text from Word documents", async () => {
  const docxText = "Contract Amendment #4: Delivery deadline extended to December 31.";
  const docxBuffer = createValidDocx(docxText);

  const result = await extractDocumentContent(docxBuffer, {
    fileName: "amendment.docx",
    fileSize: docxBuffer.length,
  });

  assert.ok(result.fullText.includes(docxText));
  assert.equal(result.pages, undefined, "DOCX must not have fake page structures");
  assert.equal(result.pageCount, undefined);
});

test("5. Unsupported File Extension — rejects with clear descriptive error", async () => {
  const buffer = Buffer.from("executable binary data", "utf-8");

  await assert.rejects(
    async () => {
      await extractDocumentContent(buffer, {
        fileName: "malware.exe",
        fileSize: buffer.length,
      });
    },
    /Unsupported file type "\.exe"/
  );
});

test("6. Oversized File (>25MB) — enforces server-side 25MB limit", async () => {
  const buffer = Buffer.alloc(10);
  const oversizedBytes = 26 * 1024 * 1024; // 26 MB

  await assert.rejects(
    async () => {
      await extractDocumentContent(buffer, {
        fileName: "massive_file.pdf",
        fileSize: oversizedBytes,
      });
    },
    /File exceeds the 25 MB limit/
  );
});

test("7. Empty File (0 bytes) — rejects with clear error", async () => {
  const buffer = Buffer.alloc(0);

  await assert.rejects(
    async () => {
      await extractDocumentContent(buffer, {
        fileName: "empty.txt",
        fileSize: 0,
      });
    },
    /File is empty/
  );
});

test("8. Blank / Whitespace-only Text File — rejects with clear error", async () => {
  const buffer = Buffer.from("   \n\t  \n  ", "utf-8");

  await assert.rejects(
    async () => {
      await extractDocumentContent(buffer, {
        fileName: "blank.txt",
        fileSize: buffer.length,
      });
    },
    /contains no readable text/
  );
});

test("9. Malformed / Corrupted PDF — catches error and returns descriptive message", async () => {
  const corruptBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0xaa, 0xbb]);

  await assert.rejects(
    async () => {
      await extractDocumentContent(corruptBuffer, {
        fileName: "damaged.pdf",
        fileSize: corruptBuffer.length,
      });
    },
    /Failed to parse PDF/
  );
});

test("10. Malformed / Corrupted DOCX — catches error and returns descriptive message", async () => {
  const corruptBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00]);

  await assert.rejects(
    async () => {
      await extractDocumentContent(corruptBuffer, {
        fileName: "damaged.docx",
        fileSize: corruptBuffer.length,
      });
    },
    /Failed to parse DOCX/
  );
});
