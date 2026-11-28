// リクエスト箱（「次に読みたい記事」を読者から送ってもらう）
//
// コメントとちがって公開しない。ブログ主だけが管理ページで読む。
//
// 読者用（ブログの記事ページから呼ばれる）
//   POST /requests?slug=...   {topic, body, website}
//        slug は送ったページの記事。どの記事を読んだ人の意見かを見るため
//
// 管理用（/admin のページから呼ばれる。Authorization: Bearer <ADMIN_TOKEN> が必要）
//   GET  /admin/api/requests                → 新しい順に200件
//   POST /admin/api/requests/<id>/delete

import { json, hashedIp, readJson, articleExists, loadArticleIndex, cleanText } from "./lib.js";

// 記事ページの選択肢（build/templates.js の REQUEST_TOPICS）と合わせる。ここにないものは「そのほか」にする
const TOPICS = ["マイクラ", "ゼルダ", "ポケモン", "そのほか"];
const BODY_MAX = 500;
const MAX_LINKS = 1;
const LIMIT_SHORT = { count: 3, ms: 10 * 60 * 1000 }; // 10分に3件まで
const LIMIT_DAY = { count: 10, ms: 24 * 60 * 60 * 1000 }; // 1日10件まで

async function notifyDiscord(env, request, req) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  const adminUrl = `${new URL(request.url).origin}/admin`;
  const content = [
    "📮 リクエストが届きました",
    `ジャンル: ${req.topic}`,
    `送ったページ: ${req.slug}`,
    "",
    req.body.length > 300 ? `${req.body.slice(0, 300)}…` : req.body,
    "",
    `管理ページ: ${adminUrl}`,
  ].join("\n");

  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
    });
  } catch {
    // 通知に失敗しても保存には影響させない
  }
}

export async function handlePublicRequests(request, env, ctx, { slug, origin }) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (!origin) return json({ error: "forbidden_origin" }, 403, origin);

  const input = await readJson(request);
  if (!input) return json({ error: "invalid_body" }, 400, origin);

  // 人には見えない入力欄（website）に何か入っていたら、ボットとみなして保存せずに成功のふりをする
  if (String(input.website || "").trim()) return json({ ok: true }, 200, origin);

  const topic = TOPICS.includes(input.topic) ? input.topic : "そのほか";
  const body = cleanText(input.body, BODY_MAX);
  if (!body) return json({ error: "body_required" }, 400, origin);

  const links = (body.match(/https?:\/\//gi) || []).length;
  if (links > MAX_LINKS) return json({ error: "too_many_links" }, 400, origin);

  if (!(await articleExists(slug, env, ctx))) return json({ error: "unknown_article" }, 404, origin);

  // 連投の制限（同じ人＝同じIPのハッシュ。コメントとは別の文字を混ぜて、結びつけられないようにする）
  const author = await hashedIp(request, env, "requests");
  const now = Date.now();
  const [short, day] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE author = ?1 AND created_at > ?2").bind(author, now - LIMIT_SHORT.ms),
    env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE author = ?1 AND created_at > ?2").bind(author, now - LIMIT_DAY.ms),
  ]);
  if (short.results[0].n >= LIMIT_SHORT.count || day.results[0].n >= LIMIT_DAY.count) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  await env.DB.prepare("INSERT INTO requests (slug, topic, body, author, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(slug, topic, body, author, now)
    .run();

  ctx.waitUntil(notifyDiscord(env, request, { slug, topic, body }));
  return json({ ok: true }, 200, origin);
}

// 管理用。isAdmin の確認は comments.js の handleAdminApi で済ませてから呼ぶ
export async function handleAdminRequests(request, env, ctx, path) {
  if (request.method === "GET" && path === "/requests") {
    const { results } = await env.DB.prepare(
      "SELECT id, slug, topic, body, created_at FROM requests ORDER BY created_at DESC LIMIT 200"
    ).all();
    const index = (await loadArticleIndex(env, ctx)) || [];
    const bySlug = new Map(index.map((a) => [a.slug, a]));
    return json({
      siteUrl: env.SITE_URL || "",
      requests: results.map((r) => {
        const a = bySlug.get(r.slug);
        return {
          id: r.id,
          slug: r.slug,
          path: (a && a.path) || `articles/${r.slug}/`,
          title: (a && a.title) || "",
          topic: r.topic,
          body: r.body,
          createdAt: r.created_at,
        };
      }),
    });
  }

  const match = path.match(/^\/requests\/(\d+)\/delete$/);
  if (request.method === "POST" && match) {
    await env.DB.prepare("DELETE FROM requests WHERE id = ?1").bind(Number(match[1])).run();
    return json({ ok: true });
  }

  return null;
}
