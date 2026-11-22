import { readPageLines } from "./ai/ocr.ts";
import type { VisionModel } from "./ai/types.ts";
import type { ObjectStore } from "./api/storage.ts";

export const OCR_MAX_BYTES = 3 * 1024 * 1024;
export const OCR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const quotePhotoPath = (userId: string, photoId: string) =>
  `${userId}/quote-photos/${photoId}`;

type QuotePhotoResult =
  | { status: "ok"; lines: string[] }
  | { status: "not_found" }
  | { status: "invalid"; detail: string };

export const readQuotePhoto = async (
  deps: { objects: ObjectStore; vision: VisionModel },
  userId: string,
  photoId: string,
) => {
  const path = quotePhotoPath(userId, photoId);
  try {
    const image = await deps.objects.download("photos", path).catch(() => null);
    if (image === null) {
      return { status: "not_found" } as const satisfies QuotePhotoResult;
    }
    if (image.size > OCR_MAX_BYTES) {
      return {
        status: "invalid",
        detail: "Photo is larger than 3 MB; upload a smaller one",
      } as const satisfies QuotePhotoResult;
    }
    if (!OCR_MIME_TYPES.includes(image.type)) {
      return {
        status: "invalid",
        detail: "Photo must be JPEG, PNG or WebP",
      } as const satisfies QuotePhotoResult;
    }
    const { lines } = await readPageLines(deps.vision, image);
    return { status: "ok", lines } as const satisfies QuotePhotoResult;
  } finally {
    await deps.objects.remove("photos", [path]);
  }
};
