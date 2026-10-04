import { NextRequest, NextResponse } from "next/server";
import { retrieveRelevantPassages } from "@/lib/retrieval";
import { executeGroqInvestigation } from "@/lib/groq";
import { UploadedDocument } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, documents } = body as {
      query?: string;
      documents?: UploadedDocument[];
    };

    // 1. Validate Query Parameter
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a valid question to investigate.",
        },
        { status: 400 }
      );
    }

    // 2. Validate Available Workspace Documents
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No documents provided. Please upload at least one document to investigate.",
        },
        { status: 400 }
      );
    }

    const readyDocs = documents.filter((d) => d.status === "ready");
    if (readyDocs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "None of the uploaded documents are ready for investigation.",
        },
        { status: 400 }
      );
    }

    // 3. Retrieve Relevant Passages via Transparent Keyword & Phrase Matching
    const retrieval = retrieveRelevantPassages(readyDocs, query, 6);

    // 4. Execute Evidence-Grounded Groq Reasoning
    const result = await executeGroqInvestigation(query.trim(), retrieval.passages);

    return NextResponse.json({
      success: true,
      result,
      retrievalMetadata: {
        totalPassagesSearched: retrieval.totalPassagesSearched,
        passagesRetrieved: retrieval.passages.length,
        hasMatchingEvidence: retrieval.hasMatchingEvidence,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred during investigation.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}
