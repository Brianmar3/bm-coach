import type { Metadata } from "next";
import { AppFrame } from "@/componentes/app-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "BM Coach",
  description: "Gestión, entrenamiento y seguimiento",
  applicationName: "BM Coach",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BM Coach",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/bm-training-pwa-192-v4.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/bm-training-pwa-512-v4.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icons/bm-training-apple-touch-v4.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

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
