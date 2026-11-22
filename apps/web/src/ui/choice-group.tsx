import { Label, Radio, RadioGroup } from "react-aria-components";

export interface Choice {
  id: string;
  label: string;
}

export function ChoiceGroup({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <RadioGroup
      value={value}
      onChange={onChange}
      orientation="horizontal"
      className="flex flex-col gap-xs"
    >
      <Label className="text-sm font-medium text-ink">{label}</Label>
      <div className="flex gap-sm">
        {choices.map((choice) => (
          <Radio
            key={choice.id}
            value={choice.id}
            className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-md text-base text-ink outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[selected]:border-accent data-[selected]:bg-accent-subtle data-[selected]:font-medium data-[selected]:text-accent-subtle-ink"
          >
            {choice.label}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
