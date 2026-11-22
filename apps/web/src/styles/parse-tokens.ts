export type TokenMap = Record<string, string>;

const declaration = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;

function declarations(body: string) {
  const out: TokenMap = {};
  for (const match of body.matchAll(declaration)) {
    out[match[1] as string] = (match[2] as string)
      .replaceAll(/\s+/g, " ")
      .trim();
  }
  return out;
}

function blockBody(css: string, selector: string) {
  const start = css.indexOf(selector);
  if (start < 0) {
    throw new Error(`selector not found: ${selector}`);
  }
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") {
      depth += 1;
    } else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, i);
      }
    }
  }
  throw new Error(`unclosed block: ${selector}`);
}

export function parseTokens(css: string) {
  return {
    light: declarations(blockBody(css, ":root {")),
    darkMedia: declarations(
      blockBody(
        blockBody(css, "@media (prefers-color-scheme: dark)"),
        ":root:not",
      ),
    ),
    darkAttribute: declarations(blockBody(css, ':root[data-theme="dark"]')),
    scales: declarations(blockBody(css, "@theme static")),
  };
}
