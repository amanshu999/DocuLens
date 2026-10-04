"use client";

import React from "react";
import { RotateCcw, Layers } from "lucide-react";

interface HeaderProps {
  documentCount: number;
  onResetWorkspace: () => void;
  isResetting?: boolean;
}

export default function Header({
  documentCount,
  onResetWorkspace,
  isResetting = false,
}: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
          <Layers className="w-4 h-4" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-base text-slate-900 tracking-tight">
            DocuLens
          </span>
          <span className="hidden sm:inline text-xs text-slate-500 font-normal">
            Intelligent Document Investigator
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {documentCount > 0 && (
          <button
            onClick={onResetWorkspace}
            disabled={isResetting}
            title="Reset workspace session"
            className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-2xs font-medium"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
            <span>Reset Workspace</span>
          </button>
        )}
      </div>
    </header>
  );
}
