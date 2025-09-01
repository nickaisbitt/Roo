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
  res.send(`
    <h1>Roo OAuth Helper</h1>
    <p>This helper will generate a new Spreaker refresh token for your Railway application.</p>
    
    <h2>Before you start:</h2>
    <ol>
      <li>Make sure SPREAKER_CLIENT_ID and SPREAKER_CLIENT_SECRET are set in your Railway environment</li>
      <li>Your Spreaker app redirect URI should match: <strong>${REDIRECT_URI}</strong></li>
    </ol>
    
    <h2>Ready?</h2>
    <p><a href="/oauth/login" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Connect Spreaker & Get New Token</a></p>
    
    <h2>Debug Info:</h2>
    <ul>
      <li>Client ID: ${CLIENT_ID ? '✅ Set' : '❌ Missing'}</li>
      <li>Client Secret: ${CLIENT_SECRET ? '✅ Set' : '❌ Missing'}</li>
      <li>Redirect URI: ${REDIRECT_URI}</li>
    </ul>
  `);
});

app.get("/health", (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      client_id_set: !!CLIENT_ID,
      client_secret_set: !!CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      state: STATE
    }
  });
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
      <h2>✅ Successfully Connected to Spreaker!</h2>
      
      <h3>Next Steps:</h3>
      <ol>
        <li><strong>Copy the refresh token below</strong></li>
        <li><strong>Go to your Railway dashboard</strong></li>
        <li><strong>Update the SPREAKER_REFRESH_TOKEN environment variable</strong></li>
        <li><strong>Redeploy your main service</strong></li>
      </ol>
      
      <h3>Your New Refresh Token:</h3>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all;">
        <strong>SPREAKER_REFRESH_TOKEN=${data.refresh_token}</strong>
      </div>
      
      <p><small>💡 This token will replace your old expired token. The access token is short-lived and will be automatically refreshed by your application.</small></p>
      
      <h3>Alternative: Use Railway CLI</h3>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">railway variables set SPREAKER_REFRESH_TOKEN=${data.refresh_token}</pre>
    `);
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    res.status(500).send("Token exchange failed: " + msg);
  }
});

app.listen(PORT, () => {
  console.log(`OAuth helper listening on port ${PORT}`);
});
