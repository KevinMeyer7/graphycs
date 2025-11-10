import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphycsOS - Compliance Course Factory",
  description: "Create engaging compliance training courses automatically",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
