const staging = {
  branch: "br-rapid-haze-avzo0dxy",
  endpoint: "ep-icy-mud-avwd38s0",
  host: "ep-icy-mud-avwd38s0-pooler.c-11.us-east-1.aws.neon.tech",
  role: "photos_staging_owner",
};

export async function verifyStagingDatabase(env, createClient) {
  if (env.VERCEL_ENV !== "preview" || env.VERCEL_TARGET_ENV !== "preview") {
    throw new Error("preview_required");
  }
  if (env.VERCEL_GIT_COMMIT_REF !== "codex/safari-staging") {
    throw new Error("branch_required");
  }

  let destination;
  try {
    destination = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("destination_invalid");
  }
  // Pass only connection options understood by this staging check.
  const tls = destination.searchParams.getAll("sslmode");
  if (!["postgres:", "postgresql:"].includes(destination.protocol)
      || destination.hostname !== staging.host
      || (destination.port && destination.port !== "5432")
      || destination.username !== staging.role
      || !destination.password
      || tls.length !== 1 || tls[0] !== "require"
      || destination.searchParams.has("sslaccept")) {
    throw new Error("destination_invalid");
  }

  destination.search = "?sslmode=require";
  destination.hash = "";

  let client;
  let metadata;
  try {
    client = createClient(destination.toString());
    metadata = await client.$queryRaw`
      SELECT current_user AS role,
             current_setting('neon.branch_id', true) AS branch,
             current_setting('neon.endpoint_id', true) AS endpoint
    `;
  } catch {
    throw new Error("metadata_unavailable");
  } finally {
    if (client) {
      try {
        await client.$disconnect();
      } catch {
        throw new Error("metadata_unavailable");
      }
    }
  }
  const identity = metadata?.[0];
  if (metadata?.length !== 1 || identity?.role !== staging.role
      || identity.branch !== staging.branch || identity.endpoint !== staging.endpoint) {
    throw new Error("metadata_mismatch");
  }
}
