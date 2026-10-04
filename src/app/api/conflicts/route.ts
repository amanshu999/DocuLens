import { NextRequest, NextResponse } from "next/server";
import { detectCrossDocumentConflicts } from "@/lib/conflicts";
import { UploadedDocument } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documents } = body as { documents?: UploadedDocument[] };

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload. Please provide an array of uploaded documents.",
        },
        { status: 400 }
      );
    }

    const readyDocs = documents.filter((d) => d.status === "ready");
    if (readyDocs.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "At least two uploaded documents are required to perform cross-document conflict analysis.",
        },
        { status: 400 }
      );
    }

    const result = await detectCrossDocumentConflicts(readyDocs);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred during conflict analysis.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}
