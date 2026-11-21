/** Single source of the product's public identity; no other file may hard-code these values. */
export const brand = {
  name: "Book Vault",
  tagline: "A private memory for the physical books you read.",
  domain: "example.invalid",
  waitlistUrl: "https://example.invalid/waitlist",
  handles: {
    substack: "example",
  },
} as const;

export type Brand = typeof brand;
