import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LTI 1.3 Advantage Tool",
  description: "Next.js + Node.js LTI Tool",
};

import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
