export type PushEnvironment = {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | "none";
  isIos: boolean;
  isStandalone: boolean;
};

export type PushState = ReturnType<typeof pushState>;

export function pushState(env: PushEnvironment) {
  if (env.isIos && !env.isStandalone) return "needs-install";
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) {
    return "unsupported";
  }
  if (env.permission === "denied") return "denied";
  return "ready";
}

export function readPushEnvironment() {
  const hasNotification = typeof Notification !== "undefined";
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const environment = {
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: typeof PushManager !== "undefined",
    hasNotification,
    permission: hasNotification ? Notification.permission : ("none" as const),
    isIos,
    isStandalone: window.matchMedia("(display-mode: standalone)").matches,
  } satisfies PushEnvironment;
  return environment;
}

export const defaultNudgeTime = "20:00";

export const isNudgeTime = (value: string) =>
  /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);

export function todayIn(timeZone: string, now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isSilencedToday(
  notReadingUntil: string | null,
  timeZone: string,
  now: Date,
) {
  return notReadingUntil !== null && notReadingUntil >= todayIn(timeZone, now);
}

export function keyToBytes(key: string) {
  const binary = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function subscriptionBody(subscription: PushSubscriptionJSON) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.["p256dh"] || !keys["auth"]) return null;
  return {
    endpoint,
    keys: { p256dh: keys["p256dh"], auth: keys["auth"] },
  };
}
