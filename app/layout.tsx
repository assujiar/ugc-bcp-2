import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { lufga } from "@/components/fonts/lufga";
import "./globals.css";

export const metadata: Metadata = {
  title: "UGC Logistics Dashboard",
  description: "Integrated Dashboard for KPI, CRM, Ticketing, and DSO",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${lufga.variable} font-sans min-h-screen antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
