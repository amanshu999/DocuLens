import test from "node:test";
import assert from "node:assert/strict";
import {
  chunkDocument,
  extractKeywords,
  retrieveRelevantPassages,
} from "../src/lib/retrieval.ts";
import {
  validateAndEnforceCitations,
  executeGroqInvestigation,
} from "../src/lib/groq.ts";

test("1. Passage Chunking — preserves real PDF page numbers", () => {
  const mockPdfDoc = {
    id: "doc_pdf_1",
    name: "Q3_Report.pdf",
    size: 2048,
    type: "application/pdf",
    uploadedAt: new Date().toISOString(),
    status: "ready",
    pageCount: 2,
    pages: [
      { pageNumber: 1, text: "Page 1 intro: Company overview and quarterly highlights." },
      { pageNumber: 2, text: "Page 2 financials: Net recognized revenue reached $14.2M." },
    ],
  };

  const passages = chunkDocument(mockPdfDoc);

  assert.equal(passages.length, 2);
  assert.equal(passages[0].pageNumber, 1);
  assert.equal(passages[0].documentName, "Q3_Report.pdf");
  assert.equal(passages[1].pageNumber, 2);
  assert.ok(passages[1].text.includes("$14.2M"));
});

test("2. Passage Chunking — TXT / MD documents do NOT invent page numbers", () => {
  const mockTxtDoc = {
    id: "doc_txt_1",
    name: "notes.txt",
    size: 512,
    type: "text/plain",
    uploadedAt: new Date().toISOString(),
    status: "ready",
    fullText: "Contract terms: Termination requires 30-day notice with zero penalty.",
  };

  const passages = chunkDocument(mockTxtDoc);

  assert.equal(passages.length, 1);
  assert.equal(passages[0].pageNumber, undefined, "TXT documents must have undefined pageNumber");
  assert.equal(passages[0].documentName, "notes.txt");
});

test("3. Keyword Extraction — ignores common stop words", () => {
  const keywords = extractKeywords("What are the stated termination terms and penalty clauses in the contract?");
  assert.ok(keywords.includes("termination"));
  assert.ok(keywords.includes("terms"));
  assert.ok(keywords.includes("penalty"));
  assert.ok(keywords.includes("clauses"));
  assert.ok(keywords.includes("contract"));
  assert.ok(!keywords.includes("what"));
  assert.ok(!keywords.includes("the"));
  assert.ok(!keywords.includes("and"));
  assert.ok(!keywords.includes("in"));
});

test("4. Passage Retrieval — ranks matching passages highest", () => {
  const mockDocs = [
    {
      id: "doc1",
      name: "legal.pdf",
      size: 1024,
      type: "application/pdf",
      uploadedAt: new Date().toISOString(),
      status: "ready",
      pageCount: 2,
      pages: [
        { pageNumber: 1, text: "Employee handbook and general office guidelines." },
        { pageNumber: 2, text: "Compliance review: Termination penalties are capped at $5,000." },
      ],
    },
    {
      id: "doc2",
      name: "financials.txt",
      size: 1024,
      type: "text/plain",
      uploadedAt: new Date().toISOString(),
      status: "ready",
      fullText: "Revenue details for the fiscal year 2025.",
    },
  ];

  const result = retrieveRelevantPassages(mockDocs, "What is the penalty for termination?", 3);

  assert.equal(result.hasMatchingEvidence, true);
  assert.ok(result.passages.length > 0);
  assert.equal(result.passages[0].pageNumber, 2);
  assert.ok(result.passages[0].text.includes("Termination penalties"));
});

test("5. Passage Retrieval — reports no matching evidence for irrelevant query", () => {
  const mockDocs = [
    {
      id: "doc1",
      name: "specs.txt",
      size: 512,
      type: "text/plain",
      uploadedAt: new Date().toISOString(),
      status: "ready",
      fullText: "Server deployment checklist for Kubernetes cluster.",
    },
  ];

  const result = retrieveRelevantPassages(mockDocs, "quantum physics teleportation protocol", 3);
  assert.equal(result.hasMatchingEvidence, false);
});

test("6. Citation Validation — approves legitimate citations pointing to real passages", () => {
  const mockPassages = [
    {
      id: "passage_1",
      documentId: "doc_1",
      documentName: "Agreement.pdf",
      pageNumber: 3,
      text: "The supplier will deliver components within 14 business days.",
      relevanceScore: 10,
    },
  ];

  const rawCitations = [
    {
      passageId: "passage_1",
      excerpt: "deliver components within 14 business days",
    },
  ];

  const verified = validateAndEnforceCitations(rawCitations, mockPassages);

  assert.equal(verified.length, 1);
  assert.equal(verified[0].passageId, "passage_1");
  assert.equal(verified[0].documentName, "Agreement.pdf");
  assert.equal(verified[0].pageNumber, 3);
  assert.equal(verified[0].excerpt, "deliver components within 14 business days");
});

test("7. Citation Validation — rejects hallucinations and non-existent passage IDs", () => {
  const mockPassages = [
    {
      id: "real_passage_1",
      documentId: "doc_1",
      documentName: "Doc.pdf",
      pageNumber: 1,
      text: "Standard terms and conditions apply.",
    },
  ];

  const hallucinatedCitations = [
    {
      passageId: "fake_passage_999", // Non-existent passage ID
      excerpt: "Fabricated statement not in document",
    },
    {
      passageId: "real_passage_1",
      excerpt: "Completely made up text that does not exist anywhere in real_passage_1 at all",
    },
  ];

  const verified = validateAndEnforceCitations(hallucinatedCitations, mockPassages);
  assert.equal(verified.length, 0, "Hallucinated citations must be completely rejected");
});

test("8. Groq Client — fails safely with clear error if GROQ_API_KEY is missing", async () => {
  const mockPassages = [
    {
      id: "p1",
      documentId: "d1",
      documentName: "test.txt",
      text: "Sample text",
    },
  ];

  // Pass empty string as API key
  await assert.rejects(
    async () => {
      await executeGroqInvestigation("test query", mockPassages, "");
    },
    /GROQ_API_KEY is not configured/
  );
});

test("9. Groq Client — handles empty passages with immediate insufficient evidence result", async () => {
  const result = await executeGroqInvestigation("test query", [], "mock-key");

  assert.equal(result.isInsufficientEvidence, true);
  assert.equal(result.citations.length, 0);
  assert.ok(result.answer.includes("No matching information"));
});
