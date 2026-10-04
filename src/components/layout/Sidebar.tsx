"use client";

import React from "react";
import {
  FileSearch,
  BookOpen,
  AlertTriangle,
  FolderGit2,
  ShieldCheck,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  documentCount: number;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  documentCount,
}: SidebarProps) {
  const navItems = [
    {
      id: "workspace",
      label: "Workspace",
      icon: FileSearch,
    },
    {
      id: "evidence",
      label: "Citations",
      icon: BookOpen,
    },
    {
      id: "conflicts",
      label: "Conflicts",
      icon: AlertTriangle,
    },
    {
      id: "documents",
      label: "Documents",
      icon: FolderGit2,
      badge: documentCount > 0 ? documentCount.toString() : undefined,
    },
  ];

  return (
    <aside className="w-56 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none hidden md:flex">
      <div className="p-3">
        <div className="px-3 py-2 mb-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Navigation
          </span>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-all ${
                  isActive
                    ? "bg-indigo-50/80 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono font-medium border border-slate-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3.5 m-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1.5">
        <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs pb-1 border-b border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Investigation Engine</span>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">Target Model</span>
          <span className="font-mono text-slate-800 font-medium">Qwen 27B</span>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">Provider</span>
          <span className="text-slate-800 font-medium">Groq API</span>
        </div>
      </div>
    </aside>
  );
}
