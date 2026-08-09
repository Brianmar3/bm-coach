import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los medios del dataset son sólo para validación local y no deben entrar al artefacto de producción.
  outputFileTracingExcludes: {
    "/api/exercise-library/media": ["./external/exercises-dataset-main/images/**/*", "./external/exercises-dataset-main/videos/**/*"],
  },
};

export default nextConfig;
