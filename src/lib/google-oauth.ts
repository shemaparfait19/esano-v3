import { google } from "googleapis";

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const base = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9002"
  ).replace(/\/+$/g, "");
  const redirectUri = `${base}/api/google/oauth/callback`;
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth envs");
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getDriveAuthUrl(state: string) {
  const oauth2Client = getOAuthClient();
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
  ];
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens; // contains access_token, refresh_token
}

export function driveClientWithTokens(tokens: any) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  return google.drive({ version: "v3", auth: oauth2Client });
}
