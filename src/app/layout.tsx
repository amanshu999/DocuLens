import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuLens - Intelligent Document Investigator",
  description: "Cross-document research workspace with verified citations and contradiction analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#fbfbfa]">
      <body className="min-h-screen bg-[#fbfbfa] text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        {children}
      </body>
    </html>
  );
}
