import type { components } from "@book-tracking-system/api-contract/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keyToBytes, subscriptionBody } from "../nudge/nudge-logic.ts";
import { api, ApiError, unwrap } from "./client.ts";

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["MeUpdate"]) =>
      unwrap(await api.PATCH("/me", { body })),
    onSuccess: (me) => queryClient.setQueryData(["me"], me),
  });
}

async function subscribeThisDevice() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new ApiError(
      "Notifications are blocked. Allow them in your browser settings, then try again.",
    );
  }
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = unwrap(await api.GET("/push/public-key"));
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(publicKey),
    }));
  const body = subscriptionBody(subscription.toJSON());
  if (!body) throw new ApiError("This device did not give a push address.");
  unwrap(await api.POST("/push-subscriptions", { body }));
}

async function unsubscribeThisDevice() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await api.DELETE("/push-subscriptions", {
    params: { query: { endpoint: subscription.endpoint } },
  });
  await subscription.unsubscribe();
}

export function useSetNudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { on: boolean; time: string }) => {
      if (!input.on) {
        await unsubscribeThisDevice();
        return unwrap(await api.PATCH("/me", { body: { nudgeTime: null } }));
      }
      await subscribeThisDevice();
      return unwrap(
        await api.PATCH("/me", {
          body: {
            nudgeTime: input.time,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      );
    },
    onSuccess: (me) => queryClient.setQueryData(["me"], me),
  });
}
