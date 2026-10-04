"use client";

import React, { useState, useRef } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { UploadedDocument } from "@/types";

interface DocumentUploadProps {
  onAddDocument: (doc: UploadedDocument) => void;
  onUpdateDocument: (id: string, updates: Partial<UploadedDocument>) => void;
  existingNames: string[];
}

export default function DocumentUpload({
  onAddDocument,
  onUpdateDocument,
  existingNames,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = [".pdf", ".txt", ".md", ".docx"];
  const maxFileSizeBytes = 25 * 1024 * 1024; // 25MB

  const processAndUploadFile = async (file: File) => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase();

    // Validation 1: Allowed extension
    if (!allowedExtensions.includes(extension)) {
      setErrorMessage(
        `"${file.name}" is not supported. Supported formats are PDF, TXT, MD, and DOCX.`
      );
      return;
    }

    // Validation 2: File size limit
    if (file.size > maxFileSizeBytes) {
      setErrorMessage(
        `"${file.name}" exceeds the 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
      );
      return;
    }

    // Validation 3: Duplicate file
    if (existingNames.includes(file.name)) {
      setErrorMessage(`"${file.name}" has already been added to the workspace.`);
      return;
    }

    // Register file in workspace with "pending" status
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pendingDoc: UploadedDocument = {
      id: docId,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      uploadedAt: new Date(),
      status: "pending",
    };

    onAddDocument(pendingDoc);

    // Call server-side extraction API
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        onUpdateDocument(docId, {
          status: "error",
          errorMessage: data.error || "Text extraction failed.",
        });
        return;
      }

      // Success: update document with extracted text and structure
      onUpdateDocument(docId, {
        status: "ready",
        fullText: data.extracted.fullText,
        pages: data.extracted.pages,
        pageCount: data.extracted.pageCount,
        characterCount: data.extracted.characterCount,
        wordCount: data.extracted.wordCount,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Network error during text extraction.";
      onUpdateDocument(docId, {
        status: "error",
        errorMessage: message,
      });
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const files = Array.from(fileList);
    for (const file of files) {
      await processAndUploadFile(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-indigo-400 bg-indigo-50/40"
            : "border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <Upload className="w-4 h-4" />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-800">
              Upload documents
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Drag &amp; drop or click to browse (PDF, TXT, MD, DOCX up to 25MB)
            </p>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 text-xs font-semibold px-1"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
