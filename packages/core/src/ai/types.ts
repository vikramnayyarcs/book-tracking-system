export type SpeechToText = {
  transcribe: (audio: Blob, filename: string) => Promise<{ text: string }>;
};

export type TextUsage = { inputTokens: number; outputTokens: number };

export type TextModel = {
  completeJson: (input: {
    system: string;
    user: string;
  }) => Promise<{ json: unknown; usage: TextUsage }>;
};

export type VisionModel = {
  readLines: (input: {
    system: string;
    user: string;
    image: Blob;
  }) => Promise<{ json: unknown; usage: TextUsage }>;
};

export type Embedder = {
  embed: (texts: string[]) => Promise<number[][]>;
};

export class AiError extends Error {
  readonly code: "ai_provider_error" | "ai_bad_output" | "ai_rate_limited";
  constructor(code: AiError["code"]) {
    super(code);
    this.code = code;
  }
}
