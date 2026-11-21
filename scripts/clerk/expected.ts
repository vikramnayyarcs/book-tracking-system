export type Finding = { setting: string; expected: string; actual: string };

type Attribute = { enabled?: boolean };

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

export const onSocial = ["oauth_google", "oauth_apple"] as const;

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
  for (const name of offAttributes) {
    expect(`${name} enabled`, false, attributes[name]?.enabled ?? false);
  }
  for (const name of onSocial) {
    expect(`social ${name} enabled`, true, social[name]?.enabled);
  }
  for (const [name, connection] of Object.entries(social)) {
    if (!(onSocial as readonly string[]).includes(name)) {
      expect(`social ${name} enabled`, false, connection?.enabled ?? false);
    }
  }
  return findings;
};
