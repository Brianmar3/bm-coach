import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "BM Training",
    template: "%s · BM Training",
  },
  description: "Gestión, entrenamiento y seguimiento",
  manifest: "/portal/manifest.webmanifest",
  applicationName: "BM Training",
  appleWebApp: {
    capable: true,
    title: "BM Training",
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

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
