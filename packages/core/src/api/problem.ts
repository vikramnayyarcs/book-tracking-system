export type ProblemCode =
  | "internal_error"
  | "not_found"
  | "gateway_rejected"
  | "unauthorized"
  | "validation_failed";

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
) => {
  const body: Problem = {
    type: `about:blank#${code}`,
    title,
    status,
    code,
    instance: requestId,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
};
