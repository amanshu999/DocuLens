"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  FileCheck,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { InvestigationMessage, EvidenceCitation } from "@/types";
import { resolveInvestigationStatus } from "@/lib/groq";

interface QuestionWorkspaceProps {
  hasDocuments: boolean;
  readyDocumentCount: number;
  pendingDocumentCount?: number;
  messages: InvestigationMessage[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  onRetryMessage: (id: string, query: string) => void;
  onInvestigate: (question: string) => Promise<void>;
  onClearConversation: () => void;
  onSelectCitation?: (citation: EvidenceCitation) => void;
}

export default function QuestionWorkspace({
  hasDocuments,
  readyDocumentCount,
  pendingDocumentCount = 0,
  messages,
  selectedMessageId,
  onSelectMessage,
  onRetryMessage,
  onInvestigate,
  onClearConversation,
  onSelectCitation,
}: QuestionWorkspaceProps) {
  const [inputQuery, setInputQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isInvestigating = messages.some((m) => m.status === "pending");

  const sampleQueries = [
    "Are there conflicting revenue or financial figures across files?",
    "What are the stated termination terms and penalty clauses?",
    "Identify discrepancies in project timeline or milestone dates.",
    "Summarize all compliance obligations mentioned across files.",
  ];

  // Auto-scroll when new messages arrive or status changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputQuery.trim();
    if (!trimmed || !hasDocuments || isInvestigating) return;

    // Clear input immediately so user can compose next inquiry
    setInputQuery("");
    await onInvestigate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSampleClick = async (prompt: string) => {
    if (!hasDocuments || isInvestigating) return;
    setInputQuery("");
    await onInvestigate(prompt);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-col h-full overflow-hidden">
      {/* Workspace Top Header */}
      <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Investigation Workspace
            </h2>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Qwen 27B Grounded
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Evidence-grounded multi-turn document cross-examination.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={onClearConversation}
              disabled={isInvestigating}
              className="text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-200/60 transition-colors flex items-center gap-1 disabled:opacity-40"
              title="Clear conversation history"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 ? (
          /* Empty / Welcome State */
          <div className="h-full flex flex-col justify-center max-w-xl mx-auto py-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3 text-indigo-600 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-semibold text-slate-900">
              Document Inquiry Session
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
              {hasDocuments
                ? `Ready to cross-examine ${readyDocumentCount} uploaded ${readyDocumentCount === 1 ? "document" : "documents"}. Ask any question or click a sample query below.`
                : pendingDocumentCount > 0
                ? `Extracting text from ${pendingDocumentCount} ${pendingDocumentCount === 1 ? "file" : "files"}... Workspace ready momentarily.`
                : "Upload documents in the Source Documents panel to begin verified cross-examination."}
            </p>

            {/* Suggested Starter Queries */}
            <div className="text-left space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-1">
                Suggested Research Queries
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sampleQueries.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleClick(query)}
                    disabled={!hasDocuments || isInvestigating}
                    className="p-3 text-left rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-100/90 hover:border-slate-300 transition-all text-xs text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed group flex flex-col justify-between gap-1 shadow-2xs"
                  >
                    <span className="font-medium text-slate-800 group-hover:text-indigo-900">
                      {query}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-medium self-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Investigate</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation Thread */
          <div className="space-y-5">
            {messages.map((msg, index) => {
              const isSelected = selectedMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  onClick={() => onSelectMessage(msg.id)}
                  className={`rounded-xl border transition-all cursor-pointer overflow-hidden ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-500/15 shadow-sm bg-white"
                      : "border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/30"
                  }`}
                >
                  {/* User Question Header */}
                  <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-md bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        Q{index + 1}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 leading-snug">
                          {msg.query}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{msg.timestamp}</span>
                          {isSelected && (
                            <span className="text-indigo-600 font-medium flex items-center gap-1">
                              &bull; Active in Evidence Panel
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {(() => {
                        const resolved = resolveInvestigationStatus(
                          msg.status,
                          msg.result,
                          msg.errorMessage
                        );

                        if (resolved === "pending") {
                          return (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Analyzing
                            </span>
                          );
                        }

                        if (resolved === "error") {
                          return (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium border border-red-200 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Failed
                            </span>
                          );
                        }

                        if (resolved === "insufficient_evidence") {
                          return (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Insufficient Evidence
                            </span>
                          );
                        }

                        return (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Grounded
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* AI Response Body */}
                  <div className="p-4 text-xs space-y-3">
                    {msg.status === "pending" && (
                      <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                        <div className="flex items-center gap-2 text-indigo-600">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="font-semibold text-xs text-slate-800">
                            Investigating source evidence...
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          Retrieving relevant passages, cross-examining documents, and validating citations with Groq Qwen 27B.
                        </p>
                      </div>
                    )}

                    {msg.status === "error" && (
                      <div className="p-3.5 rounded-lg bg-red-50/80 border border-red-200 text-red-800 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-xs">
                              Investigation encountered an error:
                            </span>
                            <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
                              {msg.errorMessage || "Unknown network or API error."}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryMessage(msg.id, msg.query);
                            }}
                            className="px-2.5 py-1 rounded bg-white hover:bg-red-100 border border-red-300 text-red-700 font-medium text-[11px] transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry Question</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {msg.status === "success" && msg.result && (
                      <div className="space-y-3">
                        {/* Insufficient Evidence Warning Banner */}
                        {msg.result.isInsufficientEvidence && (
                          <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Insufficient Evidence Advisory: </span>
                              <span className="text-amber-800">
                                {msg.result.warningMessage ||
                                  "The uploaded files do not provide conclusive proof for this query."}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Grounded Text Answer */}
                        <div className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                          {msg.result.answer}
                        </div>

                        {/* Citations Footer Chips */}
                        {msg.result.citations && msg.result.citations.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                              Sources:
                            </span>
                            {msg.result.citations.map((cit, cIdx) => (
                              <button
                                key={cit.id || cIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectMessage(msg.id);
                                  if (onSelectCitation) onSelectCitation(cit);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 hover:border-indigo-200 transition-colors"
                                title={`Click to view passage excerpt: "${cit.excerpt}"`}
                              >
                                <FileCheck className="w-3 h-3 text-indigo-600" />
                                <span className="truncate max-w-[120px]">{cit.documentName}</span>
                                {cit.pageNumber !== undefined && (
                                  <span className="font-mono text-slate-400 text-[9px]">
                                    p.{cit.pageNumber}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Interactive Query Input */}
      <div className="p-3 sm:p-4 bg-slate-50/70 border-t border-slate-200/90 shrink-0">
        <form onSubmit={handleSubmit}>
          <div className="border border-slate-300 rounded-xl focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/15 bg-white shadow-2xs transition-all">
            <textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!hasDocuments || isInvestigating}
              placeholder={
                hasDocuments
                  ? "Ask a question about uploaded documents (e.g. 'Compare revenue statements across files')... (Enter to submit, Shift+Enter for new line)"
                  : pendingDocumentCount > 0
                  ? "Extracting document text... Ready shortly."
                  : "Add source documents in the left vault to begin investigation..."
              }
              rows={2}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none disabled:cursor-not-allowed leading-relaxed"
            />

            <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between text-[11px] bg-white rounded-b-xl">
              <div className="flex items-center gap-2 text-slate-400">
                <span>
                  {hasDocuments
                    ? `${readyDocumentCount} ${readyDocumentCount === 1 ? "document" : "documents"} ready`
                    : pendingDocumentCount > 0
                    ? `Processing ${pendingDocumentCount} ${pendingDocumentCount === 1 ? "file" : "files"}...`
                    : "No documents loaded"}
                </span>
                <span className="hidden sm:inline text-slate-300">&bull;</span>
                <span className="hidden sm:inline text-[10px] text-slate-400">
                  Enter ↵ to send
                </span>
              </div>

              <button
                type="submit"
                disabled={!hasDocuments || !inputQuery.trim() || isInvestigating}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                {isInvestigating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Investigating...</span>
                  </>
                ) : (
                  <>
                    <span>Investigate</span>
                    <Send className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
