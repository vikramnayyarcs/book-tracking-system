import { describe, expect, it } from "vitest";
import { evaluate, type ClerkEnvironment } from "./expected.ts";

const matching: ClerkEnvironment = {
  user_settings: {
    attributes: {
      email_address: {
        enabled: true,
        first_factors: ["email_link"],
        verifications: ["email_link"],
      },
      phone_number: { enabled: false },
      username: { enabled: false },
      password: { enabled: false },
    },
    social: {
      oauth_google: { enabled: true },
      oauth_apple: { enabled: false },
    },
  },
};

const development = { environment_type: "development" };

describe("evaluate", () => {
  it("accepts the settings in the checklist", () => {
    expect(evaluate(matching, development)).toEqual([]);
  });

  it("reports a production instance", () => {
    const findings = evaluate(matching, { environment_type: "production" });
    expect(findings.map((finding) => finding.setting)).toEqual([
      "instance type",
    ]);
  });

  it("reports an extra sign-in method", () => {
    const environment: ClerkEnvironment = {
      user_settings: {
        ...matching.user_settings,
        attributes: {
          ...matching.user_settings?.attributes,
          password: { enabled: true },
        },
      },
    };
    expect(
      evaluate(environment, development).map((finding) => finding.setting),
    ).toEqual(["password enabled"]);
  });

  it("reports an extra social connection", () => {
    const environment: ClerkEnvironment = {
      user_settings: {
        ...matching.user_settings,
        social: {
          oauth_google: { enabled: true },
          oauth_github: { enabled: true },
        },
      },
    };
    expect(
      evaluate(environment, development).map((finding) => finding.setting),
    ).toEqual(["social oauth_github enabled"]);
  });

  it("reports Google switched off", () => {
    const environment: ClerkEnvironment = {
      user_settings: {
        ...matching.user_settings,
        social: { oauth_google: { enabled: false } },
      },
    };
    expect(
      evaluate(environment, development).map((finding) => finding.setting),
    ).toEqual(["social google enabled"]);
  });

  it("reports missing email settings instead of passing", () => {
    expect(evaluate({}, development)).toHaveLength(4);
  });
});
