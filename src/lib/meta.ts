// Integración con Meta Marketing API — OAuth + fetch de insights.
// Requiere que hayas creado una App en developers.facebook.com y que Meta
// haya aprobado el permiso `ads_read` para tu Business Manager (ver README).

const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const META_API_VERSION = "v21.0";
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/integrations/meta/callback`;

export function getMetaAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: "ads_read,business_management",
    state,
  });
  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCode(code: string) {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta OAuth exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in?: number }>;
}

export async function fetchMetaAdAccounts(accessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name,account_id&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error(`Meta ad accounts fetch failed: ${res.status}`);
  const data = await res.json();
  return data.data as { id: string; name: string; account_id: string }[];
}

// Trae insights diarios de una cuenta — esto es lo que puebla AdMetricRaw.
// Todos los campos de §18 de la arquitectura están disponibles en `fields`.
export async function fetchMetaInsights(adAccountId: string, accessToken: string, since: string, until: string) {
  const fields = [
    "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
    "spend", "impressions", "reach", "frequency", "cpm", "clicks", "inline_link_clicks",
    "ctr", "cpc", "video_play_actions", "actions", "action_values",
  ].join(",");

  const params = new URLSearchParams({
    fields,
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    level: "ad",
    access_token: accessToken,
  });

  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta insights fetch failed: ${res.status}`);
  const data = await res.json();
  return data.data as Record<string, unknown>[]; // payload crudo → se guarda tal cual en AdMetricRaw
}
