import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const scholr = service("scholr", {
    source: github("nutlak/scholr", { checkSuites: false, rootDirectory: "/server" }),
    replicas: { "sfo": 1 },
    // Restored from the old railway.toml. `railway config migrate` dropped the
    // restart policy entirely and cleared these on the service, so they have to
    // be declared here or the next deploy runs without a healthcheck.
    builder: "NIXPACKS",
    start: "node index.js",
    healthcheck: "/healthz",
    healthcheckTimeout: 15,
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 3,
    env: {
      CLAUDE_API_KEY: preserve(),
      CLIENT_ORIGIN: preserve(),
      OPENAI_API_KEY: preserve(),
      PUBLIC_API_URL: preserve(),
      RESEND_API_KEY: preserve(),
      RESEND_FROM: preserve(),
      STRIPE_PRICE_ID: preserve(),
      STRIPE_PRICE_ID_SQUAD: preserve(),
      STRIPE_PUBLISHABLE_KEY: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      SUPABASE_ANON_KEY: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      SUPABASE_URL: preserve(),
      VAPID_PRIVATE_KEY: preserve(),
      VAPID_PUBLIC_KEY: preserve(),
      VAPID_SUBJECT: preserve(),
    },
  });

  return project("scholr", {
    resources: [scholr],
  });
});
