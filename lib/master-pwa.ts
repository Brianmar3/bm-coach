import type { Metadata } from "next";

/** Advertise the same install identity before login and after /master redirects to /platform. */
export const masterPwaMetadata: Metadata = {
  title: "BM Training Master",
  applicationName: "BM Training Master",
  description: "Administración de la plataforma BM Training",
  manifest: "/master/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BM Training Master",
    statusBarStyle: "black-translucent",
  },
};
