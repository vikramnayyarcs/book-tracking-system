export type ObjectStore = {
  remove: (bucket: "audio" | "photos", paths: string[]) => Promise<void>;
};
