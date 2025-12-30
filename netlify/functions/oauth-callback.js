// netlify/functions/oauth-callback.js

const {
  GIT_HOSTNAME = "https://github.com",
  OAUTH_TOKEN_PATH = "/login/oauth/access_token",
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  REDIRECT_URL,
} = process.env;

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const code = params.code;
    const state = params.state;

    if (!code) {
      return { statusCode: 400, body: "Missing ?code in query string" };
    }

    // Optional: validate state against cookie
    const cookieHeader = event.headers.cookie || event.headers.Cookie || "";
    const match = cookieHeader.match(/oauth_state=([^;]+)/);
    if (match && state && match[1] !== state) {
      return { statusCode: 400, body: "Invalid OAuth state" };
    }

    const tokenUrl = new URL(GIT_HOSTNAME);
    tokenUrl.pathname = OAUTH_TOKEN_PATH;

    const body = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      redirect_uri: REDIRECT_URL,
      code,
    });

    const response = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: 500,
        body: `GitHub token request failed: ${text}`,
      };
    }

    const data = await response.json();
    const accessToken = data.access_token;

    if (!accessToken) {
      return {
        statusCode: 500,
        body: "No access_token in GitHub response",
      };
    }

    // What Decap expects: window in popup sends token via postMessage
    const postMsgContent = {
      token: accessToken,
      provider: "github",
    };

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Authentication complete</title>
  </head>
  <body>
    <script>
      (function() {
        function recieveMessage(e) {
          // Send message to the main window where Decap is running
          window.opener.postMessage(
            'authorization:github:success:${JSON.stringify(postMsgContent)}',
            e.origin
          );
          window.removeEventListener("message", recieveMessage, false);
          window.close();
        }
        window.addEventListener("message", recieveMessage, false);
        // Let the main window know we're ready
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>
  </body>
</html>`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: html,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "OAuth callback error" };
  }
};
