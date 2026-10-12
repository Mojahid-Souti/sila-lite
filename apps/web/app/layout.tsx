import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/**
 * The interface faces.
 *
 * Google Sans is what Gemini uses and is NOT licensable outside Google, so the
 * open near-equivalents stand in: Inter carries the same neutral geometry for
 * UI and body, and Roboto Mono is open (Apache-2.0) so it is the real thing
 * rather than a substitute.
 *
 * `next/font` self-hosts both at build time — the browser never calls Google,
 * which keeps the sovereignty story intact and removes a render-blocking
 * third-party request.
 */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sila",
  description: "Sovereign AI agent marketplace and factory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
