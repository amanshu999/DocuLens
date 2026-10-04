import test from "node:test";
import assert from "node:assert/strict";
import {
  findCandidateConflictPairs,
  validateAndEnforceConflicts,
  detectCrossDocumentConflicts,
} from "../src/lib/conflicts.ts";

test("1. Candidate Cross-Document Alignment - finds overlapping topics between different docs", () => {
  const docA = {
    id: "doc_A",
    name: "Q3_Report.pdf",
    size: 1024,
    type: "application/pdf",
    uploadedAt: new Date().toISOString(),
    status: "ready",
    pageCount: 2,
    pages: [
      { pageNumber: 1, text: "Company Q3 financial review. Total revenue recognized is $14.2M." },
    ],
  };

  const docB = {
    id: "doc_B",
    name: "Audit_Summary.txt",
    size: 1024,
    type: "text/plain",
    uploadedAt: new Date().toISOString(),
    status: "ready",
    fullText: "Independent financial audit. Total verified revenue recognized is $11.8M due to deductions.",
  };

  const candidatePairs = findCandidateConflictPairs([docA, docB]);

  assert.ok(candidatePairs.length > 0, "Must find overlapping candidate pairs");
  assert.equal(candidatePairs[0].passageA.documentId, "doc_A");
  assert.equal(candidatePairs[0].passageB.documentId, "doc_B");
  assert.ok(candidatePairs[0].overlapScore >= 6);
});

test("2. Candidate Cross-Document Alignment - never pairs a document with itself", () => {
  const docA = {
    id: "doc_A",
    name: "DocA.txt",
    size: 512,
    type: "text/plain",
    uploadedAt: new Date().toISOString(),
    status: "ready",
    fullText: "Section 1: Revenue $14M.\n\nSection 2: Revenue $15M.",
  };

  // Only 1 document
  const candidatePairs = findCandidateConflictPairs([docA]);
  assert.equal(candidatePairs.length, 0, "Must not generate conflict candidates for single document");
});

test("3. Conflict Validation - approves legitimate contradiction with real excerpts & page numbers", () => {
  const passages = [
    {
      id: "pass_A_1",
      documentId: "doc_A",
      documentName: "Contract_A.pdf",
      pageNumber: 4,
      text: "The delivery deadline is strictly November 15, 2026. Liquidated damages apply thereafter.",
    },
    {
      id: "pass_B_1",
      documentId: "doc_B",
      documentName: "Amendment_B.docx",
      pageNumber: undefined,
      text: "The delivery deadline has been rescheduled to January 30, 2027 by mutual agreement.",
    },
  ];

  const rawConflicts = [
    {
      topic: "Delivery Deadline Discrepancy",
      description: "Contract A specifies November 15, 2026 whereas Amendment B specifies January 30, 2027.",
      status: "direct_contradiction",
      claimA: {
        passageId: "pass_A_1",
        statement: "Delivery deadline is November 15, 2026",
        excerpt: "delivery deadline is strictly November 15, 2026",
      },
      claimB: {
        passageId: "pass_B_1",
        statement: "Delivery deadline is January 30, 2027",
        excerpt: "delivery deadline has been rescheduled to January 30, 2027",
      },
    },
  ];

  const verified = validateAndEnforceConflicts(rawConflicts, passages);

  assert.equal(verified.length, 1);
  assert.equal(verified[0].topic, "Delivery Deadline Discrepancy");
  assert.equal(verified[0].status, "direct_contradiction");
  assert.equal(verified[0].claimA.documentName, "Contract_A.pdf");
  assert.equal(verified[0].claimA.pageNumber, 4, "PDF page number must be preserved");
  assert.equal(verified[0].claimB.documentName, "Amendment_B.docx");
  assert.equal(verified[0].claimB.pageNumber, undefined, "DOCX must have undefined page number");
});

test("4. Conflict Validation - rejects fabricated passage IDs and fabricated quotes", () => {
  const passages = [
    {
      id: "pass_real_1",
      documentId: "doc_1",
      documentName: "Policy.pdf",
      pageNumber: 1,
      text: "Employees receive 20 days of paid annual leave.",
    },
    {
      id: "pass_real_2",
      documentId: "doc_2",
      documentName: "Handbook.txt",
      pageNumber: undefined,
      text: "Employees are entitled to 25 days of paid annual leave.",
    },
  ];

  const hallucinatedConflicts = [
    {
      topic: "Fake Conflict 1",
      description: "Non-existent passage IDs",
      claimA: {
        passageId: "fake_passage_id_999",
        excerpt: "some text",
      },
      claimB: {
        passageId: "pass_real_2",
        excerpt: "25 days of paid annual leave",
      },
    },
    {
      topic: "Fake Conflict 2",
      description: "Fabricated excerpt quote not in passage",
      claimA: {
        passageId: "pass_real_1",
        excerpt: "Employees receive 999 days off work without pay completely fabricated quote",
      },
      claimB: {
        passageId: "pass_real_2",
        excerpt: "25 days of paid annual leave",
      },
    },
    {
      topic: "Fake Conflict 3",
      description: "Both claims from the same document",
      claimA: {
        passageId: "pass_real_1",
        excerpt: "20 days of paid annual leave",
      },
      claimB: {
        passageId: "pass_real_1", // Same passage / doc
        excerpt: "20 days of paid annual leave",
      },
    },
  ];

  const verified = validateAndEnforceConflicts(hallucinatedConflicts, passages);
  assert.equal(verified.length, 0, "All hallucinated conflicts must be rejected");
});

test("5. Cross-Document Engine - safely returns guidance when < 2 documents exist", async () => {
  const singleDoc = [
    {
      id: "doc1",
      name: "one.txt",
      size: 100,
      type: "text/plain",
      uploadedAt: new Date().toISOString(),
      status: "ready",
      fullText: "Only one document in workspace.",
    },
  ];

  const result = await detectCrossDocumentConflicts(singleDoc, "mock-key");

  assert.equal(result.conflicts.length, 0);
  assert.ok(result.summary.includes("At least two"));
});

test("6. Cross-Document Engine - fails safely if GROQ_API_KEY is missing when pairs exist", async () => {
  const docs = [
    {
      id: "doc1",
      name: "one.txt",
      size: 100,
      type: "text/plain",
      uploadedAt: new Date().toISOString(),
      status: "ready",
      fullText: "Project budget is set to $100,000 for development.",
    },
    {
      id: "doc2",
      name: "two.txt",
      size: 100,
      type: "text/plain",
      uploadedAt: new Date().toISOString(),
      status: "ready",
      fullText: "Project budget is capped strictly at $50,000 for development.",
    },
  ];

  await assert.rejects(
    async () => {
      await detectCrossDocumentConflicts(docs, "");
    },
    /GROQ_API_KEY is not configured/
  );
});
