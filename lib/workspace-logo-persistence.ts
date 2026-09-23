export type WorkspaceLogoPersistenceCode = "STORAGE_UPLOAD_FAILED" | "SETTINGS_PERSISTENCE_FAILED";

export class WorkspaceLogoPersistenceError extends Error {
  readonly code: WorkspaceLogoPersistenceCode;

  constructor(code: WorkspaceLogoPersistenceCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "WorkspaceLogoPersistenceError";
    this.code = code;
  }
}

export async function persistUploadedWorkspaceLogo<T extends Record<string, unknown>>({
  current,
  previousUrl,
  upload,
  persist,
  remove,
}: {
  current: T;
  previousUrl: string;
  upload: () => Promise<{ url: string }>;
  persist: (next: T & { customLogoUrl: string; logoMode: "CUSTOM" }) => Promise<void>;
  remove: (url: string) => Promise<void>;
}) {
  let uploadedUrl = "";
  try {
    uploadedUrl = (await upload()).url;
  } catch (error) {
    throw new WorkspaceLogoPersistenceError("STORAGE_UPLOAD_FAILED", { cause: error });
  }

  const next = { ...current, customLogoUrl: uploadedUrl, logoMode: "CUSTOM" as const };
  try {
    await persist(next);
  } catch (error) {
    await remove(uploadedUrl);
    throw new WorkspaceLogoPersistenceError("SETTINGS_PERSISTENCE_FAILED", { cause: error });
  }

  if (previousUrl && previousUrl !== uploadedUrl) await remove(previousUrl);
  return { uploadedUrl, next };
}
