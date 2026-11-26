import { Switch as AriaSwitch } from "react-aria-components";

export function Switch({
  label,
  isSelected,
  onChange,
  isDisabled,
}: {
  label: string;
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  isDisabled?: boolean;
}) {
  return (
    <AriaSwitch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled ?? false}
      className="group flex min-h-11 items-center gap-md text-base text-ink outline-none data-[disabled]:opacity-60"
    >
      <div className="flex h-lg w-2xl items-center rounded-full border border-border-strong bg-surface p-xs group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-accent group-data-[selected]:justify-end group-data-[selected]:border-accent group-data-[selected]:bg-accent">
        <div className="size-md rounded-full bg-ink group-data-[selected]:bg-accent-ink" />
      </div>
      {label}
    </AriaSwitch>
  );
}
