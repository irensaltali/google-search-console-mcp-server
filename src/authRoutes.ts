import type { Request, Response, Router } from "express";
import express from "express";
import { google } from "googleapis";
import { GOOGLE_WEBMASTERS_SCOPE } from "./constants.js";
import type { AppConfig } from "./config.js";
import type { AccountStore } from "./accountStore.js";
import { createOAuthState, verifyOAuthState } from "./oauthState.js";
import { createSupabasePublic } from "./supabaseClient.js";

type SessionPayload = {
  state: string;
  access_token?: string;
  refresh_token?: string;
  provider_token?: string;
  provider_refresh_token?: string;
};

export function createAuthRouter(config: AppConfig, accountStore: AccountStore): Router {
  const router = express.Router();

  router.get("/google/start", async (req: Request, res: Response) => {
    const subscriberId = String(req.query.subscriber_id ?? "").trim();
    if (!subscriberId) {
      res.status(400).json({ error: "Missing subscriber_id" });
      return;
    }

    const state = createOAuthState(subscriberId, config.OAUTH_STATE_SECRET);
    const redirectTo = new URL("/auth/google/complete", config.SUPABASE_URL);
    redirectTo.searchParams.set("state", state);

    const supabase = createSupabasePublic(config);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        scopes: GOOGLE_WEBMASTERS_SCOPE,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        },
        skipBrowserRedirect: true
      }
    });

    if (error || !data.url) {
      res.status(500).json({ error: error?.message ?? "Failed to create Supabase OAuth URL" });
      return;
    }

    res.redirect(data.url);
  });

  router.get("/google/complete", (req: Request, res: Response) => {
    const state = String(req.query.state ?? "");
    if (!state) {
      res.status(400).send("Missing OAuth state.");
      return;
    }

    res.type("html").send(renderCompletionPage(state));
  });

  router.post("/google/session", express.json({ limit: "128kb" }), async (req: Request, res: Response) => {
    const payload = req.body as SessionPayload;
    const state = payload.state;
    const providerRefreshToken = payload.provider_refresh_token;

    if (!state || !providerRefreshToken) {
      res.status(400).json({ error: "Missing state or provider_refresh_token" });
      return;
    }

    const verifiedState = verifyOAuthState(state, config.OAUTH_STATE_SECRET);
    const profile = await fetchGoogleProfile(payload.provider_token);

    await accountStore.upsertAccount({
      subscriberId: verifiedState.subscriberId,
      googleUserId: profile.sub,
      googleEmail: profile.email,
      providerRefreshToken,
      scopes: [GOOGLE_WEBMASTERS_SCOPE]
    });

    res.json({
      connected: true,
      googleEmail: profile.email
    });
  });

  return router;
}

async function fetchGoogleProfile(providerToken?: string): Promise<{ sub?: string; email?: string }> {
  if (!providerToken) {
    return {};
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: providerToken });
  const oauth2 = google.oauth2({ version: "v2", auth });
  const response = await oauth2.userinfo.get();

  return {
    sub: response.data.id ?? undefined,
    email: response.data.email ?? undefined
  };
}

function renderCompletionPage(state: string): string {
  const escapedState = JSON.stringify(state);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Google Search Console connected</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;display:grid;min-height:100vh;place-items:center;background:#f7f7f5;color:#202124}
    main{max-width:34rem;padding:2rem}
    h1{font-size:1.5rem;margin:0 0 .75rem}
    p{line-height:1.5}
  </style>
</head>
<body>
  <main>
    <h1>Connecting Google Search Console...</h1>
    <p id="status">Finishing the secure connection.</p>
  </main>
  <script>
    const state = ${escapedState};
    const statusEl = document.getElementById("status");
    const params = new URLSearchParams(window.location.hash.slice(1));
    const payload = Object.fromEntries(params.entries());
    payload.state = state;

    fetch("/auth/google/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (response) => {
      if (!response.ok) throw new Error(await response.text());
      statusEl.textContent = "Connected. You can close this tab and return to your MCP client.";
      history.replaceState(null, "", window.location.pathname);
    }).catch((error) => {
      statusEl.textContent = "Connection failed: " + error.message;
    });
  </script>
</body>
</html>`;
}
