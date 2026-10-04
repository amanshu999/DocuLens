export interface DocumentPage {
  pageNumber: number;
  text: string;
}

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date | string;
  status: 'pending' | 'ready' | 'error';
  errorMessage?: string;
  // Extracted content
  fullText?: string;
  pages?: DocumentPage[]; // Only present for PDFs
  pageCount?: number;     // Only present for PDFs
  characterCount?: number;
  wordCount?: number;
}

export interface ExtractionResult {
  fullText: string;
  pages?: DocumentPage[];
  pageCount?: number;
  characterCount: number;
  wordCount: number;
}

export interface DocumentPassage {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber?: number; // Only present for PDFs
  text: string;
  relevanceScore?: number;
}

export interface EvidenceCitation {
  id: string;
  passageId?: string;
  documentId: string;
  documentName: string;
  pageNumber?: number; // Only present for PDFs
  excerpt: string;
  relevanceScore?: number;
}

export interface ConflictClaim {
  documentId: string;
  documentName: string;
  passageId?: string;
  statement: string;
  excerpt: string;
  pageNumber?: number; // Only present for PDFs
}

export interface ConflictAlert {
  id: string;
  topic: string;
  description: string;
  status: "direct_contradiction" | "possible_conflict_requires_review";
  claimA: ConflictClaim;
  claimB: ConflictClaim;
  // Backward compatibility fields
  documentA?: {
    name: string;
    statement: string;
    page?: number;
    excerpt?: string;
  };
  documentB?: {
    name: string;
    statement: string;
    page?: number;
    excerpt?: string;
  };
}

export interface ConflictAnalysisResult {
  timestamp: string;
  totalDocumentsAnalyzed: number;
  conflicts: ConflictAlert[];
  summary: string;
}

export interface InvestigationResult {
  query: string;
  timestamp: string;
  answer: string;
  citations: EvidenceCitation[];
  conflicts: ConflictAlert[];
  isInsufficientEvidence: boolean;
  warningMessage?: string;
  retrievedPassages?: DocumentPassage[];
}

export interface InvestigationMessage {
  id: string;
  query: string;
  timestamp: string;
  status: "pending" | "success" | "error";
  result?: InvestigationResult;
  errorMessage?: string;
}

