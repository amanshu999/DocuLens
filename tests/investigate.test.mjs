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
  resolveInvestigationStatus,
} from "../src/lib/groq.ts";

test("1. Passage Chunking - preserves real PDF page numbers", () => {
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

test("2. Passage Chunking - TXT / MD documents do NOT invent page numbers", () => {
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

test("3. Keyword Extraction - ignores common stop words", () => {
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

test("4. Passage Retrieval - ranks matching passages highest", () => {
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

test("5. Passage Retrieval - reports no matching evidence for irrelevant query", () => {
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

test("6. Citation Validation - approves legitimate citations pointing to real passages", () => {
  const mockPassages = [
    {
      id: "passage_1",
      documentId: "doc_1",
      documentName: "Agreement.pdf",
      pageNumber: 3,
      text: "The supplier will deliver components within 14 business days from order placement.",
      relevanceScore: 10,
    },
  ];

  const rawCitations = [
    {
      passageId: "passage_1",
      excerpt: "deliver components within 14 business days from order placement",
    },
  ];

  const verified = validateAndEnforceCitations(rawCitations, mockPassages);

  assert.equal(verified.length, 1);
  assert.equal(verified[0].passageId, "passage_1");
  assert.equal(verified[0].documentName, "Agreement.pdf");
  assert.equal(verified[0].pageNumber, 3);
  assert.equal(verified[0].excerpt, "deliver components within 14 business days from order placement");
});

test("7. Citation Validation - rejects fabricated passage IDs", () => {
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
      excerpt: "Standard terms and conditions apply.",
    },
  ];

  const verified = validateAndEnforceCitations(hallucinatedCitations, mockPassages);
  assert.equal(verified.length, 0, "Non-existent passage IDs must be completely rejected");
});

test("8. Citation Validation - rejects mismatched / altered / fabricated quotations", () => {
  const mockPassages = [
    {
      id: "real_passage_1",
      documentId: "doc_1",
      documentName: "Financials.pdf",
      pageNumber: 4,
      text: "Total operating expenses for FY2024 were $8.5 million, representing a 12% decrease.",
    },
  ];

  const fabricatedQuotes = [
    {
      passageId: "real_passage_1",
      // Modified dollar amount and percentage (subtle hallucination)
      excerpt: "Total operating expenses for FY2024 were $18.5 million, representing a 20% increase.",
    },
    {
      passageId: "real_passage_1",
      // Disconnected words
      excerpt: "operating decrease random hallucinated statement",
    },
  ];

  const verified = validateAndEnforceCitations(fabricatedQuotes, mockPassages);
  assert.equal(verified.length, 0, "Fabricated or altered quotes must be rejected");
});

test("9. Citation Validation - preserves page numbers only for PDFs and never for text files", () => {
  const mockPassages = [
    {
      id: "p_pdf",
      documentId: "doc_pdf",
      documentName: "Report.pdf",
      pageNumber: 5,
      text: "PDF verified claim text content.",
    },
    {
      id: "p_txt",
      documentId: "doc_txt",
      documentName: "Readme.txt",
      pageNumber: undefined,
      text: "TXT verified claim text content.",
    },
  ];

  const raw = [
    { passageId: "p_pdf", excerpt: "PDF verified claim text content." },
    { passageId: "p_txt", excerpt: "TXT verified claim text content." },
  ];

  const verified = validateAndEnforceCitations(raw, mockPassages);
  assert.equal(verified.length, 2);
  assert.equal(verified[0].pageNumber, 5, "PDF citation must preserve real page number");
  assert.equal(verified[1].pageNumber, undefined, "TXT citation must not invent page number");
});

test("10. Groq Client - fails safely with clear error if GROQ_API_KEY is missing", async () => {
  const mockPassages = [
    {
      id: "p1",
      documentId: "d1",
      documentName: "test.txt",
      text: "Sample text",
    },
  ];

  await assert.rejects(
    async () => {
      await executeGroqInvestigation("test query", mockPassages, "");
    },
    /GROQ_API_KEY is not configured/
  );
});

test("11. Groq Client - handles empty passages with immediate insufficient evidence result", async () => {
  const result = await executeGroqInvestigation("test query", [], "mock-key");

  assert.equal(result.isInsufficientEvidence, true);
  assert.equal(result.citations.length, 0);
  assert.ok(result.answer.includes("No matching information"));
});

test("12. Status Resolver - derives 'grounded' for supported answer with valid citations", () => {
  const mockResult = {
    isInsufficientEvidence: false,
    citations: [{ id: "cit_1", excerpt: "Verified quote" }],
  };

  const status = resolveInvestigationStatus("success", mockResult);
  assert.equal(status, "grounded", "Supported answer with valid citations must be resolved as 'grounded'");
});

test("13. Status Resolver - derives 'insufficient_evidence' when answer reports insufficient evidence", () => {
  const mockResult = {
    isInsufficientEvidence: true,
    citations: [],
  };

  const status = resolveInvestigationStatus("success", mockResult);
  assert.equal(status, "insufficient_evidence", "Insufficient evidence answer must NEVER be labelled 'grounded'");
});

test("14. Status Resolver - derives 'insufficient_evidence' when citations are empty/rejected even if API succeeded", () => {
  const mockResultWithNoCitations = {
    isInsufficientEvidence: false,
    citations: [], // All citations failed validation or none provided
  };

  const status = resolveInvestigationStatus("success", mockResultWithNoCitations);
  assert.equal(status, "insufficient_evidence", "An answer with 0 validated citations must be labelled 'insufficient_evidence'");
});

test("15. Status Resolver - derives 'error' for failed network / API requests", () => {
  const status1 = resolveInvestigationStatus("error", null, "Network connection lost");
  assert.equal(status1, "error");

  const status2 = resolveInvestigationStatus("pending", null);
  assert.equal(status2, "pending");
});

