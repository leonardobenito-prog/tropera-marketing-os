// Integración con Google Ads API — OAuth + fetch de reportes.
// Requiere un Developer Token aprobado por Google (nivel Basic o Standard)
// y un proyecto OAuth en Google Cloud Console (ver README).

const GOOGLE_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`;

export function getGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline", // necesario para obtener refresh_token
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/adwords",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

export async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// Lista las cuentas de Google Ads a las que el usuario autenticado tiene acceso.
export async function listAccessibleGoogleAdsCustomers(accessToken: string) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
  const res = await fetch("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
    headers: { Authorization: `Bearer ${accessToken}`, "developer-token": developerToken },
  });
  if (!res.ok) throw new Error(`Google Ads listAccessibleCustomers failed: ${res.status}`);
  const data = await res.json();
  return (data.resourceNames as string[]).map((rn) => rn.replace("customers/", ""));
}

// GAQL (Google Ads Query Language) — trae las métricas de §19 de la
// arquitectura. Requiere el header developer-token además del OAuth.
export async function fetchGoogleAdsReport(customerId: string, accessToken: string, since: string, until: string) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
  const query = `
    SELECT
      campaign.id, campaign.name, ad_group.id, ad_group.name,
      ad_group_ad.ad.id, ad_group_ad.ad.name,
      segments.date,
      metrics.cost_micros, metrics.impressions, metrics.clicks,
      metrics.ctr, metrics.average_cpc, metrics.conversions,
      metrics.cost_per_conversion, metrics.conversions_value
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${since}' AND '${until}'
  `;

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) throw new Error(`Google Ads report fetch failed: ${res.status}`);
  const data = await res.json();
  return data.results as Record<string, unknown>[]; // payload crudo → AdMetricRaw
}
