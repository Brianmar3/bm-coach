import type { Metadata } from "next";
import { AppFrame } from "@/componentes/app-frame";
import { BmTrainingSplash } from "@/componentes/bm-training-splash";
import { PwaServiceWorkerRegistration } from "@/componentes/pwa-service-worker-registration";
import { AppearanceRuntime } from "@/componentes/appearance-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "BM Training",
  description: "Gestión, entrenamiento y seguimiento",
  applicationName: "BM Training",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BM Training",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/bm-training-pwa-192-v7.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/bm-training-pwa-512-v7.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icons/bm-training-apple-touch-v7.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full" data-theme="dark" data-appearance="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var p=localStorage.getItem("bm-appearance-v1");p=p==="light"||p==="system"?p:"dark";var d=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.appearance=p;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){document.documentElement.dataset.theme="dark"}` }} /></head>
      <body className="min-h-full">
        <AppearanceRuntime />
        <PwaServiceWorkerRegistration />
        <BmTrainingSplash />
        <div id="bm-app-root">
          <AppFrame>{children}</AppFrame>
        </div>
      </body>
    </html>
  );
}
