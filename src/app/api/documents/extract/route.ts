import { NextRequest, NextResponse } from "next/server";
import { extractDocumentContent, MAX_FILE_SIZE_BYTES } from "@/lib/extractor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No file was provided in the request.",
        },
        { status: 400 }
      );
    }

    // 1. Enforce server-side 25MB file size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File "${file.name}" exceeds the 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        },
        { status: 400 }
      );
    }

    // 2. Reject 0-byte files
    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `File "${file.name}" is empty (0 bytes).`,
        },
        { status: 400 }
      );
    }

    // 3. Convert ArrayBuffer to Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Perform format-specific extraction
    const extracted = await extractDocumentContent(buffer, {
      fileName: file.name,
      fileSize: file.size,
    });

    return NextResponse.json({
      success: true,
      extracted,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to extract text from document.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}
