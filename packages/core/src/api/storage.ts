export type ObjectStore = {
  remove: (bucket: "audio" | "photos", paths: string[]) => Promise<void>;
  download: (bucket: "audio" | "photos", path: string) => Promise<Blob>;
  signedUploadUrl: (
    bucket: "audio" | "photos",
    path: string,
  ) => Promise<{ url: string; expiresInSeconds: number }>;
};
