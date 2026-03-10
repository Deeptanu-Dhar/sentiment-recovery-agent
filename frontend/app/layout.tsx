import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "@/components/AppProviders";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Recovery Agent — Hospital AI",
  description: "Sentiment-Driven Service Recovery System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppProviders>
          <AppHeader />
          <main className="page-enter min-h-[calc(100vh-116px)] overflow-auto">
            <div className="mx-auto w-full max-w-[1280px] px-5 py-6 md:px-7 md:py-8 lg:px-8 lg:py-10">
              {children}
            </div>
          </main>
        </AppProviders>
      </body>
    </html>
  );
}