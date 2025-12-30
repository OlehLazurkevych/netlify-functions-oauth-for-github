// netlify/functions/oauth-start.js
const crypto = require("crypto");

const {
  GIT_HOSTNAME = "https://github.com",
  OAUTH_AUTHORIZE_PATH = "/login/oauth/authorize",
  OAUTH_CLIENT_ID,
  OAUTH_SCOPES = "repo,user",
  REDIRECT_URL,
} = process.env;

exports.handler = async (event) => {
  if (!OAUTH_CLIENT_ID || !REDIRECT_URL) {
    return {
      statusCode: 500,
      body: "Missing OAUTH_CLIENT_ID or REDIRECT_URL env var",
    };
  }

  // CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL(GIT_HOSTNAME);
  url.pathname = OAUTH_AUTHORIZE_PATH;
  url.searchParams.set("client_id", OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URL);
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("state", state);

  return {
    statusCode: 302,
    headers: {
      Location: url.toString(),
      // Keep the state on our domain
      "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    },
  };
};
