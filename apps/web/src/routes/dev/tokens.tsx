import { parseTokens } from "../../styles/parse-tokens.ts";
import tokensCss from "../../styles/tokens.css?raw";

const tokens = parseTokens(tokensCss);

const colourNames = Object.keys(tokens.light);
const scaleEntries = Object.entries(tokens.scales);

function group(prefix: string) {
  return scaleEntries.filter(
    ([name]) => name.startsWith(prefix) && !name.includes("--line-height"),
  );
}

const textSizes = group("--text-");
const spaces = group("--spacing-");
const radii = group("--radius-");

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Swatch({ name }: { name: string }) {
  return (
    <li className="flex items-center gap-md rounded-md border border-border bg-surface-raised p-sm">
      <span
        aria-hidden="true"
        className="size-10 shrink-0 rounded-sm border border-border-strong"
        style={{ backgroundColor: `var(${name})` }}
      />
      <code className="font-mono text-sm">{name}</code>
    </li>
  );
}

function Pair({ label, className }: { label: string; className: string }) {
  return (
    <p className={`rounded-md px-md py-sm text-base ${className}`}>{label}</p>
  );
}

export function TokensPage() {
  return (
    <main className="mx-auto max-w-page space-y-2xl bg-surface p-lg text-ink">
      <header className="space-y-sm">
        <h1 className="font-serif text-2xl">Design tokens</h1>
        <p className="text-ink-muted">
          Every token that screens may use. Colours follow the system colour
          scheme.
        </p>
      </header>

      <section aria-labelledby="colours" className="space-y-md">
        <h2 id="colours" className="text-lg font-semibold">
          Colours
        </h2>
        <ul className="grid gap-sm sm:grid-cols-2">
          {colourNames.map((name) => (
            <Swatch key={name} name={name} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="pairings" className="space-y-md">
        <h2 id="pairings" className="text-lg font-semibold">
          Pairings
        </h2>
        <div className="grid gap-sm sm:grid-cols-2">
          <Pair
            label="Ink on surface"
            className="border border-border bg-surface text-ink"
          />
          <Pair
            label="Muted ink on raised surface"
            className="bg-surface-raised text-ink-muted"
          />
          <Pair
            label="Ink on sunken surface"
            className="bg-surface-sunken text-ink"
          />
          <Pair
            label="Accent on surface"
            className="border border-border bg-surface text-accent"
          />
          <Pair label="Text on accent" className="bg-accent text-accent-ink" />
          <Pair
            label="Text on subtle accent"
            className="bg-accent-subtle text-accent-subtle-ink"
          />
          <Pair label="Text on chrome" className="bg-chrome text-chrome-ink" />
          <Pair
            label="Error message"
            className="bg-danger-subtle text-danger-subtle-ink"
          />
        </div>
        <div className="flex flex-wrap items-end gap-md">
          <button
            type="button"
            className={`min-h-11 rounded-md bg-accent px-lg font-medium text-accent-ink ${focus}`}
          >
            Primary action
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-md border border-border-strong px-lg font-medium text-ink ${focus}`}
          >
            Secondary action
          </button>
          <label className="flex flex-col gap-xs text-sm">
            Page range
            <input
              type="text"
              defaultValue="42 to 67"
              className={`min-h-11 rounded-md border border-border-strong bg-surface px-md text-base text-ink ${focus}`}
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="type" className="space-y-md">
        <h2 id="type" className="text-lg font-semibold">
          Type
        </h2>
        <p className="font-serif text-xl">
          The serif is for book titles and quotes.
        </p>
        <p className="font-sans text-base">
          The system sans-serif is for the interface.
        </p>
        <ul className="space-y-xs">
          {textSizes.map(([name, size]) => (
            <li
              key={name}
              className="flex items-baseline gap-md"
              style={{ fontSize: `var(${name})` }}
            >
              <code className="w-24 shrink-0 font-mono text-xs">{name}</code>
              <span>Reading, one page at a time</span>
              <span className="ml-auto font-mono text-xs text-ink-muted">
                {size}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="spacing" className="space-y-md">
        <h2 id="spacing" className="text-lg font-semibold">
          Spacing
        </h2>
        <ul className="space-y-xs">
          {spaces.map(([name, size]) => (
            <li key={name} className="flex items-center gap-md">
              <code className="w-32 shrink-0 font-mono text-xs">{name}</code>
              <span
                aria-hidden="true"
                className="h-3 bg-accent"
                style={{ width: `var(${name})` }}
              />
              <span className="font-mono text-xs text-ink-muted">{size}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="radius" className="space-y-md">
        <h2 id="radius" className="text-lg font-semibold">
          Radius
        </h2>
        <ul className="flex flex-wrap gap-md">
          {radii.map(([name, size]) => (
            <li key={name} className="flex flex-col items-center gap-xs">
              <span
                aria-hidden="true"
                className="size-16 border-2 border-accent bg-accent-subtle"
                style={{ borderRadius: `var(${name})` }}
              />
              <code className="font-mono text-xs">{name}</code>
              <span className="font-mono text-xs text-ink-muted">{size}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
