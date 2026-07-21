import type { Metadata } from "next";
import { Sidebar } from "@/componentes/sidebar";
import "./globals.css";

export const metadata: Metadata = { title: "BM Coach", description: "Gestión para entrenadores personales" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-zinc-950 text-white"><Sidebar /><div className="min-h-full lg:pl-64">{children}</div></body>
    </html>
  );
}
