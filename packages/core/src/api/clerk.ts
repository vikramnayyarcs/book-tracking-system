import type { IdentityStore } from "../account.ts";

export const clerkIdentity = (config: {
  secretKey: string;
  baseUrl?: string;
}) =>
  ({
    configured: config.secretKey !== "",
    deleteUser: async (userId) => {
      const response = await fetch(
        `${config.baseUrl ?? "https://api.clerk.com"}/v1/users/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${config.secretKey}` },
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error(`Clerk delete returned ${response.status}`);
      }
    },
  }) satisfies IdentityStore;
