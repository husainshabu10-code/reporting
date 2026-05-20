import type { Metadata } from "next";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASHARA MUBARAKAH IT Readiness Master Tracker",
  description: "Internal operations dashboard for ASHARA MUBARAKAH IT readiness tracking"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
