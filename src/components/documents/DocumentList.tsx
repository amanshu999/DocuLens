"use client";

import React, { useState } from "react";
import {
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  FileCode,
} from "lucide-react";
import { UploadedDocument } from "@/types";

interface DocumentListProps {
  documents: UploadedDocument[];
  onRemoveDocument: (id: string) => void;
  onClearAll: () => void;
}

export default function DocumentList({
  documents,
  onRemoveDocument,
  onClearAll,
}: DocumentListProps) {
  const [inspectingDoc, setInspectingDoc] = useState<UploadedDocument | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-800 tracking-tight">
            Loaded Files
          </span>
          <span className="text-xs text-slate-400 font-mono">
            ({documents.length})
          </span>
        </div>

        {documents.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[11px] text-slate-400 hover:text-red-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* List content */}
      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-340px)]">
        {documents.length === 0 ? (
          <div className="py-8 px-3 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
            <p className="text-xs font-medium text-slate-700">No documents yet</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Add PDF, TXT, MD, or DOCX files above. Text will be extracted immediately.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className={`p-2.5 rounded-md border transition-colors flex flex-col gap-1.5 group ${
                doc.status === "error"
                  ? "bg-red-50/40 border-red-200"
                  : doc.status === "pending"
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <p
                    className="text-xs font-medium text-slate-800 truncate"
                    title={doc.name}
                  >
                    {doc.name}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Status Badge */}
                  {doc.status === "pending" && (
                    <span className="text-[10px] text-indigo-600 flex items-center gap-1 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Extracting
                    </span>
                  )}

                  {doc.status === "ready" && (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Ready
                    </span>
                  )}

                  {doc.status === "error" && (
                    <span className="text-[10px] text-red-600 flex items-center gap-0.5 font-medium">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  )}

                  {/* Text Inspection Button */}
                  {doc.status === "ready" && doc.fullText && (
                    <button
                      onClick={() => setInspectingDoc(doc)}
                      title="Inspect extracted text"
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemoveDocument(doc.id)}
                    title="Remove file"
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Metadata or Error Description */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>{formatFileSize(doc.size)}</span>

                {doc.status === "ready" && (
                  <span className="text-slate-500 font-sans">
                    {doc.pageCount !== undefined
                      ? `${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`
                      : `${doc.wordCount?.toLocaleString() || 0} words`}
                  </span>
                )}
              </div>

              {/* Error message detail */}
              {doc.status === "error" && doc.errorMessage && (
                <p className="text-[11px] text-red-600 bg-red-100/60 p-1.5 rounded border border-red-200/60 leading-tight">
                  {doc.errorMessage}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Extracted Text Inspector Modal */}
      {inspectingDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    {inspectingDoc.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inspectingDoc.pageCount !== undefined
                    ? `Preserved ${inspectingDoc.pageCount} pages • ${inspectingDoc.characterCount?.toLocaleString()} characters`
                    : `${inspectingDoc.wordCount?.toLocaleString()} words • ${inspectingDoc.characterCount?.toLocaleString()} characters`}
                </p>
              </div>

              <button
                onClick={() => setInspectingDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Preserved Pages or Text Content */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono text-slate-800 leading-relaxed max-h-[60vh]">
              {inspectingDoc.pages && inspectingDoc.pages.length > 0 ? (
                /* PDF: Page-by-page display */
                inspectingDoc.pages.map((p) => (
                  <div
                    key={p.pageNumber}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-md"
                  >
                    <div className="text-[11px] font-semibold text-indigo-700 pb-1.5 mb-2 border-b border-slate-200 flex justify-between">
                      <span>Page {p.pageNumber}</span>
                      <span className="text-slate-400 font-normal">
                        {p.text.length} chars
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800">
                      {p.text || "(Blank page)"}
                    </pre>
                  </div>
                ))
              ) : (
                /* TXT / MD / DOCX: Plain text display */
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 bg-slate-50 p-3 rounded-md border border-slate-200">
                  {inspectingDoc.fullText}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Actual extracted text verified server-side</span>
              <button
                onClick={() => setInspectingDoc(null)}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
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
