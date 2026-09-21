import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VigiClaim — Triage assurance",
  description: "Plateforme de triage intelligent des sinistres automobiles.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
