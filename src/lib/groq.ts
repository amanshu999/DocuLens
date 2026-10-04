import type { DocumentPassage, EvidenceCitation, InvestigationResult } from "../types";

export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
export const FALLBACK_GROQ_MODELS = [
  "qwen-2.5-32b",
  "deepseek-r1-distill-qwen-32b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

export interface GroqAnswerRawResponse {
  answer: string;
  isInsufficientEvidence: boolean;
  warningMessage?: string;
  citations?: Array<{
    passageId: string;
    excerpt: string;
  }>;
}

export type ResolvedInvestigationStatus = "pending" | "grounded" | "insufficient_evidence" | "error";

/**
 * Derives the verified investigation outcome status based on retrieval results,
 * sufficiency flags, and validated supporting citations.
 */
export function resolveInvestigationStatus(
  status: "pending" | "success" | "error",
  result?: { isInsufficientEvidence?: boolean; citations?: Array<{ id: string; excerpt?: string }> } | null,
  errorMessage?: string
): ResolvedInvestigationStatus {
  if (status === "pending") return "pending";
  if (status === "error" || Boolean(errorMessage && !result)) return "error";
  if (status === "success" && result) {
    if (result.isInsufficientEvidence || !result.citations || result.citations.length === 0) {
      return "insufficient_evidence";
    }
    return "grounded";
  }
  return "error";
}


/**
 * Normalizes text for robust excerpt matching by removing excess whitespace and punctuation
 */
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates and verifies model-generated citations against real retrieved passages.
 * Strictly filters out fabricated passage IDs or excerpts that do not exist in the source texts.
 */
export function validateAndEnforceCitations(
  rawCitations: Array<{ passageId: string; excerpt: string }> | undefined,
  retrievedPassages: DocumentPassage[]
): EvidenceCitation[] {
  if (!rawCitations || !Array.isArray(rawCitations)) {
    return [];
  }

  const passageMap = new Map<string, DocumentPassage>();
  retrievedPassages.forEach((p) => {
    passageMap.set(p.id, p);
    // Also index by normalized short id if needed
    const shortId = p.id.split("_").slice(-2).join("_");
    passageMap.set(shortId, p);
  });

  const verifiedCitations: EvidenceCitation[] = [];

  rawCitations.forEach((raw, index) => {
    if (!raw.passageId || !raw.excerpt || typeof raw.excerpt !== "string") return;

    const matchedPassage = passageMap.get(raw.passageId);
    if (!matchedPassage) {
      // Citation references a non-existent passage ID -> Reject hallucination
      return;
    }

    const passageNorm = normalizeForMatch(matchedPassage.text);
    const excerptNorm = normalizeForMatch(raw.excerpt);

    if (!excerptNorm || excerptNorm.length < 5) {
      return;
    }

    // Check if contiguous normalized excerpt exists in normalized passage
    const isContiguousMatch = passageNorm.includes(excerptNorm);

    // If excerpt contains ellipses or multiple sentences, verify each substantial segment
    const segments = raw.excerpt
      .split(/\.\.\.|\n/)
      .map((s) => normalizeForMatch(s))
      .filter((s) => s.length >= 12);

    const isSegmentMatch =
      segments.length > 0 && segments.every((seg) => passageNorm.includes(seg));

    if (!isContiguousMatch && !isSegmentMatch) {
      // Excerpt is not in the source passage -> Reject mismatched / fabricated quote
      return;
    }

    verifiedCitations.push({
      id: `cit_${index + 1}_${Date.now().toString(36)}`,
      passageId: matchedPassage.id,
      documentId: matchedPassage.documentId,
      documentName: matchedPassage.documentName,
      pageNumber: matchedPassage.pageNumber, // Only present for PDFs
      excerpt: raw.excerpt.trim(),
      relevanceScore: matchedPassage.relevanceScore || 1,
    });
  });

  return verifiedCitations;
}

/**
 * Executes an evidence-grounded investigation query against retrieved document passages via Groq API.
 */
export async function executeGroqInvestigation(
  query: string,
  passages: DocumentPassage[],
  apiKey?: string,
  modelName?: string
): Promise<InvestigationResult> {
  const activeKey = apiKey || process.env.GROQ_API_KEY;
  const activeModel = modelName || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  // 1. Validate API Key Presence
  if (!activeKey || activeKey.trim() === "") {
    throw new Error(
      "GROQ_API_KEY is not configured on the server. Please add GROQ_API_KEY to your .env.local file to enable AI-powered investigation."
    );
  }

  // 2. Handle Case with No Retrieved Evidence
  if (!passages || passages.length === 0) {
    return {
      query,
      timestamp: new Date().toISOString(),
      answer:
        "No matching information or relevant evidence was found in the uploaded documents for this question.",
      isInsufficientEvidence: true,
      warningMessage:
        "The uploaded files do not contain references or data matching the inquiry.",
      citations: [],
      conflicts: [],
      retrievedPassages: [],
    };
  }

  // 3. Construct Evidence Context Block
  const formattedPassages = passages
    .map((p, idx) => {
      const pageInfo = p.pageNumber !== undefined ? `Page: ${p.pageNumber}` : "Format: Text/Section";
      return `--- PASSAGE ${idx + 1} [ID: "${p.id}"] (Source: "${p.documentName}", ${pageInfo}) ---\n"${p.text}"\n`;
    })
    .join("\n");

  const systemPrompt = `You are DocuLens AI, an objective, rigorous evidence verification and document investigation system.
Your mission is to answer user questions using EXCLUSIVELY the provided source passages.

STRICT PROTOCOLS:
1. ONLY make assertions directly supported by the text in the provided passages.
2. If the passages DO NOT contain sufficient evidence to answer conclusively, you MUST set "isInsufficientEvidence": true and clearly explain what information is missing. Do NOT guess or hallucinate.
3. Every factual claim MUST cite the exact passage ID (e.g. "${passages[0]?.id || "id"}") and include the exact supporting quote in "excerpt".
4. You MUST respond with ONLY a valid JSON object matching this schema:
{
  "answer": "A concise, objective, evidence-grounded answer directly addressing the question.",
  "isInsufficientEvidence": false,
  "warningMessage": "Optional advisory if evidence is only partial or ambiguous",
  "citations": [
    {
      "passageId": "exact_passage_id",
      "excerpt": "exact quote from the passage"
    }
  ]
}`;

  const userPrompt = `Retrieved Source Passages:\n${formattedPassages}\n\nUser Question: "${query}"\n\nProvide an evidence-grounded response in the required JSON format.`;

  // 4. Send Request to Groq API with 25s Timeout
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
        throw new Error("Groq API authentication failed. Please check that your GROQ_API_KEY is valid.");
      }
      if (response.status === 429) {
        throw new Error("Groq API rate limit exceeded. Please wait a moment and try again.");
      }
      if (response.status === 404) {
        throw new Error(
          `The configured Groq model "${activeModel}" is currently unavailable. You can set GROQ_MODEL in .env.local to a supported alternative.`
        );
      }
      throw new Error(`Groq API returned HTTP error ${response.status}.`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq API returned an empty response.");
    }

    let parsed: GroqAnswerRawResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse structured JSON response from Groq.");
    }

    // 5. Enforce Strict Server-Side Citation Validation
    const verifiedCitations = validateAndEnforceCitations(parsed.citations, passages);

    const rawCitationsProvided = Array.isArray(parsed.citations) && parsed.citations.length > 0;
    const allCitationsRejected = rawCitationsProvided && verifiedCitations.length === 0;

    let isInsufficient = Boolean(parsed.isInsufficientEvidence);
    let warningMessage = parsed.warningMessage;

    // Safeguard 1: If model provided citations but all were rejected as fabricated or invalid
    if (!isInsufficient && allCitationsRejected) {
      isInsufficient = true;
      warningMessage =
        warningMessage ||
        "The response referenced sources or citations that could not be verified against the extracted document passages.";
    }
    // Safeguard 2: If model indicates missing or inconclusive info in text
    else if (!isInsufficient && verifiedCitations.length === 0 && passages.length > 0) {
      const answerLower = (parsed.answer || "").toLowerCase();
      if (
        answerLower.includes("not found") ||
        answerLower.includes("no information") ||
        answerLower.includes("insufficient evidence") ||
        answerLower.includes("cannot be determined")
      ) {
        isInsufficient = true;
        warningMessage =
          warningMessage ||
          "The uploaded documents do not contain sufficient verified evidence to answer this question.";
      }
    }

    return {
      query,
      timestamp: new Date().toISOString(),
      answer: parsed.answer || "No response generated.",
      isInsufficientEvidence: isInsufficient,
      warningMessage,
      citations: verifiedCitations,
      conflicts: [],
      retrievedPassages: passages,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out while waiting for Groq API response (25s limit).");
      }
      throw err;
    }
    throw new Error("An unexpected error occurred while communicating with Groq.");
  }
}
