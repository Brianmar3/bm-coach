import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BM Training",
    short_name: "BM Training",
    description: "Gestión, entrenamiento y seguimiento",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#facc15",
    icons: [
      {
        src: "/bm-training-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/bm-training-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
