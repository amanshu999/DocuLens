import { extractText } from "unpdf";
import mammoth from "mammoth";
import type { ExtractionResult, DocumentPage } from "../types";

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

export interface ExtractorOptions {
  fileName: string;
  fileSize: number;
}

/**
 * Extracts clean, human-readable text and structural metadata from a document buffer.
 *
 * Supported formats:
 * - PDF: Extracts text page-by-page, preserving 1-indexed page boundaries.
 * - TXT / MD: Extracts plain text and markdown directly without inventing artificial page numbers.
 * - DOCX: Extracts raw document text from Microsoft Word documents.
 *
 * @param buffer - File contents as a Node.js Buffer
 * @param options - File metadata (fileName, fileSize)
 * @returns Promise<ExtractionResult>
 */
export async function extractDocumentContent(
  buffer: Buffer,
  options: ExtractorOptions
): Promise<ExtractionResult> {
  const { fileName, fileSize } = options;

  // 1. Enforce Server-Side File Size Limit
  if (fileSize > MAX_FILE_SIZE_BYTES || buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File exceeds the 25 MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`
    );
  }

  // 2. Reject 0-byte or Empty Files
  if (!buffer || buffer.length === 0) {
    throw new Error("File is empty (0 bytes). Please upload a document with content.");
  }

  // 3. Validate Supported Extension
  const extension = "." + fileName.split(".").pop()?.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Unsupported file type "${extension}". Supported formats are: ${SUPPORTED_EXTENSIONS.join(", ")}.`
    );
  }

  // 4. Format-Specific Extraction
  switch (extension) {
    case ".txt":
    case ".md": {
      const text = buffer.toString("utf-8");
      const trimmed = text.trim();

      if (trimmed.length === 0) {
        throw new Error("The text document contains no readable text content.");
      }

      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

      return {
        fullText: text,
        characterCount: text.length,
        wordCount,
        // Explicitly undefined for non-PDFs per requirements (no fake page numbers)
        pages: undefined,
        pageCount: undefined,
      };
    }

    case ".docx": {
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value || "";
        const trimmed = text.trim();

        if (trimmed.length === 0) {
          throw new Error("The DOCX document contains no readable text.");
        }

        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

        return {
          fullText: text,
          characterCount: text.length,
          wordCount,
          pages: undefined,
          pageCount: undefined,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("no readable text")) {
          throw err;
        }
        throw new Error(
          `Failed to parse DOCX file "${fileName}". The file may be damaged or corrupted.`
        );
      }
    }

    case ".pdf": {
      try {
        // extractText from unpdf with mergePages: false returns an array of strings per page
        const uint8Array = new Uint8Array(buffer);
        const { totalPages, text } = await extractText(uint8Array, {
          mergePages: false,
        });

        if (!totalPages || totalPages === 0) {
          throw new Error("The PDF document contains 0 pages.");
        }

        const rawPages = Array.isArray(text) ? text : [text];
        const pages: DocumentPage[] = rawPages.map((pageText, index) => ({
          pageNumber: index + 1, // 1-indexed page numbers
          text: (pageText || "").trim(),
        }));

        // Construct coherent fullText with clean page delineators
        const fullText = pages
          .map((p) => (pages.length > 1 ? `[Page ${p.pageNumber}]\n${p.text}` : p.text))
          .join("\n\n");

        const trimmedFull = fullText.trim();
        const wordCount = trimmedFull ? trimmedFull.split(/\s+/).filter(Boolean).length : 0;

        // Check if PDF has zero extracted text (e.g. scanned image without OCR)
        if (wordCount === 0) {
          throw new Error(
            "The PDF was read successfully but contains no machine-readable text (it may be a scanned image or empty)."
          );
        }

        return {
          fullText,
          pages,
          pageCount: totalPages,
          characterCount: fullText.length,
          wordCount,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("no machine-readable text") || message.includes("0 pages")) {
          throw err;
        }
        throw new Error(
          `Failed to parse PDF "${fileName}". The file may be corrupted, invalid, or password-protected.`
        );
      }
    }

    default:
      throw new Error(`Unsupported file extension: ${extension}`);
  }
}
