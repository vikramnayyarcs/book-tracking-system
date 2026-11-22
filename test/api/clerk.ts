const clerk = "https://api.clerk.com/v1";

const secretKey = process.env["CLERK_SECRET_KEY"] ?? "";

const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${clerk}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Clerk ${init.method ?? "GET"} ${path} returned ${response.status}`,
    );
  }
  return (await response.json()) as unknown;
};

export const ensureUser = async (externalId: string) => {
  const found = (await request(
    `/users?external_id=${encodeURIComponent(externalId)}`,
  )) as { id: string }[];
  const existing = found[0];
  if (existing !== undefined) {
    return existing.id;
  }
  const created = (await request("/users", {
    method: "POST",
    body: JSON.stringify({
      external_id: externalId,
      email_address: [`${externalId}@example.com`],
      skip_password_checks: true,
      skip_password_requirement: true,
    }),
  })) as { id: string };
  return created.id;
};

export const sessionTokenFor = async (externalId: string) => {
  const userId = await ensureUser(externalId);
  const session = (await request("/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  })) as { id: string };
  const token = (await request(`/sessions/${session.id}/tokens`, {
    method: "POST",
    body: "{}",
  })) as { jwt: string };
  return { userId, token: token.jwt };
};
