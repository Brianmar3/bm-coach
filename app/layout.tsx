import type { Metadata } from "next";
import { AppFrame } from "@/componentes/app-frame";
import "./globals.css";

export const metadata: Metadata = { title: "BM Training", description: "Gestión, entrenamiento y seguimiento" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full bg-black" style={{ backgroundColor: "#000000" }}>
      <body className="min-h-full bg-black text-white" style={{ backgroundColor: "#000000" }}><AppFrame>{children}</AppFrame></body>
    </html>
  );
}
