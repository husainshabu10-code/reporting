import type { Metadata } from "next";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASHARA MUBARAKAH IT Event Preparation",
  description: "Standalone IT event preparation reporting dashboard for ASHARA MUBARAKAH"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
