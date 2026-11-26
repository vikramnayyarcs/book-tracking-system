import { useState } from "react";
import {
  Checkbox,
  CheckboxGroup,
  FileTrigger,
  Label,
} from "react-aria-components";
import { useReadQuotePhoto, useSaveQuote } from "../api/quote-hooks.ts";
import { Button } from "../ui/button.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";
import { checkPhoto } from "./book-logic.ts";
import { checkQuote } from "./quote-logic.ts";

export function QuotePhoto({ bookId }: { bookId: string }) {
  const online = useOnline();
  const read = useReadQuotePhoto(bookId);
  const save = useSaveQuote(bookId);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const reset = () => {
    setLines(null);
    setSelected([]);
    setPage("");
    setFormError(null);
    read.reset();
    save.reset();
  };

  const onPhoto = (files: FileList | null) => {
    const file = files?.[0] ?? null;
    if (!file) return;
    setSaved(false);
    const problem = checkPhoto(file);
    setPhotoError(problem);
    if (problem !== null) return;
    reset();
    read.mutate(file, { onSuccess: setLines });
  };

  const onSave = () => {
    if (lines === null) return;
    const checked = checkQuote(lines, selected, page);
    if ("error" in checked) {
      setFormError(checked.error);
      return;
    }
    setFormError(null);
    save.mutate(
      { text: checked.text, page: checked.page },
      {
        onSuccess: () => {
          reset();
          setSaved(true);
        },
      },
    );
  };

  return (
    <div className="flex flex-col items-start gap-sm">
      <FileTrigger
        acceptedFileTypes={["image/jpeg", "image/png", "image/webp"]}
        defaultCamera="environment"
        onSelect={onPhoto}
      >
        <Button isDisabled={!online || read.isPending}>
          {lines === null ? "Add a quote from a photo" : "Take another photo"}
        </Button>
      </FileTrigger>
      {!online ? (
        <p className="text-sm text-ink-muted">
          Offline. A quote photo needs a connection.
        </p>
      ) : null}
      {read.isPending ? (
        <p role="status" className="text-base text-ink-muted">
          Reading the page.
        </p>
      ) : null}
      {photoError ? (
        <p role="alert" className="text-sm text-danger">
          {photoError}
        </p>
      ) : null}
      {read.isError ? (
        <p role="alert" className="text-sm text-danger">
          {read.error.message} The photo is deleted, so take a new one.
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-ink">
          Quote saved.
        </p>
      ) : null}
      {lines !== null && lines.length === 0 ? (
        <p role="status" className="text-base text-ink-muted">
          No text found on the photo. Take a new photo of the page.
        </p>
      ) : null}
      {lines !== null && lines.length > 0 ? (
        <form
          className="flex w-full flex-col gap-sm"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <CheckboxGroup
            value={selected}
            onChange={setSelected}
            className="flex flex-col gap-xs"
          >
            <Label className="text-sm font-medium text-ink">
              Select the lines to save. The photo is already deleted.
            </Label>
            {lines.map((line, index) => (
              <Checkbox
                key={index}
                value={String(index)}
                className="flex min-h-11 cursor-pointer items-center rounded-md border border-border bg-surface px-md py-xs font-serif text-base text-ink outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[selected]:border-accent data-[selected]:bg-accent-subtle data-[selected]:text-accent-subtle-ink"
              >
                {line}
              </Checkbox>
            ))}
          </CheckboxGroup>
          <TextField
            label="Page number"
            inputMode="numeric"
            value={page}
            onChange={setPage}
          />
          {formError ? (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          ) : null}
          {save.isError ? (
            <p role="alert" className="text-sm text-danger">
              {save.error.message}
            </p>
          ) : null}
          <div className="flex gap-sm">
            <Button
              type="submit"
              variant="primary"
              isDisabled={!online || save.isPending}
            >
              {save.isPending ? "Saving" : "Save quote"}
            </Button>
            <Button onPress={reset}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
