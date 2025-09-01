// oauth-server.js
import express from "express";
import axios from "axios";
import "dotenv/config.js";

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.SPREAKER_CLIENT_ID;        // e.g. 23074
const CLIENT_SECRET = process.env.SPREAKER_CLIENT_SECRET; // from Spreaker
const REDIRECT_URI = process.env.SPREAKER_REDIRECT_URI    // must match Spreaker app
  || "https://roo-production.up.railway.app/oauth/callback";
const STATE = process.env.OAUTH_STATE || "roo_csrf_state_please_change_me";

app.get("/", (_req, res) => {
  res.send(`<h1>Roo OAuth</h1><p><a href="/oauth/login">Connect Spreaker</a></p>`);
});

app.get("/oauth/login", (_req, res) => {
  // Spreaker Login Dialog (server-side code flow)
  // https://www.spreaker.com/oauth2/authorize?client_id=...&response_type=code&state=...&scope=basic&redirect_uri=...
  const url = new URL("https://www.spreaker.com/oauth2/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", STATE);
  url.searchParams.set("scope", "basic");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  res.redirect(url.toString());
});

app.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Spreaker error: ${error}`);
  if (state !== STATE) return res.status(400).send("State mismatch.");

  try {
    // Exchange code -> tokens
    // POST https://api.spreaker.com/oauth2/token (authorization_code)
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", CLIENT_ID);
    body.set("client_secret", CLIENT_SECRET);
    body.set("redirect_uri", REDIRECT_URI);
    body.set("code", String(code));

    const { data } = await axios.post(
      "https://api.spreaker.com/oauth2/token",
      body.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("Spreaker tokens:", data); // shows access_token + refresh_token

    res.send(`
      <h2>✅ Connected to Spreaker</h2>
      <p>Copy this into your Railway variables <strong>for the main job</strong>:</p>
      <pre>SPREAKER_REFRESH_TOKEN=${data.refresh_token}</pre>
      <p>(You don't need to save the short-lived access token; your job already refreshes it.)</p>
    `);
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    res.status(500).send("Token exchange failed: " + msg);
  }
});

app.listen(PORT, () => {
  console.log(`OAuth helper listening on port ${PORT}`);
});
