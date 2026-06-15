import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const winnerSans = localFont({
  src: "../public/fonts/winner-sans.ttf",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skylos PM",
  description: "Operaciones internas — Skylos AI Software",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${winnerSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
