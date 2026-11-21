export type Finding = { setting: string; expected: string; actual: string };

type Attribute = {
  enabled?: boolean;
  first_factors?: string[];
  verifications?: string[];
};

export type ClerkEnvironment = {
  user_settings?: {
    attributes?: Record<string, Attribute | undefined>;
    social?: Record<string, { enabled?: boolean } | undefined>;
  };
};

export type ClerkInstance = { environment_type?: string };

export const offAttributes = [
  "phone_number",
  "username",
  "password",
  "web3_wallet",
  "passkey",
] as const;

const describe = (value: unknown) =>
  value === undefined ? "missing" : JSON.stringify(value);

export const evaluate = (
  environment: ClerkEnvironment,
  instance: ClerkInstance,
) => {
  const findings: Finding[] = [];
  const expect = (setting: string, expected: unknown, actual: unknown) => {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      findings.push({
        setting,
        expected: describe(expected),
        actual: describe(actual),
      });
    }
  };
  const attributes = environment.user_settings?.attributes ?? {};
  const social = environment.user_settings?.social ?? {};

  expect("instance type", "development", instance.environment_type);
  const email = attributes["email_address"];
  expect("email address enabled", true, email?.enabled);
  expect(
    "email address first factor includes email link",
    true,
    email?.first_factors?.includes("email_link"),
  );
  expect(
    "email address verified by email link",
    true,
    email?.verifications?.includes("email_link"),
  );
  for (const name of offAttributes) {
    expect(`${name} enabled`, false, attributes[name]?.enabled ?? false);
  }
  expect("social google enabled", true, social["oauth_google"]?.enabled);
  for (const [name, connection] of Object.entries(social)) {
    if (name !== "oauth_google") {
      expect(`social ${name} enabled`, false, connection?.enabled ?? false);
    }
  }
  return findings;
};
