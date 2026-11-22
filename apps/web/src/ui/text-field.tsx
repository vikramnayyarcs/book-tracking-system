import {
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
  TextField as AriaTextField,
} from "react-aria-components";

const control =
  "w-full rounded-md border border-border-strong bg-surface px-md py-sm text-base text-ink outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[disabled]:opacity-60";

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 5,
  inputMode,
  type,
  description,
  error,
  isDisabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  inputMode?: "numeric" | "text";
  type?: "date" | "text";
  description?: string | undefined;
  error?: string | null;
  isDisabled?: boolean | undefined;
  className?: string;
}) {
  return (
    <AriaTextField
      value={value}
      onChange={onChange}
      {...(type ? { type } : {})}
      isInvalid={Boolean(error)}
      isDisabled={isDisabled ?? false}
      className={`flex flex-col gap-xs ${className ?? ""}`}
    >
      <Label className="text-sm font-medium text-ink">{label}</Label>
      {multiline ? (
        <TextArea rows={rows} className={control} />
      ) : (
        <Input {...(inputMode ? { inputMode } : {})} className={control} />
      )}
      {description ? (
        <Text slot="description" className="text-sm text-ink-muted">
          {description}
        </Text>
      ) : null}
      <FieldError className="text-sm text-danger">{error}</FieldError>
    </AriaTextField>
  );
}
