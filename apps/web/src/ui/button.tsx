import { Button as AriaButton, type ButtonProps } from "react-aria-components";

type Variant = "primary" | "secondary" | "record";

const base =
  "inline-flex min-h-11 items-center justify-center rounded-md px-md py-sm text-base font-medium outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[disabled]:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink",
  record: "size-4xl rounded-full! bg-accent px-sm text-accent-ink",
  secondary: "border border-border-strong bg-surface text-ink",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: Omit<ButtonProps, "className"> & { variant?: Variant; className?: string }) {
  return (
    <AriaButton
      {...props}
      className={`${base} ${variants[variant]} ${className ?? ""}`}
    />
  );
}
