import type { UploadedDocument, DocumentPassage } from "../types";

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
  "hasn't", "have", "haven't", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
  "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
  "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
  "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their",
  "theirs", "them", "themselves", "then", "there", "these", "they", "this",
  "those", "through", "to", "too", "under", "until", "up", "very", "was",
  "wasn't", "we", "were", "weren't", "what", "when", "where", "which", "while",
  "who", "whom", "why", "with", "won't", "would", "wouldn't", "you", "your",
  "yours", "yourself", "yourselves"
]);

/**
 * Splits text into logical overlapping chunks
 */
function splitTextIntoChunks(text: string, chunkSize = 800, overlap = 100): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= chunkSize) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    let end = start + chunkSize;

    // Try to break at a paragraph or sentence boundary
    if (end < trimmed.length) {
      const nextBreak = trimmed.lastIndexOf("\n", end);
      const nextPeriod = trimmed.lastIndexOf(". ", end);
      if (nextBreak > start + 200) {
        end = nextBreak;
      } else if (nextPeriod > start + 200) {
        end = nextPeriod + 1;
      }
    }

    const chunk = trimmed.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

/**
 * Chunks a single document into searchable passages, preserving PDF page numbers
 */
export function chunkDocument(doc: UploadedDocument): DocumentPassage[] {
  const passages: DocumentPassage[] = [];

  // PDF: Preserve real page boundaries
  if (doc.pages && doc.pages.length > 0) {
    doc.pages.forEach((page) => {
      const pageChunks = splitTextIntoChunks(page.text, 900, 100);
      pageChunks.forEach((chunkText, subIndex) => {
        passages.push({
          id: `${doc.id}_p${page.pageNumber}_${subIndex}`,
          documentId: doc.id,
          documentName: doc.name,
          pageNumber: page.pageNumber, // Real 1-indexed page number
          text: chunkText,
        });
      });
    });
    return passages;
  }

  // TXT / MD / DOCX: Split text cleanly without fake page numbers
  const text = doc.fullText || "";
  const chunks = splitTextIntoChunks(text, 800, 100);
  chunks.forEach((chunkText, index) => {
    passages.push({
      id: `${doc.id}_s${index}`,
      documentId: doc.id,
      documentName: doc.name,
      pageNumber: undefined, // Never invent page numbers for non-PDFs
      text: chunkText,
    });
  });

  return passages;
}

/**
 * Extracts normalized query terms excluding stop words
 */
export function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export interface RetrievalResult {
  passages: DocumentPassage[];
  hasMatchingEvidence: boolean;
  totalPassagesSearched: number;
}

/**
 * Transparent keyword & phrase matching retrieval across all uploaded documents
 */
export function retrieveRelevantPassages(
  documents: UploadedDocument[],
  query: string,
  topK = 6
): RetrievalResult {
  const readyDocs = documents.filter((d) => d.status === "ready");
  if (readyDocs.length === 0 || !query.trim()) {
    return {
      passages: [],
      hasMatchingEvidence: false,
      totalPassagesSearched: 0,
    };
  }

  // 1. Gather all document passages
  const allPassages: DocumentPassage[] = [];
  readyDocs.forEach((doc) => {
    allPassages.push(...chunkDocument(doc));
  });

  if (allPassages.length === 0) {
    return {
      passages: [],
      hasMatchingEvidence: false,
      totalPassagesSearched: 0,
    };
  }

  const keywords = extractKeywords(query);
  const normalizedQuery = query.toLowerCase().trim();

  // 2. Score passages based on keyword frequency and exact phrase matching
  const scoredPassages = allPassages.map((passage) => {
    const textLower = passage.text.toLowerCase();
    const docNameLower = passage.documentName.toLowerCase();
    let score = 0;

    // A. Exact multi-word query match bonus
    if (normalizedQuery.length > 4 && textLower.includes(normalizedQuery)) {
      score += 15;
    }

    // B. Keyword occurrence scores
    keywords.forEach((kw) => {
      // Occurrences in passage body
      const regex = new RegExp(`\\b${kw}`, "gi");
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length * 2;
      }

      // Relevance if keyword is in the document name
      if (docNameLower.includes(kw)) {
        score += 3;
      }
    });

    return {
      ...passage,
      relevanceScore: score,
    };
  });

  // 3. Sort by relevance descending
  scoredPassages.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  const hasMatchingEvidence = scoredPassages.length > 0 && (scoredPassages[0].relevanceScore || 0) > 0;
  const topPassages = scoredPassages.slice(0, topK);

  return {
    passages: topPassages,
    hasMatchingEvidence,
    totalPassagesSearched: allPassages.length,
  };
}
