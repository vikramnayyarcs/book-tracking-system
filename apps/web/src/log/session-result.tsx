import { meta, noteCard, noteText, quoteText } from "../ui/styles.ts";
import type { components } from "@book-tracking-system/api-contract/types";
import { useState } from "react";
import { ToggleButton } from "react-aria-components";
import {
  useBookSession,
  useDeleteInsight,
  useReprocessSession,
  useSessionInsights,
  useUpdateInsight,
  useUpdateSessionNote,
} from "../api/session-hooks.ts";
import { Button } from "../ui/button.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";
import { retryEntryNow } from "./queue-runner.ts";
import type { QueueEntry } from "./queue-logic.ts";

type Session = components["schemas"]["Session"];
type Insight = components["schemas"]["Insight"];

const processing = new Set(["draft", "uploaded", "transcribing", "extracting"]);

const statusText: Record<string, string> = {
  draft: "Saved. Starting to process.",
  uploaded: "Audio received. Starting to process.",
  transcribing: "Turning your voice note into text.",
  extracting: "Finding the insights in your note.",
};

export function WaitingToUpload({ entry }: { entry: QueueEntry }) {
  const online = useOnline();
  return (
    <section
      aria-labelledby="waiting-heading"
      className="flex flex-col items-start gap-sm rounded-md border border-border-strong bg-surface-raised p-md"
    >
      <h2 id="waiting-heading" className="text-lg font-medium">
        Waiting to upload
      </h2>
      <p role="status" className="text-base text-ink">
        {online
          ? "Your note is saved on this device and is uploading."
          : "Your note is saved on this device. It uploads when you are back online."}
      </p>
      {entry.lastError ? (
        <p className="text-sm text-ink-muted">Last try: {entry.lastError}</p>
      ) : null}
      {entry.rejected ? (
        <p role="alert" className="text-sm text-danger">
          The server refused this session. Check it, then try again.
        </p>
      ) : null}
      <Button
        isDisabled={!online}
        onPress={() => {
          void retryEntryNow(entry.id);
        }}
      >
        Upload now
      </Button>
    </section>
  );
}

function Transcript({ session }: { session: Session }) {
  const update = useUpdateSessionNote(session.id);
  const [draft, setDraft] = useState(session.noteText ?? "");
  const online = useOnline();
  const label = session.noteSource === "voice" ? "Transcript" : "Your note";
  const unchanged = draft === (session.noteText ?? "");

  return (
    <section
      aria-labelledby="transcript-heading"
      className="flex flex-col gap-sm"
    >
      <h2 id="transcript-heading" className="text-lg font-medium">
        {label}
      </h2>
      <TextField
        label={`Edit ${label.toLowerCase()}`}
        value={draft}
        onChange={setDraft}
        multiline
        rows={6}
        isDisabled={!online}
      />
      <div className="flex flex-wrap items-center gap-sm">
        <Button
          isDisabled={
            !online || unchanged || draft.trim() === "" || update.isPending
          }
          onPress={() => update.mutate(draft)}
        >
          {`Save ${label.toLowerCase()}`}
        </Button>
        {update.isSuccess && unchanged ? (
          <p role="status" className="text-sm text-ink-muted">
            Saved.
          </p>
        ) : null}
        {!online ? (
          <p className="text-sm text-ink-muted">
            Offline. Editing needs a connection.
          </p>
        ) : null}
      </div>
      {update.isError ? (
        <p role="alert" className="text-sm text-danger">
          {update.error.message}
        </p>
      ) : null}
    </section>
  );
}

