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

export const enabledSocial = ["oauth_google", "oauth_apple"];

export const emailFirstFactors: string[] = [];

export const emailVerifications: string[] = [];

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
    "email address first factors",
    emailFirstFactors,
    email?.first_factors,
  );
  expect(
    "email address verifications",
    emailVerifications,
    email?.verifications,
  );
  for (const name of offAttributes) {
    expect(`${name} enabled`, false, attributes[name]?.enabled ?? false);
  }
  for (const name of enabledSocial) {
    expect(`social ${name} enabled`, true, social[name]?.enabled);
  }
  for (const [name, connection] of Object.entries(social)) {
    if (!enabledSocial.includes(name)) {
      expect(`social ${name} enabled`, false, connection?.enabled ?? false);
    }
  }
  return findings;
};
