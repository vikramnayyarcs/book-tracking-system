import type { components } from "@book-tracking-system/api-contract/types";

type Session = components["schemas"]["Session"];
type Insight = components["schemas"]["Insight"];
type Reflection = components["schemas"]["Reflection"];

export type PhotoExtension = "jpg" | "png" | "webp";

const extensions: Record<string, PhotoExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export function photoExtension(mimeType: string) {
  return extensions[mimeType] ?? null;
}

export function checkPhoto(file: { type: string; size: number }) {
  if (photoExtension(file.type) === null) {
    return "Choose a JPEG, PNG or WebP photo.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return "The photo is larger than 3 MB. Choose a smaller one.";
  }
  return null;
}

export function sessionLocation(session: Session) {
  if (session.chapter) return session.chapter;
  if (session.pageFrom !== null && session.pageTo !== null) {
    return session.pageFrom === session.pageTo
      ? `Page ${session.pageFrom}`
      : `Pages ${session.pageFrom} to ${session.pageTo}`;
  }
  return "No place noted";
}

export function splitInsights(items: Insight[]) {
  return {
    insights: items.filter((item) => item.kind === "insight"),
    quotes: items.filter((item) => item.kind === "quote"),
  };
}

export function reflectionsFor(
  items: Reflection[],
  stage: Reflection["stage"],
) {
  return items
    .filter((item) => item.stage === stage)
    .toSorted((a, b) => a.position - b.position);
}

export function parseRating(value: string) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}
