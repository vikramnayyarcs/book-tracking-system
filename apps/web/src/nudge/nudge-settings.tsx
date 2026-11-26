import { useState } from "react";
import { useMe } from "../api/hooks.ts";
import { useSetNudge, useUpdateMe } from "../api/nudge-hooks.ts";
import { useOnline } from "../ui/online.ts";
import { Button } from "../ui/button.tsx";
import { Switch } from "../ui/switch.tsx";
import { TextField } from "../ui/text-field.tsx";
import {
  defaultNudgeTime,
  isNudgeTime,
  isSilencedToday,
  pushState,
  readPushEnvironment,
  type PushState,
} from "./nudge-logic.ts";

const unavailable: Record<Exclude<PushState, "ready">, string> = {
  "needs-install":
    "This page is open in the browser. Tap Share, then Add to Home Screen, open the app from there, and come back to this page.",
  denied:
    "Notifications are blocked for this app. Allow them in your browser or phone settings, then reload this page.",
  unsupported: "This browser cannot receive push notifications.",
};

export function NudgeSettings() {
  const me = useMe();
  const online = useOnline();
  const setNudge = useSetNudge();
  const updateMe = useUpdateMe();
  const [draft, setDraft] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const state = pushState(readPushEnvironment());

  if (me.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading nudge settings"
        className="h-2xl w-full rounded-sm bg-surface-sunken"
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

  const nudgeTime = me.data.nudgeTime;
  const isOn = nudgeTime !== null;
  const silenced = isSilencedToday(
    me.data.notReadingUntil,
    me.data.timeZone,
    now,
  );
  const time = draft ?? nudgeTime ?? defaultNudgeTime;
  const timeError = isNudgeTime(time) ? null : "Choose a time.";
  const busy = setNudge.isPending || updateMe.isPending;
  const canToggle = online && !busy && (isOn || state === "ready");
  const error = setNudge.error ?? updateMe.error;

  return (
    <>
      <p className="mb-md text-ink-muted">
        A reminder to log a session. It is sent at your time only on days you
        have no entry and a book is in Reading. Tap it to open Log session. On
        iPhone, push works only after you add the app to the home screen.
      </p>
      {state !== "ready" ? (
        <p
          role="note"
          className="mb-md rounded-md bg-surface-sunken px-md py-sm text-ink"
        >
          {unavailable[state]}
        </p>
      ) : null}
      <Switch
        label="Daily reminder"
        isSelected={isOn}
        isDisabled={!canToggle}
        onChange={(on) => {
          setDraft(null);
          setNudge.mutate({ on, time });
        }}
      />
      {isOn ? (
        <div className="mt-md flex flex-col gap-md">
          <div className="flex flex-wrap items-end gap-sm">
            <TextField
              label="Reminder time"
              type="time"
              value={time}
              onChange={setDraft}
              error={timeError}
              isDisabled={!online || busy}
              className="w-auto"
            />
            <Button
              isDisabled={
                !online ||
                busy ||
                timeError !== null ||
                draft === null ||
                draft === nudgeTime
              }
              onPress={() =>
                updateMe.mutate(
                  { nudgeTime: time },
                  { onSuccess: () => setDraft(null) },
                )
              }
            >
              Save time
            </Button>
          </div>
          <div>
            <Button
              isDisabled={!online || busy}
              onPress={() => updateMe.mutate({ notReadingToday: !silenced })}
            >
              {silenced ? "Start reminders again today" : "Not reading today"}
            </Button>
            {silenced ? (
              <p role="status" className="mt-sm text-ink-muted">
                No reminder today. It comes back tomorrow.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {!online ? (
        <p className="mt-sm text-ink-muted">
          You are offline. Reminder settings need a connection.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-sm text-danger-subtle-ink">
          {error.message}
        </p>
      ) : null}
    </>
  );
}
