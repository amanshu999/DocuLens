"use client";

import React, { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import DocumentUpload from "@/components/documents/DocumentUpload";
import DocumentList from "@/components/documents/DocumentList";
import QuestionWorkspace from "@/components/investigation/QuestionWorkspace";
import EvidencePanel, { EvidenceSubTab } from "@/components/investigation/EvidencePanel";
import {
  UploadedDocument,
  InvestigationMessage,
  ConflictAnalysisResult,
  EvidenceCitation,
} from "@/types";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [activeNavTab, setActiveNavTab] = useState<string>("workspace");
  const [evidenceSubTab, setEvidenceSubTab] = useState<EvidenceSubTab>("answer");
  const [isResetting, setIsResetting] = useState(false);

  // Multi-turn Conversation & Investigation State
  const [messages, setMessages] = useState<InvestigationMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<EvidenceCitation | null>(null);

  // Cross-document conflict state
  const [conflictResult, setConflictResult] = useState<ConflictAnalysisResult | null>(null);
  const [isAnalyzingConflicts, setIsAnalyzingConflicts] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Document management handlers
  const handleAddDocument = (newDoc: UploadedDocument) => {
    setDocuments((prev) => [...prev, newDoc]);
  };

  const handleUpdateDocument = (id: string, updates: Partial<UploadedDocument>) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc))
    );
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleClearAllDocuments = () => {
    setDocuments([]);
    setMessages([]);
    setSelectedMessageId(null);
    setConflictResult(null);
    setConflictError(null);
  };

  const handleResetWorkspace = () => {
    setIsResetting(true);
    setTimeout(() => {
      setDocuments([]);
      setMessages([]);
      setSelectedMessageId(null);
      setConflictResult(null);
      setConflictError(null);
      setEvidenceSubTab("answer");
      setIsResetting(false);
    }, 200);
  };

  const handleNavTabSelect = (tab: string) => {
    setActiveNavTab(tab);
    if (tab === "conflicts") {
      setEvidenceSubTab("conflicts");
    } else if (tab === "evidence") {
      setEvidenceSubTab("citations");
    }
  };

  // Multi-turn Investigation Submission Handler
  const handleInvestigate = async (query: string) => {
    const readyDocs = documents.filter((d) => d.status === "ready");
    if (readyDocs.length === 0) return;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newPendingMessage: InvestigationMessage = {
      id: messageId,
      query,
      timestamp: timeString,
      status: "pending",
    };

    // Add to conversation immediately and select it
    setMessages((prev) => [...prev, newPendingMessage]);
    setSelectedMessageId(messageId);

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          documents: readyDocs,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText = data.error || "Failed to complete investigation.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, status: "error", errorMessage: errorText } : m
          )
        );
        return;
      }

      // Success: update message with evidence result
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: "success", result: data.result } : m
        )
      );
      setEvidenceSubTab("answer");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Network error during investigation.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: "error", errorMessage: message } : m
        )
      );
    }
  };

  // Retry an existing failed question
  const handleRetryMessage = async (messageId: string, query: string) => {
    const readyDocs = documents.filter((d) => d.status === "ready");
    if (readyDocs.length === 0) return;

    // Reset status to pending
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: "pending", errorMessage: undefined } : m
      )
    );
    setSelectedMessageId(messageId);

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          documents: readyDocs,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText = data.error || "Failed to complete investigation.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, status: "error", errorMessage: errorText } : m
          )
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: "success", result: data.result } : m
        )
      );
      setEvidenceSubTab("answer");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Network error during investigation.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: "error", errorMessage: message } : m
        )
      );
    }
  };

  // Cross-document conflict analysis handler connecting to /api/conflicts
  const handleRunConflictScan = async () => {
    const readyDocs = documents.filter((d) => d.status === "ready");
    if (readyDocs.length < 2) {
      setConflictError("At least 2 documents are required to perform cross-document conflict analysis.");
      return;
    }

    setIsAnalyzingConflicts(true);
    setConflictError(null);

    try {
      const response = await fetch("/api/conflicts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documents: readyDocs,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setConflictError(data.error || "Conflict analysis failed.");
        return;
      }

      setConflictResult(data.result);
      setEvidenceSubTab("conflicts");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Network error during conflict detection.";
      setConflictError(message);
    } finally {
      setIsAnalyzingConflicts(false);
    }
  };

  const existingFileNames = documents.map((doc) => doc.name);
  const readyCount = documents.filter((d) => d.status === "ready").length;
  const pendingCount = documents.filter((d) => d.status === "pending").length;

  // Active message & associated evidence
  const activeMessage = messages.find((m) => m.id === selectedMessageId);
  const activeInvestigationResult = activeMessage?.result || null;
  const isCurrentlyInvestigating = messages.some((m) => m.status === "pending");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fafaf9] text-slate-900 font-sans">
      {/* 1. Left Navigation Rail */}
      <Sidebar
        activeTab={activeNavTab}
        setActiveTab={handleNavTabSelect}
        documentCount={readyCount}
      />

      {/* 2. Main Research Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Clean Editorial Header */}
        <Header
          documentCount={documents.length}
          onResetWorkspace={handleResetWorkspace}
          isResetting={isResetting}
        />

        {/* 3-Column Editorial Workspace (Left: Documents | Center: Investigation Chat | Right: Evidence) */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
          <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch min-h-0">
            {/* Left Column: Upload control and source document vault */}
            <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-3.5 bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
              <div>
                <h2 className="text-xs font-semibold text-slate-900 tracking-tight mb-2 uppercase text-[10px] text-slate-500">
                  Source Documents
                </h2>
                <DocumentUpload
                  onAddDocument={handleAddDocument}
                  onUpdateDocument={handleUpdateDocument}
                  existingNames={existingFileNames}
                />
              </div>

              <div className="flex-1 min-h-[160px] overflow-hidden flex flex-col">
                <DocumentList
                  documents={documents}
                  onRemoveDocument={handleRemoveDocument}
                  onClearAll={handleClearAllDocuments}
                />
              </div>
            </div>

            {/* Center Column: Turn-by-Turn Investigation Conversation */}
            <div className="flex-1 min-w-0 flex flex-col min-h-[360px] lg:min-h-0">
              <QuestionWorkspace
                hasDocuments={readyCount > 0}
                readyDocumentCount={readyCount}
                pendingDocumentCount={pendingCount}
                messages={messages}
                selectedMessageId={selectedMessageId}
                onSelectMessage={(id) => setSelectedMessageId(id)}
                onRetryMessage={handleRetryMessage}
                onInvestigate={handleInvestigate}
                onClearConversation={() => {
                  setMessages([]);
                  setSelectedMessageId(null);
                }}
                onSelectCitation={(cit) => {
                  setSelectedCitation(cit);
                  setEvidenceSubTab("citations");
                }}
              />
            </div>

            {/* Right Column: Evidence & Verification Panel */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col min-h-[300px] lg:min-h-0">
              <EvidencePanel
                readyDocumentCount={readyCount}
                result={activeInvestigationResult}
                conflictResult={conflictResult}
                isInvestigating={isCurrentlyInvestigating && activeMessage?.status === "pending"}
                isAnalyzingConflicts={isAnalyzingConflicts}
                onRunConflictScan={handleRunConflictScan}
                activeSubTab={evidenceSubTab}
                onSelectSubTab={setEvidenceSubTab}
                conflictError={conflictError}
                onClearConflictError={() => setConflictError(null)}
                activeQuery={activeMessage?.query}
                selectedCitation={selectedCitation}
                onClearSelectedCitation={() => setSelectedCitation(null)}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
