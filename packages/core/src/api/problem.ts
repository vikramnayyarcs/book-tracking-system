export type ProblemCode =
  | "internal_error"
  | "not_found"
  | "gateway_rejected"
  | "unauthorized"
  | "insufficient_scope"
  | "validation_failed"
  | "isbn_invalid"
  | "isbn_not_found"
  | "tier_limit_reached"
  | "tier_feature_unavailable"
  | "already_processed"
  | "nothing_to_process"
  | "ai_unavailable";

export type Problem = {
  type: string;
  title: string;
  status: number;
  code: ProblemCode;
  detail?: string;
  instance?: string;
};

export const problemResponse = (
  status: number,
  code: ProblemCode,
  title: string,
  requestId: string,
  detail?: string,
) => {
  const body: Problem = {
    type: `about:blank#${code}`,
    title,
    status,
    code,
    instance: requestId,
    ...(detail === undefined ? {} : { detail }),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
};
