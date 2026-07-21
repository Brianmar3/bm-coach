import type { Metadata } from "next";
import { AppFrame } from "@/componentes/app-frame";
import "./globals.css";

export const metadata: Metadata = { title: "BM Coach", description: "Gestión para entrenadores personales" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-zinc-950 text-white"><AppFrame>{children}</AppFrame></body>
    </html>
  );
}
