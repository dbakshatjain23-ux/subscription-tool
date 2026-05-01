import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/toast-provider";
import "./globals.css";

const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "Subscriptions",
  description: "Track company subscriptions and renewal dates.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${bodyFont.variable} ${headingFont.variable} bg-slate-50 text-slate-950 antialiased`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
