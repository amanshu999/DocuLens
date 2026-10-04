import type {
  UploadedDocument,
  DocumentPassage,
  ConflictAlert,
  ConflictAnalysisResult,
} from "../types";

export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

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

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function splitTextIntoChunks(text: string, chunkSize = 800, overlap = 100): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= chunkSize) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    let end = start + chunkSize;

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

function chunkDocument(doc: UploadedDocument): DocumentPassage[] {
  const passages: DocumentPassage[] = [];

  if (doc.pages && doc.pages.length > 0) {
    doc.pages.forEach((page) => {
      const pageChunks = splitTextIntoChunks(page.text, 900, 100);
      pageChunks.forEach((chunkText, subIndex) => {
        passages.push({
          id: `${doc.id}_p${page.pageNumber}_${subIndex}`,
          documentId: doc.id,
          documentName: doc.name,
          pageNumber: page.pageNumber,
          text: chunkText,
        });
      });
    });
    return passages;
  }

  const text = doc.fullText || "";
  const chunks = splitTextIntoChunks(text, 800, 100);
  chunks.forEach((chunkText, index) => {
    passages.push({
      id: `${doc.id}_s${index}`,
      documentId: doc.id,
      documentName: doc.name,
      pageNumber: undefined,
      text: chunkText,
    });
  });

  return passages;
}

export interface CandidatePassagePair {
  passageA: DocumentPassage;
  passageB: DocumentPassage;
  sharedKeywords: string[];
  overlapScore: number;
}

/**
 * Finds high-overlap passage pairs across different documents.
 * Focuses on shared entities, figures, dates, and domain-specific topic terms.
 */
export function findCandidateConflictPairs(
  documents: UploadedDocument[],
  maxPairs = 6
): CandidatePassagePair[] {
  const readyDocs = documents.filter((d) => d.status === "ready");
  if (readyDocs.length < 2) {
    return [];
  }

  // 1. Chunk each document into indexed passages
  const docPassagesMap = new Map<string, DocumentPassage[]>();
  readyDocs.forEach((doc) => {
    docPassagesMap.set(doc.id, chunkDocument(doc));
  });

  const candidatePairs: CandidatePassagePair[] = [];

  // 2. Pairwise cross-document comparison
  for (let i = 0; i < readyDocs.length; i++) {
    for (let j = i + 1; j < readyDocs.length; j++) {
      const docA = readyDocs[i];
      const docB = readyDocs[j];

      const passagesA = docPassagesMap.get(docA.id) || [];
      const passagesB = docPassagesMap.get(docB.id) || [];

      for (const passA of passagesA) {
        const textALower = passA.text.toLowerCase();
        const keywordsA = extractKeywords(passA.text);
        const setA = new Set(keywordsA);

        // Extract numeric and currency tokens (e.g., $14.2M, 2025, 30-day, 5%)
        const entitiesA = passA.text.match(/\$?\d+(?:[.,]\d+)?(?:k|m|b|%)?|\b\d{4}\b/gi) || [];
        const entitySetA = new Set(entitiesA.map((e) => e.toLowerCase()));

        for (const passB of passagesB) {
          const textBLower = passB.text.toLowerCase();
          const keywordsB = extractKeywords(passB.text);
          const entitiesB = passB.text.match(/\$?\d+(?:[.,]\d+)?(?:k|m|b|%)?|\b\d{4}\b/gi) || [];

          // Calculate shared keywords
          const sharedKeywords = keywordsB.filter((kw) => setA.has(kw));

          // Calculate shared numeric/entity context
          const sharedEntities = entitiesB.filter((ent) => entitySetA.has(ent.toLowerCase()));

          let overlapScore = sharedKeywords.length * 2 + sharedEntities.length * 3;

          // Extra bonus for high-conflict domains
          const disputeKeywords = [
            "revenue", "profit", "loss", "cost", "price", "penalty", "termination",
            "deadline", "delivery", "liability", "warranty", "salary", "effective date",
            "interest", "obligation", "audit", "discrepancy"
          ];

          disputeKeywords.forEach((dk) => {
            if (textALower.includes(dk) && textBLower.includes(dk)) {
              overlapScore += 4;
            }
          });

          // Only keep pairs with meaningful topic overlap (>= 6 score)
          if (overlapScore >= 6) {
            candidatePairs.push({
              passageA: passA,
              passageB: passB,
              sharedKeywords,
              overlapScore,
            });
          }
        }
      }
    }
  }

  // Sort by highest overlap score descending and cap at maxPairs
  candidatePairs.sort((a, b) => b.overlapScore - a.overlapScore);
  return candidatePairs.slice(0, maxPairs);
}

