"use client";

import React, { useState } from "react";
import {
  BookOpen,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  FileText,
  Sparkles,
  Loader2,
  RefreshCw,
  GitCompare,
  AlertOctagon,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { InvestigationResult, EvidenceCitation, ConflictAnalysisResult } from "@/types";

export type EvidenceSubTab = "answer" | "citations" | "conflicts" | "passages" | "warnings";

interface EvidencePanelProps {
  readyDocumentCount: number;
  result: InvestigationResult | null;
  conflictResult: ConflictAnalysisResult | null;
  conflictError?: string | null;
  onClearConflictError?: () => void;
  isInvestigating?: boolean;
  isAnalyzingConflicts?: boolean;
  onRunConflictScan: () => Promise<void>;
  activeSubTab: EvidenceSubTab;
  onSelectSubTab: (tab: EvidenceSubTab) => void;
  activeQuery?: string;
  selectedCitation?: EvidenceCitation | null;
  onClearSelectedCitation?: () => void;
}

export default function EvidencePanel({
  readyDocumentCount,
  result,
  conflictResult,
  conflictError,
  onClearConflictError,
  isInvestigating = false,
  isAnalyzingConflicts = false,
  onRunConflictScan,
  activeSubTab,
  onSelectSubTab,
  activeQuery,
  selectedCitation: externalSelectedCitation,
  onClearSelectedCitation,
}: EvidencePanelProps) {
  const [internalSelectedCitation, setInternalSelectedCitation] = useState<EvidenceCitation | null>(null);

  const activeCitation = externalSelectedCitation || internalSelectedCitation;
  const conflictsList = conflictResult?.conflicts || result?.conflicts || [];

  const handleCloseCitationModal = () => {
    setInternalSelectedCitation(null);
    if (onClearSelectedCitation) {
      onClearSelectedCitation();
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="pb-3 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Evidence &amp; Verification
            </h3>
          </div>
        </div>

        {activeQuery && (
          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600 flex items-center gap-1.5 truncate">
            <span className="font-semibold text-slate-700 shrink-0">Inquiry:</span>
            <span className="truncate italic text-slate-600">&ldquo;{activeQuery}&rdquo;</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs mt-3 overflow-x-auto shrink-0 scrollbar-none">
        <button
          onClick={() => onSelectSubTab("answer")}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 -mb-px shrink-0 flex items-center gap-1.5 ${
            activeSubTab === "answer"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Answer</span>
          {result && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
        </button>

        <button
          onClick={() => onSelectSubTab("citations")}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 -mb-px shrink-0 flex items-center gap-1.5 ${
            activeSubTab === "citations"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Citations</span>
          {result?.citations && result.citations.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-medium border border-indigo-100">
              {result.citations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectSubTab("conflicts")}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 -mb-px shrink-0 flex items-center gap-1.5 ${
            activeSubTab === "conflicts"
              ? "border-amber-600 text-amber-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Conflicts</span>
          {conflictsList.length > 0 ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-mono font-semibold border border-amber-200">
              {conflictsList.length}
            </span>
          ) : readyDocumentCount >= 2 ? (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          ) : null}
        </button>

        <button
          onClick={() => onSelectSubTab("passages")}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 -mb-px shrink-0 flex items-center gap-1.5 ${
            activeSubTab === "passages"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Passages</span>
          {result?.retrievedPassages && result.retrievedPassages.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono border border-slate-200">
              {result.retrievedPassages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectSubTab("warnings")}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 -mb-px shrink-0 flex items-center gap-1 ${
            activeSubTab === "warnings"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Warnings</span>
          {result?.isInsufficientEvidence && <AlertTriangle className="w-3 h-3 text-amber-600" />}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-0.5">
        {/* ================= TAB 1: ANSWER ================= */}
        {activeSubTab === "answer" && (
          result ? (
            <div className="space-y-3 text-xs">
              {/* Insufficient Evidence Advisory Banner */}
              {result.isInsufficientEvidence && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Insufficient Evidence Notice</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {result.warningMessage ||
                      "The uploaded documents do not contain enough verified evidence to answer this question with certainty."}
                  </p>
                </div>
              )}

              {/* Grounded Answer Card */}
              <div className="p-3.5 rounded-lg border border-slate-200/90 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 border-b border-slate-200/80 pb-2">
                  <span className="flex items-center gap-1.5 text-indigo-900">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Grounded Findings
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Verified against source passages
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {result.answer}
                </p>
              </div>

              {/* Citations Preview */}
              {result.citations && result.citations.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>Supporting Citations ({result.citations.length})</span>
                    <button
                      onClick={() => onSelectSubTab("citations")}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-normal flex items-center gap-0.5"
                    >
                      <span>View all</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {result.citations.map((cit) => (
                      <div
                        key={cit.id}
                        onClick={() => setInternalSelectedCitation(cit)}
                        className="p-3 rounded-lg border border-slate-200/90 bg-white border-l-3 border-l-indigo-600 hover:border-indigo-300 cursor-pointer transition-all space-y-1.5 shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                            <FileCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            {cit.documentName}
                          </span>
                          <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            {cit.pageNumber !== undefined ? `Page ${cit.pageNumber}` : "Text Passage"}
                          </span>
                        </div>
                        <p className="text-slate-700 italic bg-slate-50 p-2 rounded text-[11px] border border-slate-100 leading-relaxed line-clamp-3">
                          &ldquo;{cit.excerpt}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isInvestigating ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border border-slate-200 rounded-xl bg-indigo-50/20">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-900">
                Retrieving Evidence &amp; Formulating Answer...
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                Matching document passages and validating page citations with Groq API.
              </p>
            </div>
          ) : (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
              <BookOpen className="w-6 h-6 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-800">
                Awaiting Investigation Inquiry
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                When you ask a question in the center workspace, grounded answers, exact page citations, and evidence passages will be surfaced here.
              </p>
            </div>
          )
        )}

        {/* ================= TAB 2: CITATIONS ================= */}
        {activeSubTab === "citations" && (
          result?.citations && result.citations.length > 0 ? (
            <div className="space-y-2.5 text-xs">
              <div className="text-[11px] text-slate-500 pb-1">
                Verified quotes extracted directly from source documents:
              </div>
              {result.citations.map((cit, idx) => (
                <div
                  key={cit.id}
                  onClick={() => setInternalSelectedCitation(cit)}
                  className="p-3 rounded-lg border border-slate-200/90 bg-white border-l-3 border-l-indigo-600 hover:border-indigo-300 cursor-pointer transition-all space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Citation {idx + 1}: {cit.documentName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                      {cit.pageNumber !== undefined ? `Page ${cit.pageNumber}` : "Text format"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-100 text-[11px] text-slate-800 italic leading-relaxed">
                    &ldquo;{cit.excerpt}&rdquo;
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Passage ID: {cit.passageId || "verified"}</span>
                    <span className="text-indigo-600 font-medium flex items-center gap-0.5">
                      Click to expand <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
              No citations available for this inquiry. Submit a question in the center workspace to surface verified source citations.
            </div>
          )
        )}

        {/* ================= TAB 3: CROSS-DOCUMENT CONFLICTS ================= */}
        {activeSubTab === "conflicts" && (
          <div className="space-y-3 text-xs">
            {/* Conflict Control Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-[11px] text-slate-500">
                {readyDocumentCount >= 2
                  ? `${readyDocumentCount} documents ready for cross-examination`
                  : "Requires at least 2 uploaded documents"}
              </span>

              {readyDocumentCount >= 2 && (
                <button
                  onClick={onRunConflictScan}
                  disabled={isAnalyzingConflicts}
                  className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isAnalyzingConflicts ? "animate-spin text-amber-600" : ""}`} />
                  <span>{isAnalyzingConflicts ? "Scanning..." : "Scan Conflicts"}</span>
                </button>
              )}
            </div>

            {conflictError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{conflictError}</p>
                </div>
                {onClearConflictError && (
                  <button
                    onClick={onClearConflictError}
                    className="text-red-500 hover:text-red-700 font-bold px-1"
                  >
                    &times;
                  </button>
                )}
              </div>
            )}

            {isAnalyzingConflicts ? (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border border-slate-200 rounded-xl bg-amber-50/20">
                <Loader2 className="w-6 h-6 text-amber-600 animate-spin mb-2" />
                <p className="text-xs font-semibold text-amber-900">
                  Analyzing Cross-Document Contradictions...
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  Aligning candidate passages by topic, entities, and figures, and classifying discrepancies with Groq.
                </p>
              </div>
            ) : readyDocumentCount < 2 ? (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <GitCompare className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  Multiple Documents Required
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                  Upload at least 2 documents in the Source Documents panel to cross-reference conflicting claims, dates, and amounts.
                </p>
              </div>
            ) : conflictsList.length > 0 ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900">
                  <strong>Findings Summary:</strong> {conflictResult?.summary || `Identified ${conflictsList.length} potential cross-document discrepancies.`}
                </div>

                {conflictsList.map((conflict, idx) => (
                  <div
                    key={conflict.id || idx}
                    className="p-3.5 rounded-xl border border-amber-200/90 bg-white space-y-2.5 shadow-2xs"
                  >
                    {/* Discrepancy Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
                          <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
                          {conflict.topic}
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {conflict.description}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 font-medium ${
                          conflict.status === "direct_contradiction"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {conflict.status === "direct_contradiction"
                          ? "Direct Contradiction"
                          : "Requires Review"}
                      </span>
                    </div>

                    {/* Side-by-Side Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      {/* Claim A */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800 pb-1 border-b border-slate-200">
                          <span className="truncate" title={conflict.claimA.documentName}>
                            {conflict.claimA.documentName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {conflict.claimA.pageNumber !== undefined ? `Page ${conflict.claimA.pageNumber}` : "Text"}
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium text-[11px]">
                          {conflict.claimA.statement}
                        </p>
                        <p className="text-slate-600 italic bg-white p-1.5 rounded border border-slate-100 text-[10px] leading-relaxed">
                          &ldquo;{conflict.claimA.excerpt}&rdquo;
                        </p>
                      </div>

                      {/* Claim B */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800 pb-1 border-b border-slate-200">
                          <span className="truncate" title={conflict.claimB.documentName}>
                            {conflict.claimB.documentName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {conflict.claimB.pageNumber !== undefined ? `Page ${conflict.claimB.pageNumber}` : "Text"}
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium text-[11px]">
                          {conflict.claimB.statement}
                        </p>
                        <p className="text-slate-600 italic bg-white p-1.5 rounded border border-slate-100 text-[10px] leading-relaxed">
                          &ldquo;{conflict.claimB.excerpt}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conflictResult ? (
              <div className="p-6 text-center border border-dashed border-emerald-200 bg-emerald-50/30 rounded-xl text-xs space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="font-semibold text-emerald-900">Consistency Verified</p>
                <p className="text-slate-600 text-[11px] max-w-xs mx-auto leading-relaxed">
                  {conflictResult.summary || "No material contradictions found across the analyzed documents."}
                </p>
              </div>
            ) : (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <GitCompare className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  Ready for Conflict Cross-Examination
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                  Click &ldquo;Scan Conflicts&rdquo; above to automatically cross-reference revenue figures, termination terms, and deadlines across your loaded documents.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: PASSAGES ================= */}
        {activeSubTab === "passages" && (
          <div className="space-y-2.5 text-xs">
            <p className="text-[11px] text-slate-500">
              Raw passages retrieved from your documents via transparent keyword scoring:
            </p>
            {result?.retrievedPassages && result.retrievedPassages.length > 0 ? (
              result.retrievedPassages.map((p, idx) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg border border-slate-200/90 bg-slate-50/80 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800 border-b border-slate-200/60 pb-1">
                    <span className="flex items-center gap-1 truncate">
                      <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                      Passage {idx + 1}: {p.documentName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {p.pageNumber !== undefined ? `Page ${p.pageNumber}` : "Section"} &middot; Score: {p.relevanceScore || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">
                    {p.text}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                No passages retrieved yet. Ask a question to inspect retrieved context.
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: WARNINGS ================= */}
        {activeSubTab === "warnings" && (
          <div className="space-y-2.5 text-xs">
            {result?.isInsufficientEvidence ? (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Insufficient Evidence Advisory</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {result.warningMessage ||
                    "The model determined that the uploaded documents do not provide adequate evidence to conclusively substantiate an answer."}
                </p>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-semibold text-slate-800">No Uncertainty Warnings</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Evidence was adequately located in the source documents.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Citation Detail Modal */}
      {activeCitation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <FileCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-900">
                  {activeCitation.documentName}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {activeCitation.pageNumber !== undefined ? `Page ${activeCitation.pageNumber}` : "Text Document"}
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Verbatim Verified Excerpt:
              </span>
              <p className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 italic leading-relaxed whitespace-pre-wrap">
                &ldquo;{activeCitation.excerpt}&rdquo;
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleCloseCitationModal}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
