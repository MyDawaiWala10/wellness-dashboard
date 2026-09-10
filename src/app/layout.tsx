import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/providers/providers";
import { SessionExpiredDialog } from "@/components/session-expired-dialog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wellness Dashboard MDW",
  description: "Wellness Dashboard MyDawaiwala",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-screen overflow-hidden">
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-screen overflow-hidden`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster position="top-right" richColors={true} />
            <SessionExpiredDialog />
            {children}
          </ThemeProvider>
            </Providers>
      </body>
    </html>
  );
}