/**
 * Validates model-returned conflicts against real source passages.
 * Ensures both claims are grounded in distinct documents with verified quotes.
 */
export function validateAndEnforceConflicts(
  rawConflicts: Array<{
    topic?: string;
    description?: string;
    status?: string;
    claimA?: { passageId?: string; statement?: string; excerpt?: string };
    claimB?: { passageId?: string; statement?: string; excerpt?: string };
  }> | undefined,
  allPassages: DocumentPassage[]
): ConflictAlert[] {
  if (!rawConflicts || !Array.isArray(rawConflicts)) {
    return [];
  }

  const passageMap = new Map<string, DocumentPassage>();
  allPassages.forEach((p) => {
    passageMap.set(p.id, p);
    const shortId = p.id.split("_").slice(-2).join("_");
    passageMap.set(shortId, p);
  });

  const verifiedConflicts: ConflictAlert[] = [];

  rawConflicts.forEach((raw, idx) => {
    if (!raw.topic || !raw.description || !raw.claimA || !raw.claimB) {
      return;
    }

    const passA = raw.claimA.passageId ? passageMap.get(raw.claimA.passageId) : undefined;
    const passB = raw.claimB.passageId ? passageMap.get(raw.claimB.passageId) : undefined;

    // 1. Both passages must exist
    if (!passA || !passB) {
      return;
    }

    // 2. Both passages must come from DIFFERENT documents
    if (passA.documentId === passB.documentId) {
      return;
    }

    const rawExA = raw.claimA.excerpt ? String(raw.claimA.excerpt).trim() : "";
    const rawExB = raw.claimB.excerpt ? String(raw.claimB.excerpt).trim() : "";

    if (!rawExA || !rawExB) {
      return;
    }

    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
    const normTextA = normalize(passA.text);
    const normTextB = normalize(passB.text);
    const normExA = normalize(rawExA);
    const normExB = normalize(rawExB);

    const existsInA = normTextA.includes(normExA) || (normExA.length > 20 && normTextA.includes(normExA.slice(0, 20)));
    const existsInB = normTextB.includes(normExB) || (normExB.length > 20 && normTextB.includes(normExB.slice(0, 20)));

    if (!existsInA || !existsInB) {
      return;
    }

    const status =
      raw.status === "direct_contradiction"
        ? "direct_contradiction"
        : "possible_conflict_requires_review";

    const statementA = raw.claimA.statement ? String(raw.claimA.statement).trim() : rawExA;
    const statementB = raw.claimB.statement ? String(raw.claimB.statement).trim() : rawExB;

    const claimA = {
      documentId: passA.documentId,
      documentName: passA.documentName,
      passageId: passA.id,
      statement: statementA,
      excerpt: rawExA,
      pageNumber: passA.pageNumber, // Only present for PDFs
    };

    const claimB = {
      documentId: passB.documentId,
      documentName: passB.documentName,
      passageId: passB.id,
      statement: statementB,
      excerpt: rawExB,
      pageNumber: passB.pageNumber, // Only present for PDFs
    };

    verifiedConflicts.push({
      id: `conflict_${idx + 1}_${Date.now().toString(36)}`,
      topic: raw.topic.trim(),
      description: raw.description.trim(),
      status,
      claimA,
      claimB,
      // Backward compatibility fields
      documentA: {
        name: claimA.documentName,
        statement: claimA.statement,
        page: claimA.pageNumber,
        excerpt: claimA.excerpt,
      },
      documentB: {
        name: claimB.documentName,
        statement: claimB.statement,
        page: claimB.pageNumber,
        excerpt: claimB.excerpt,
      },
    });
  });

  return verifiedConflicts;
}

/**
 * Server-side cross-document contradiction detector using Groq API.
 */
