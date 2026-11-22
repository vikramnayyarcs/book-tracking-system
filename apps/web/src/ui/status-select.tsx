import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";

export interface StatusOption {
  id: string;
  label: string;
}

export function StatusSelect({
  label,
  options,
  value,
  onChange,
  isDisabled,
}: {
  label: string;
  options: StatusOption[];
  value: string;
  onChange: (id: string) => void;
  isDisabled: boolean;
}) {
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
      isDisabled={isDisabled}
      className="flex flex-col"
    >
      <Label className="sr-only">{label}</Label>
      <Button className="inline-flex min-h-11 items-center justify-between gap-sm rounded-md border border-border-strong bg-surface px-md text-base text-ink outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[disabled]:opacity-60">
        <SelectValue />
        <span aria-hidden="true">v</span>
      </Button>
      <Popover className="min-w-(--trigger-width) rounded-md border border-border-strong bg-surface-raised p-xs text-ink">
        <ListBox className="outline-none">
          {options.map((o) => (
            <ListBoxItem
              key={o.id}
              id={o.id}
              textValue={o.label}
              className="flex min-h-11 items-center rounded-sm px-md text-base outline-none data-[focused]:bg-accent-subtle data-[focused]:text-accent-subtle-ink data-[selected]:font-medium"
            >
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
