import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useMe } from "../api/hooks.ts";
import { useSession } from "../auth/session.tsx";
import { clearDeviceData } from "../clear-device-data.ts";
import { meta } from "../ui/styles.ts";
import { Button } from "../ui/button.tsx";

const tierLabel = { free: "Free", plus: "Plus" } as const;

function Tier() {
  const me = useMe();
  if (me.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading your plan"
        className="h-6 w-24 rounded-sm bg-surface-sunken"
      />
    );
  }
  if (me.isError) {
    return (
      <div className="flex flex-wrap items-center gap-sm">
        <p className="rounded-md bg-danger-subtle px-md py-sm text-danger-subtle-ink">
          {me.error.message}
        </p>
        <Button onPress={() => void me.refetch()}>Try again</Button>
      </div>
    );
  }
  return <p className="text-base font-medium">{tierLabel[me.data.tier]}</p>;
}

export function SettingsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [cleared, setCleared] = useState(false);

  return (
    <>
      <p className={`${meta} mb-xs`}>Your account</p>
      <h1 className="mb-lg font-serif text-2xl font-semibold">Settings</h1>

      <section
        aria-labelledby="plan-heading"
        className="mb-lg border-b border-dashed border-border pb-lg"
      >
        <h2 id="plan-heading" className="mb-sm text-lg font-semibold">
          Plan
        </h2>
        <Tier />
      </section>

      <section
        aria-labelledby="device-heading"
        className="mb-lg border-b border-dashed border-border pb-lg"
      >
        <h2 id="device-heading" className="mb-sm text-lg font-semibold">
          This device
        </h2>
        <p className="mb-md text-ink-muted">
          Notes you opened are kept here so you can read them offline. Clearing
          removes them, and any session waiting to upload.
        </p>
        <Button
          onPress={() => {
            void clearDeviceData(queryClient).then(() => setCleared(true));
          }}
        >
          Clear data on this device
        </Button>
        {cleared ? (
          <p role="status" className="mt-sm text-ink-muted">
            Data on this device was cleared.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="mb-sm text-lg font-semibold">
          Account
        </h2>
        <Button variant="primary" onPress={() => void session.signOut()}>
          Sign out
        </Button>
      </section>
    </>
  );
}
