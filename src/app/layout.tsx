import type { Metadata } from "next";
import { Inter } from "next/font/google";
import MainLayout from "@/components/layout/MainLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/contexts/ToastContext";
import { FontSizeProvider } from "@/contexts/FontSizeContext";
import { UserProvider } from "@/contexts/UserContext";
import { FilterProvider } from "@/contexts/FilterContext";
import { ModalProvider } from "@/contexts/ModalContext";
import { CompanyFilterProvider } from "@/contexts/CompanyFilterContext";
import QueryProvider from "@/providers/QueryProvider";
import "./globals.css";
import "../styles/print.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "태창 ERP 시스템",
  description: "태창 자동차 부품 제조 ERP 시스템",
  icons: {
    icon: '/favicon.ico',
  },
};

// Force dynamic rendering for all pages due to client-side contexts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${inter.variable} antialiased`}
      >
        <QueryProvider>
          <UserProvider>
            <FilterProvider>
              <CompanyFilterProvider>
                <ModalProvider>
                  <FontSizeProvider>
                    <ToastProvider>
                      <ErrorBoundary>
                        <MainLayout>{children}</MainLayout>
                      </ErrorBoundary>
                    </ToastProvider>
                  </FontSizeProvider>
                </ModalProvider>
              </CompanyFilterProvider>
            </FilterProvider>
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
