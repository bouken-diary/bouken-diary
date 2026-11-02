// GA4 と Search Console の数字をまとめて表示する。
//
// 使い方:
//   npm run report          … 直近7日と、その前の7日をくらべる
//   npm run report -- 28    … 直近28日と、その前の28日をくらべる
//
// 必要なもの（秘密の値はリポジトリに入れない）:
//   ~/.config/bouken-diary/google-key.json  … サービスアカウントの鍵（中身は表示しない）
//   ~/.config/bouken-diary/analytics.json   … {"propertyId": "GA4のプロパティID", "site": "sc-domain:bouken-diary.com"}
//
// 外部のライブラリは使わず、Node の crypto で Google の認証をする。

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const CONFIG_DIR = path.join(os.homedir(), ".config", "bouken-diary");
const KEY_FILE = process.env.GOOGLE_KEY_FILE || path.join(CONFIG_DIR, "google-key.json");
const SETTINGS_FILE = path.join(CONFIG_DIR, "analytics.json");

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

function readJson(file, label) {
  if (!fs.existsSync(file)) {
    console.error(`✗ ${label}がありません: ${file}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// サービスアカウントの鍵で署名して、アクセストークンをもらう。
async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPES.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key.private_key);
  const jwt = `${header}.${claim}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`認証に失敗しました: ${data.error_description || data.error}`);
  return data.access_token;
}

async function post(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${url} → ${res.status} ${data.error ? data.error.message : ""}`);
  return data;
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// 今日はまだ途中なので、昨日までの days 日と、その前の days 日。
function ranges(days) {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return { cur: [ymd(start), ymd(end)], prev: [ymd(prevStart), ymd(prevEnd)] };
}

function change(cur, prev) {
  if (!prev) return cur ? "（前は0）" : "";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `（前の期間 ${prev} → ${pct >= 0 ? "+" : ""}${pct}%）`;
}

async function gaReport(token, propertyId, { cur, prev }) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const metrics = [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }];
  const dateRanges = [
    { startDate: cur[0], endDate: cur[1], name: "cur" },
    { startDate: prev[0], endDate: prev[1], name: "prev" },
  ];

  const total = await post(url, token, { dateRanges, metrics });
  const pick = (name) => {
    const row = (total.rows || []).find((r) => r.dimensionValues[0].value === name);
    return row ? row.metricValues.map((v) => Number(v.value)) : [0, 0, 0];
  };
  const [u, s, v] = pick("cur");
  const [pu, ps, pv] = pick("prev");
  console.log("\n■ ブログ（GA4）");
  console.log(`  訪問者     ${u}人 ${change(u, pu)}`);
  console.log(`  訪問回数   ${s}回 ${change(s, ps)}`);
  console.log(`  表示回数   ${v}回 ${change(v, pv)}`);

  const sources = await post(url, token, {
    dateRanges: [dateRanges[0]],
    dimensions: [{ name: "sessionSourceMedium" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  console.log("\n■ どこから来たか（訪問回数）");
  for (const r of sources.rows || []) console.log(`  ${r.metricValues[0].value.padStart(4)}  ${r.dimensionValues[0].value}`);

  const pages = await post(url, token, {
    dateRanges: [dateRanges[0]],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 10,
  });
  console.log("\n■ よく読まれたページ（表示回数）");
  for (const r of pages.rows || []) console.log(`  ${r.metricValues[0].value.padStart(4)}  ${r.dimensionValues[0].value}`);
}

async function searchReport(token, site, { cur, prev }) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const sum = async ([startDate, endDate]) => {
    const data = await post(url, token, { startDate, endDate });
    const row = (data.rows || [])[0] || { clicks: 0, impressions: 0, position: 0 };
    return row;
  };
  const c = await sum(cur);
  const p = await sum(prev);
  console.log("\n■ Google 検索（Search Console、2〜3日おくれ）");
  console.log(`  表示回数   ${c.impressions}回 ${change(c.impressions, p.impressions)}`);
  console.log(`  クリック   ${c.clicks}回 ${change(c.clicks, p.clicks)}`);
  if (c.impressions) console.log(`  平均順位   ${c.position.toFixed(1)}位`);

  for (const [dim, label] of [["query", "検索された言葉"], ["page", "検索に出たページ"]]) {
    const data = await post(url, token, { startDate: cur[0], endDate: cur[1], dimensions: [dim], rowLimit: 10 });
    console.log(`\n■ ${label}（表示回数・クリック・順位）`);
    for (const r of data.rows || []) {
      const key = dim === "page" ? r.keys[0].replace(/^https?:\/\/[^/]+/, "") : r.keys[0];
      console.log(`  ${String(r.impressions).padStart(4)} ${String(r.clicks).padStart(3)} ${r.position.toFixed(1).padStart(5)}位  ${key}`);
    }
  }
}

async function main() {
  const days = Number(process.argv[2]) || 7;
  const key = readJson(KEY_FILE, "サービスアカウントの鍵");
  const settings = readJson(SETTINGS_FILE, "設定ファイル");
  const r = ranges(days);
  console.log(`期間：${r.cur[0]} 〜 ${r.cur[1]}（${days}日）／くらべる期間：${r.prev[0]} 〜 ${r.prev[1]}`);

  const token = await getAccessToken(key);
  await gaReport(token, settings.propertyId, r);
  await searchReport(token, settings.site || "sc-domain:bouken-diary.com", r);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
