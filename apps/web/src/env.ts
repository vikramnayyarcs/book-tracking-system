export const env = {
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  faroCollectorUrl: import.meta.env.VITE_FARO_COLLECTOR_URL,
} as const;
