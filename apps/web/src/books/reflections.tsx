import type { components } from "@book-tracking-system/api-contract/types";
import { useState } from "react";
import {
  useAnswerReflection,
  useAskReflections,
  useBookReflections,
} from "../api/book-hooks.ts";
import { Button } from "../ui/button.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";
import { reflectionsFor } from "./book-logic.ts";

type Reflection = components["schemas"]["Reflection"];

function Question({
  reflection,
  bookId,
  online,
}: {
  reflection: Reflection;
  bookId: string;
  online: boolean;
}) {
  const save = useAnswerReflection(bookId);
  const [draft, setDraft] = useState(reflection.answer ?? "");
  const unchanged = draft === (reflection.answer ?? "");

  return (
    <li className="flex flex-col gap-sm rounded-md border border-border bg-surface-raised p-md">
      <TextField
        label={reflection.question}
        value={draft}
        onChange={setDraft}
        multiline
        rows={3}
        isDisabled={!online}
      />
      <div className="flex flex-wrap items-center gap-sm">
        <Button
          isDisabled={!online || unchanged || save.isPending}
          onPress={() =>
            save.mutate({
              id: reflection.id,
              answer: draft.trim() === "" ? null : draft,
            })
          }
        >
          {`Save answer ${reflection.position}`}
        </Button>
        {save.isSuccess && unchanged ? (
          <p role="status" className="text-sm text-ink-muted">
            Saved.
          </p>
        ) : null}
      </div>
      {save.isError ? (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
        </p>
      ) : null}
    </li>
  );
}

export function ReflectionQuestions({
  bookId,
  stage,
  heading,
  canAsk,
  cannotAskReason,
  askLabel,
  headingLevel = 2,
}: {
  bookId: string;
  stage: "mid" | "end";
  heading: string;
  canAsk: boolean;
  cannotAskReason: string;
  askLabel: string;
  headingLevel?: 2 | 3;
}) {
  const reflections = useBookReflections(bookId);
  const ask = useAskReflections(bookId);
  const online = useOnline();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const questions = reflections.data
    ? reflectionsFor(reflections.data.items, stage)
    : [];
  const id = `reflections-${stage}`;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-sm">
      <Heading id={id} className="text-lg font-medium">
        {heading}
      </Heading>
      {reflections.isPending ? (
        <div
          aria-busy="true"
          data-testid={`${id}-loading`}
          className="h-24 rounded-md bg-surface-sunken"
        />
      ) : null}
      {reflections.isError ? (
        <div role="alert" className="flex flex-col items-start gap-sm">
          <p className="text-base text-danger">{reflections.error.message}</p>
          <Button onPress={() => void reflections.refetch()}>Try again</Button>
        </div>
      ) : null}
      {reflections.data && questions.length === 0 ? (
        <div className="flex flex-col items-start gap-sm">
          <p className="text-base text-ink-muted">
            {canAsk
              ? "Three questions, written from your own notes."
              : cannotAskReason}
          </p>
          <Button
            variant="primary"
            isDisabled={!canAsk || !online || ask.isPending}
            onPress={() => ask.mutate(stage)}
          >
            {ask.isPending ? "Writing questions" : askLabel}
          </Button>
          {!online ? (
            <p className="text-sm text-ink-muted">
              Offline. Questions need a connection.
            </p>
          ) : null}
          {ask.isError ? (
            <p role="alert" className="text-sm text-danger">
              {ask.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
      {questions.length > 0 ? (
        <ul className="flex flex-col gap-sm">
          {questions.map((reflection) => (
            <Question
              key={reflection.id}
              reflection={reflection}
              bookId={bookId}
              online={online}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
