import { PrismaClient } from "@prisma/client";
import { verifyStagingDatabase } from "./staging-database-check.mjs";

const timeout = setTimeout(() => {
  console.error("Staging DB verification failed: timeout");
  process.exit(1);
}, 10_000);

try {
  await verifyStagingDatabase(process.env, (datasourceUrl) => new PrismaClient({
    datasourceUrl,
    log: [],
    errorFormat: "minimal",
  }));
  console.log("Staging DB verification passed.");
} catch (error) {
  console.error("Staging DB verification failed:", [
    "preview_required", "branch_required", "destination_invalid",
    "metadata_mismatch", "metadata_unavailable",
  ].includes(error?.message) ? error.message : "unexpected_error");
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