export async function detectCrossDocumentConflicts(
  documents: UploadedDocument[],
  apiKey?: string,
  modelName?: string
): Promise<ConflictAnalysisResult> {
  const readyDocs = documents.filter((d) => d.status === "ready");

  if (readyDocs.length < 2) {
    return {
      timestamp: new Date().toISOString(),
      totalDocumentsAnalyzed: readyDocs.length,
      conflicts: [],
      summary: "At least two uploaded documents are required to perform cross-document conflict detection.",
    };
  }

  // 1. Gather candidate passage pairs discussing similar topics across documents
  const candidatePairs = findCandidateConflictPairs(readyDocs, 6);

  // If no overlapping topic pairs exist across the files
  if (candidatePairs.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      totalDocumentsAnalyzed: readyDocs.length,
      conflicts: [],
      summary: "No overlapping topic passages or contradictory claims were detected across the uploaded documents.",
    };
  }

  // Collect all candidate passages for citation validation
  const candidatePassages: DocumentPassage[] = [];
  const seenPassageIds = new Set<string>();

  candidatePairs.forEach((pair) => {
    if (!seenPassageIds.has(pair.passageA.id)) {
      seenPassageIds.add(pair.passageA.id);
      candidatePassages.push(pair.passageA);
    }
    if (!seenPassageIds.has(pair.passageB.id)) {
      seenPassageIds.add(pair.passageB.id);
      candidatePassages.push(pair.passageB);
    }
  });

  const activeKey = apiKey || process.env.GROQ_API_KEY;
  const activeModel = modelName || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  if (!activeKey || activeKey.trim() === "") {
    throw new Error(
      "GROQ_API_KEY is not configured on the server. Please add GROQ_API_KEY to your .env.local file to enable cross-document conflict analysis."
    );
  }

  // 2. Construct Comparison Prompt
  const comparisonsText = candidatePairs
    .map((pair, idx) => {
      const pA = pair.passageA;
      const pB = pair.passageB;
      const pAInfo = pA.pageNumber !== undefined ? `Page: ${pA.pageNumber}` : "Format: Text";
      const pBInfo = pB.pageNumber !== undefined ? `Page: ${pB.pageNumber}` : "Format: Text";

      return `--- COMPARISON PAIR ${idx + 1} ---
DOCUMENT A [ID: "${pA.id}", Source: "${pA.documentName}", ${pAInfo}]:
"${pA.text}"

DOCUMENT B [ID: "${pB.id}", Source: "${pB.documentName}", ${pBInfo}]:
"${pB.text}"
`;
    })
    .join("\n");

  const systemPrompt = `You are DocuLens AI, an objective, rigorous document investigator specialized in cross-document contradiction detection.
Analyze the provided cross-document comparison pairs to determine whether direct factual contradictions exist between different documents.

STRICT CONFLICT RULES:
1. ONLY flag a conflict if Document A and Document B make directly contradictory or incompatible statements regarding the same subject, timeline, amount, or obligation.
2. DO NOT flag differences in phrasing, complementary details, or different time periods as conflicts unless they genuinely clash.
3. NEVER choose which document is "correct" or take a side. Explain the neutral disagreement factually.
4. If a disagreement is probable but missing full context, set "status": "possible_conflict_requires_review". If explicit contradiction, set "status": "direct_contradiction".
5. Every claim MUST reference the exact passage ID and include the exact quote in "excerpt".

OUTPUT SCHEMA (JSON ONLY):
{
  "summary": "Brief neutral overview of cross-document consistency findings.",
  "conflicts": [
    {
      "topic": "Concise topic title (e.g. 'Revenue Recognition Discrepancy')",
      "description": "Objective explanation of the conflicting statements.",
      "status": "direct_contradiction" | "possible_conflict_requires_review",
      "claimA": {
        "passageId": "exact_doc_a_passage_id",
        "statement": "Summary of statement in Document A",
        "excerpt": "Exact quote from Document A passage"
      },
      "claimB": {
        "passageId": "exact_doc_b_passage_id",
        "statement": "Summary of statement in Document B",
        "excerpt": "Exact quote from Document B passage"
      }
    }
  ]
}`;

  const userPrompt = `Candidate Cross-Document Pairs:\n${comparisonsText}\n\nIdentify all genuine cross-document conflicts in the required JSON format. If all statements are consistent, return an empty "conflicts" array.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Groq API authentication failed. Please check your GROQ_API_KEY.");
      }
      if (response.status === 429) {
        throw new Error("Groq API rate limit exceeded during conflict analysis. Please wait a moment and try again.");
      }
      throw new Error(`Groq API returned HTTP error ${response.status} during conflict analysis.`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq API returned an empty response for conflict analysis.");
    }

    const parsed = JSON.parse(content);

    // Validate and enforce evidence grounding for all returned conflicts
    const verifiedConflicts = validateAndEnforceConflicts(parsed.conflicts, candidatePassages);

    return {
      timestamp: new Date().toISOString(),
      totalDocumentsAnalyzed: readyDocs.length,
      conflicts: verifiedConflicts,
      summary:
        parsed.summary ||
        (verifiedConflicts.length > 0
          ? `Detected ${verifiedConflicts.length} cross-document ${
              verifiedConflicts.length === 1 ? "discrepancy" : "discrepancies"
            } requiring review.`
          : "No material contradictions found across the analyzed documents."),
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out during cross-document conflict analysis (25s limit).");
      }
      throw err;
    }
    throw new Error("An unexpected error occurred during cross-document conflict analysis.");
  }
}