function InsightItem({
  insight,
  sessionId,
  online,
}: {
  insight: Insight;
  sessionId: string;
  online: boolean;
}) {
  const update = useUpdateInsight(sessionId);
  const remove = useDeleteInsight(sessionId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(insight.text);
  const isQuote = insight.kind === "quote";
  const busy = update.isPending || remove.isPending;
  const error = update.error ?? remove.error;

  return (
    <li className={noteCard}>
      {editing ? (
        <>
          <TextField
            label={isQuote ? "Edit quote" : "Edit insight"}
            value={draft}
            onChange={setDraft}
            multiline
            rows={3}
          />
          <div className="flex flex-wrap gap-sm">
            <Button
              variant="primary"
              isDisabled={busy || draft.trim() === ""}
              onPress={() =>
                update.mutate(
                  { id: insight.id, body: { text: draft } },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              Save
            </Button>
            <Button
              onPress={() => {
                setDraft(insight.text);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <p
            className={isQuote ? quoteText : noteText}
            data-kind={insight.kind}
          >
            {insight.text}
          </p>
          <p className={meta}>
            {isQuote ? "Quote" : "Insight"}
            {insight.page ? `, page ${insight.page}` : ""}
            {insight.pinned ? ", pinned" : ""}
          </p>
          <div className="flex flex-wrap gap-sm">
            <ToggleButton
              isSelected={insight.pinned}
              isDisabled={!online || busy}
              onChange={(pinned) =>
                update.mutate({ id: insight.id, body: { pinned } })
              }
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-md text-base font-medium text-ink outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[disabled]:opacity-60 data-[selected]:bg-accent-subtle data-[selected]:text-accent-subtle-ink"
            >
              {insight.pinned ? "Unpin" : "Pin"}
            </ToggleButton>
            <Button
              isDisabled={!online || busy}
              onPress={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button
              isDisabled={!online || busy}
              onPress={() => remove.mutate(insight.id)}
            >
              Delete
            </Button>
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      ) : null}
    </li>
  );
}

function Insights({ sessionId }: { sessionId: string }) {
  const insights = useSessionInsights(sessionId, true);
  const online = useOnline();

  return (
    <section
      aria-labelledby="insights-heading"
      className="flex flex-col gap-sm"
    >
      <h2 id="insights-heading" className="text-lg font-medium">
        Insights
      </h2>
      {insights.isPending ? (
        <div
          aria-busy="true"
          className="h-24 rounded-md bg-surface-sunken"
          data-testid="insights-loading"
        />
      ) : null}
      {insights.isError ? (
        <div role="alert" className="flex flex-col items-start gap-sm">
          <p className="text-base text-danger">{insights.error.message}</p>
          <Button onPress={() => void insights.refetch()}>Try again</Button>
        </div>
      ) : null}
      {insights.data && insights.data.items.length === 0 ? (
        <p className="text-base text-ink-muted">
          No insights came out of this note. Add more detail and save it again,
          or keep the note as it is.
        </p>
      ) : null}
      {insights.data && insights.data.items.length > 0 ? (
        <ul className="flex flex-col gap-sm">
          {insights.data.items.map((insight) => (
            <InsightItem
              key={insight.id}
              insight={insight}
              sessionId={sessionId}
              online={online}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ProcessedSession({ sessionId }: { sessionId: string }) {
  const session = useBookSession(sessionId);
  const reprocess = useReprocessSession(sessionId);

  if (session.isPending) {
    return (
      <div
        aria-busy="true"
        data-testid="session-loading"
        className="h-32 rounded-md bg-surface-sunken"
      />
    );
  }
  if (session.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-sm">
        <p className="text-base text-danger">{session.error.message}</p>
        <Button onPress={() => void session.refetch()}>Try again</Button>
      </div>
    );
  }
  const data = session.data;
  if (processing.has(data.status)) {
    return (
      <p
        role="status"
        className="rounded-md bg-surface-sunken px-md py-sm text-base text-ink"
      >
        {statusText[data.status]}
      </p>
    );
  }
  if (data.status === "failed") {
    return (
      <div role="alert" className="flex flex-col items-start gap-sm">
        <p className="text-base text-danger">
          Processing failed. Your note is saved.
        </p>
        <Button
          variant="primary"
          isDisabled={reprocess.isPending}
          onPress={() => reprocess.mutate()}
        >
          Process again
        </Button>
        {reprocess.isError ? (
          <p className="text-sm text-danger">{reprocess.error.message}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-xl">
      <p role="status" className="text-base text-ink">
        Session saved.
      </p>
      <Transcript session={data} />
      <Insights sessionId={sessionId} />
    </div>
  );
}
