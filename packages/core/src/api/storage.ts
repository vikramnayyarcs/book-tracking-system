export type ObjectStore = {
  remove: (bucket: "audio" | "photos", paths: string[]) => Promise<void>;
  signedUploadUrl: (
    bucket: "audio" | "photos",
    path: string,
  ) => Promise<{ url: string; expiresInSeconds: number }>;
};
