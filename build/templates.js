// ページのHTMLテンプレート。元サイトの index.html / article.html のヘッダー・フッター構成を
// 日記ブログ向けにまとめ直したもの。すべて文字列を返す関数なので、ビルド時にそのまま書き出せる。

const { esc } = require("./render-body");

function createTemplates(config) {
  const base = config.basePath.endsWith("/") ? config.basePath : `${config.basePath}/`;
  const url = (p = "") => `${base}${String(p).replace(/^\/+/, "")}`;
  const absUrl = (p = "") => `${config.siteUrl}${url(p)}`;

  const seriesConfig = config.series || {};
  const social = config.social || {};
  const xId = String(social.x || "").replace(/^@/, "").trim();
  const noteId = String(social.note || "").trim();
  const xUrl = xId ? `https://x.com/${encodeURIComponent(xId)}` : "";
  const noteUrl = noteId ? `https://note.com/${encodeURIComponent(noteId)}` : "";

  const guidesConfig = config.guides || {};
  const blogPath = "blog/";
  const guideRootPath = "guide/";
  const gamePath = (gameSlug) => `guide/${gameSlug}/`;
  const guidePath = (guide) => `guide/${guide.gameSlug}/${guide.slug}/`;
  const gameInfo = (game) => guidesConfig[game] || {};
  const gameTitle = (game) => gameInfo(game).name || `${game}の攻略`;

  const articlePath = (article) => `articles/${article.slug}/`;
  const tagPath = (tag) => `tags/${encodeURIComponent(tag)}/`;
  const seriesPath = (name) => {
    const slug = seriesConfig[name] && seriesConfig[name].slug;
    return `series/${slug ? slug : encodeURIComponent(name)}/`;
  };

  function formatDate(raw) {
    const date = new Date(raw);
    if (!raw || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tokyo",
    }).format(date);
  }

  function isoDate(raw) {
    const date = new Date(raw);
    return !raw || Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  // ---------- 共通パーツ ----------

  function analyticsTags() {
    let html = "";
    if (config.gaId) {
      html += `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(config.gaId)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${esc(config.gaId)}');
    </script>`;
    }
    if (config.adsenseClient) {
      html += `
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.adsenseClient)}" crossorigin="anonymous"></script>`;
    }
    return html;
  }

  function header() {
    return `
    <header class="site-header">
      <a class="site-title" href="${url()}">${esc(config.siteName)}</a>
      <nav class="site-nav" aria-label="サイト内">
        ${config.hasGuides ? `<a href="${url(guideRootPath)}">攻略</a>` : ""}
        <a href="${url(blogPath)}">ブログ</a>
        <a href="${url("about/")}">このブログについて</a>
      </nav>
    </header>`;
  }

  function footer() {
    const year = new Date().getFullYear();
    return `
    <footer class="site-footer">
      ${
        xUrl || noteUrl
          ? `<nav class="footer-social" aria-label="SNS">
        ${xUrl ? `<a href="${xUrl}" target="_blank" rel="noopener me">X（@${esc(xId)}）</a>` : ""}
        ${noteUrl ? `<a href="${noteUrl}" target="_blank" rel="noopener me">note</a>` : ""}
      </nav>`
          : ""
      }
      <nav class="footer-links" aria-label="サイト情報">
        <a href="${url("about/")}">このブログについて</a>
        <a href="${url("privacy/")}">プライバシーポリシー</a>
        <a href="${url("contact/")}">お問い合わせ</a>
      </nav>
      <p class="footer-note">ゲームのプレイ日記はファンによる非公式の記録です。ドラゴンクエストは株式会社スクウェア・エニックスの登録商標です。</p>
      <p class="footer-copy">© ${year} ${esc(config.siteName)}</p>
    </footer>`;
  }

  function layout({
    title,
    description,
    path,
    ogImage,
    ogType = "website",
    content,
    scripts = [],
    externalScripts = [],
    noindex = false,
  }) {
    const fullTitle = title ? `${title}｜${config.siteName}` : config.siteName;
    const desc = description || config.description;
    // 記事の画像がなければ、サイト共通のリンク画像（src/assets/ogp.png）を使う
    const imagePath = ogImage || (config.defaultOgImage ? url(config.defaultOgImage) : "");
    const image = imagePath ? `${config.siteUrl}${imagePath}` : "";
    const scriptTags = [
      ...scripts.map((s) => `<script src="${url(s)}" defer></script>`),
      ...externalScripts.map((s) => `<script src="${esc(s)}" defer></script>`),
    ].join("\n    ");

    return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(fullTitle)}</title>
    <meta name="description" content="${esc(desc)}" />
    ${noindex ? '<meta name="robots" content="noindex" />' : `<meta name="robots" content="max-image-preview:large" />\n    <link rel="canonical" href="${esc(absUrl(path))}" />`}
    <link rel="alternate" type="application/rss+xml" title="${esc(config.siteName)}" href="${esc(absUrl("feed.xml"))}" />
    <meta property="og:site_name" content="${esc(config.siteName)}" />
    <meta property="og:title" content="${esc(fullTitle)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${esc(absUrl(path))}" />
    ${image ? `<meta property="og:image" content="${esc(image)}" />\n    <meta name="twitter:card" content="summary_large_image" />` : '<meta name="twitter:card" content="summary" />'}
    ${xId ? `<meta name="twitter:site" content="@${esc(xId)}" />` : ""}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${url("assets/style.css")}" />
    ${
      config.iconImage
        ? [
            `<link rel="icon" href="${url("favicon.ico")}" sizes="48x48" />`,
            `<link rel="icon" type="image/png" sizes="96x96" href="${url("assets/icon-96.png")}" />`,
            `<link rel="icon" type="image/png" sizes="192x192" href="${url("assets/icon-192.png")}" />`,
            `<link rel="apple-touch-icon" sizes="180x180" href="${url("assets/apple-touch-icon.png")}" />`,
          ].join("\n    ")
        : '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🗡️</text></svg>" />'
    }
    ${analyticsTags()}
    ${scriptTags}
  </head>
  <body>
    <a class="skip-link" href="#main">本文へ移動</a>
    ${config.preview ? '<p class="preview-strip">手元のプレビューです（下書き・予約中の記事も表示しています）</p>' : ""}
    ${header()}
    <main id="main">
${content}
    </main>
    ${footer()}
  </body>
</html>
`;
  }

  // プレビュー用：非公開・予約中の記事の目印
  function statusLabel(article) {
    if (!config.preview) return "";
    if (article.status === "draft") return "下書き（非公開）";
    if (article.status === "scheduled") return `予約中（${formatDate(article.publishedAt)}に公開）`;
    return "";
  }

  // 「12日目」。日目のない記事は空文字。
  function dayLabel(article) {
    return article.day !== null && article.day !== undefined ? `${article.day}日目` : "";
  }

  // 「マイクラDQM6編 12日目」のように、シリーズ名と日目をつなげたもの。
  function fullLabel(article) {
    return [article.series, dayLabel(article)].filter(Boolean).join(" ");
  }

  // 「マイクラDQM6編 12日目「タイトル」」。ラベルがなければタイトルだけ。
  function labeledTitle(article) {
    const label = fullLabel(article);
    return label ? `${label}「${article.title}」` : article.title;
  }

  function tagLinks(tags) {
    if (!tags || !tags.length) return "";
    return `<ul class="tag-list">${tags
      .map((t) => `<li><a href="${url(tagPath(t))}">${esc(t)}</a></li>`)
      .join("")}</ul>`;
  }

  // ---------- 一覧 ----------

  function entryItem(article, showSeries = true) {
    const img = article.topImage || (article.gallery && article.gallery[0]);
    const thumb = img
      ? `<img src="${esc(img.thumb)}" width="${img.thumbWidth}" height="${img.thumbHeight}" alt="" loading="lazy" decoding="async" />`
      : `<span class="entry-thumb-empty" aria-hidden="true">${esc(dayLabel(article) || config.siteName)}</span>`;

    const day = dayLabel(article);
    const meta =
      showSeries && article.series
        ? `<span class="entry-series">${esc(article.series)}</span>`
        : "";

    return `
        <li class="entry" data-slug="${esc(article.slug)}">
          <a class="entry-link" href="${url(articlePath(article))}">
            <span class="entry-thumb">${thumb}</span>
            <span class="entry-text">
              ${day || meta || statusLabel(article) ? `<span class="entry-labels">${day ? `<span class="entry-day">${esc(day)}</span>` : ""}${meta}${statusLabel(article) ? `<span class="preview-badge">${esc(statusLabel(article))}</span>` : ""}</span>` : ""}
              <span class="entry-title">${esc(article.title)}</span>
              ${article.excerpt ? `<span class="entry-excerpt">${esc(article.excerpt)}</span>` : ""}
              <time class="entry-date" datetime="${isoDate(article.publishedAt)}">${formatDate(article.publishedAt)}</time>
            </span>
          </a>
        </li>`;
  }

  function entryList(articles, { showSeries = true, id = "entry-list" } = {}) {
    return `<ol class="entry-list" id="${id}">${articles.map((a) => entryItem(a, showSeries)).join("")}
      </ol>`;
  }

  function dateValue(raw) {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? 0 : t;
  }

  // ---------- 攻略の一覧パーツ ----------

  function guideCard(g) {
    const img = g.topImage || (g.gallery && g.gallery[0]);
    const thumb = img
      ? `<img src="${esc(img.thumb)}" width="${img.thumbWidth}" height="${img.thumbHeight}" alt="" loading="lazy" decoding="async" />`
      : `<span class="guide-thumb-empty" aria-hidden="true">${esc(g.category || g.game)}</span>`;
    return `
          <li class="guide-card">
            <a class="guide-card-link" href="${url(guidePath(g))}">
              <span class="guide-card-thumb">${thumb}</span>
              <span class="guide-card-text">
                ${g.category ? `<span class="guide-category">${esc(g.category)}</span>` : ""}
                ${statusLabel(g) ? `<span class="preview-badge">${esc(statusLabel(g))}</span>` : ""}
                <span class="guide-card-title">${esc(g.title)}</span>
                <span class="guide-card-date">更新：${formatDate(g.updatedAt)}</span>
              </span>
            </a>
          </li>`;
  }

  function guideCardList(guides) {
    return `<ul class="guide-cards">${guides.map(guideCard).join("")}
        </ul>`;
  }

  function guideRow(g) {
    return `
          <li class="guide-row">
            <a href="${url(guidePath(g))}">
              <span class="guide-row-title">${esc(g.title)}</span>
              ${statusLabel(g) ? `<span class="preview-badge">${esc(statusLabel(g))}</span>` : ""}
              ${g.excerpt ? `<span class="guide-row-excerpt">${esc(g.excerpt)}</span>` : ""}
            </a>
          </li>`;
  }

  // シリーズごとの「さいしん」「はじめから読む」の案内（トップとブログ一覧で使う）
  function seriesIntro(seriesList) {
    return seriesList
      .map((s) => {
        const latest = s.articles[s.articles.length - 1];
        const first = s.articles[0];
        return `
          <div class="intro-series">
            <p class="intro-series-name"><a href="${url(seriesPath(s.name))}">${esc(s.name)}</a></p>
            <p>さいしん：<a href="${url(articlePath(latest))}">${esc(labeledTitle({ ...latest, series: "" }))}</a></p>
            ${s.articles.length > 1 ? `<p><a href="${url(articlePath(first))}">▶ はじめから読む</a></p>` : ""}
          </div>`;
      })
      .join("");
  }

  // サイトのトップ：攻略とブログの入口
  function homePage({ articles, guides, games, seriesList }) {
    const latestPosts = [...articles].reverse().slice(0, 5);

    const guideBlocks = games
      .map((g) => {
        const list = [...g.guides].sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt)).slice(0, 6);
        return `
          <div class="home-game">
            <h3 class="home-game-title"><a href="${url(gamePath(g.slug))}">${esc(gameTitle(g.name))}</a></h3>
            ${guideCardList(list)}
            <p class="more-link"><a href="${url(gamePath(g.slug))}">${esc(g.name)}の攻略をすべて見る ▶</a></p>
          </div>`;
      })
      .join("");

    const content = `
      <section class="intro">
        <div class="msg-window">
          <p>${esc(config.description)}</p>
          ${seriesIntro(seriesList)}
        </div>
      </section>

      ${
        guides.length
          ? `<section class="home-section" aria-labelledby="home-guides">
        <h2 id="home-guides" class="home-section-title">攻略</h2>
        ${guideBlocks}
      </section>`
          : ""
      }

      <section class="home-section" aria-labelledby="home-blog">
        <h2 id="home-blog" class="home-section-title">ブログ</h2>
        ${latestPosts.length ? entryList(latestPosts, { id: "home-list" }) : '<p class="empty">まだ公開された記事はありません。</p>'}
        <p class="more-link"><a href="${url(blogPath)}">ブログの記事をすべて見る ▶</a></p>
      </section>`;

    return layout({ path: "", content });
  }

  // ブログの記事一覧（検索・タグつき）
  function blogIndexPage({ articles, tags, seriesList }) {
    const newestFirst = [...articles].reverse();

    const content = `
      <section class="list-section" aria-labelledby="list-heading">
        <p class="breadcrumb"><a href="${url()}">トップ</a> ／ ブログ</p>
        ${seriesList.length ? `<div class="msg-window blog-intro">${seriesIntro(seriesList)}</div>` : ""}
        <div class="list-head">
          <h1 id="list-heading">ブログ</h1>
          <div class="search">
            <label for="search-input">記事をさがす</label>
            <input id="search-input" type="search" placeholder="モンスター名・アイテム名など" autocomplete="off" />
          </div>
        </div>
        ${tags.length ? `<nav class="tag-nav" aria-label="タグ">${tagLinks(tags.map((t) => t.name))}</nav>` : ""}
        <p class="search-status" id="search-status" aria-live="polite"></p>
        ${articles.length ? entryList(newestFirst) : '<p class="empty">まだ公開された記事はありません。Airtableで visible にチェックを入れると、次のビルドでここに並びます。</p>'}
      </section>`;

    return layout({
      title: "ブログ",
      description: `${config.siteName}のプレイ日記・ブログの記事一覧です。`,
      path: blogPath,
      content,
      scripts: ["assets/search.js"],
    });
  }

  // シリーズページ：連載なので1日目から順番に並べる
  function seriesPage({ name, articles }) {
    const info = seriesConfig[name] || {};
    const first = articles[0];
    const latest = articles[articles.length - 1];

    const content = `
      <section class="list-section">
        <p class="breadcrumb"><a href="${url()}">トップ</a> ／ <a href="${url(blogPath)}">ブログ</a> ／ シリーズ</p>
        <div class="series-head msg-window">
          <h1 class="series-title">${esc(name)}</h1>
          ${info.description ? `<p>${esc(info.description)}</p>` : ""}
          <p class="series-links">
            <a href="${url(articlePath(first))}">▶ はじめから読む</a>
            ${articles.length > 1 ? `<a href="${url(articlePath(latest))}">▶ さいしんの日記へ</a>` : ""}
          </p>
        </div>
        <p class="series-count">${articles.length}件の日記</p>
        ${entryList(articles, { showSeries: false })}
      </section>`;

    return layout({
      title: name,
      description: info.description || `${config.siteName}の連載「${name}」の記事一覧です。`,
      path: seriesPath(name),
      content,
    });
  }

  function tagPage({ tag, articles }) {
    const content = `
      <section class="list-section">
        <p class="breadcrumb"><a href="${url()}">トップ</a> ／ <a href="${url(blogPath)}">ブログ</a> ／ タグ</p>
        <h1>「${esc(tag)}」の記事 <span class="count">${articles.length}件</span></h1>
        ${entryList([...articles].reverse())}
      </section>`;
    return layout({
      title: `「${tag}」の記事`,
      description: `${config.siteName}の「${tag}」に関する記事の一覧です。`,
      path: tagPath(tag),
      content,
    });
  }

  // ---------- 記事 ----------

  function pagerLink(article, rel, label) {
    if (!article) return `<span class="pager-empty"></span>`;
    const day = dayLabel(article);
    return `<a class="pager-link pager-${rel}" rel="${rel}" href="${url(articlePath(article))}">
            <span class="pager-label">${label}</span>
            <span class="pager-title">${day ? `${esc(day)}「${esc(article.title)}」` : esc(article.title)}</span>
          </a>`;
  }

  // いいねボタン（APIのURLが設定されているときだけ）
  function likeButton(article, apiId = article.slug) {
    if (!config.blogApi) return "";
    return `
        <div class="reactions">
          <button type="button" class="like-button" data-api="${esc(config.blogApi)}" data-slug="${esc(apiId)}" aria-pressed="false" disabled>
            <span class="like-heart" aria-hidden="true">♥</span>
            <span class="like-label">いいね</span>
            <span class="like-count" aria-live="polite"></span>
          </button>
          <p class="like-message" role="status"></p>
        </div>`;
  }

  // 記事の最後の「Xでお知らせしています」の案内（XのIDが設定されているときだけ）
  function followBox(article, { what, title, path } = {}) {
    if (!xUrl) return "";
    what = what || (article.series ? `${article.series}の続き` : "新しい記事");
    const shareText = encodeURIComponent(`${title || labeledTitle(article)}｜${config.siteName}`);
    const shareUrl = encodeURIComponent(absUrl(path || articlePath(article)));
    return `
        <aside class="follow-box" aria-label="Xでのお知らせ">
          <p class="follow-text">${esc(what)}は、Xでお知らせしています。</p>
          <p class="follow-links">
            <a class="follow-link" href="${xUrl}" target="_blank" rel="noopener">▶ @${esc(xId)} をフォロー</a>
            <a class="follow-link" href="https://x.com/intent/post?text=${shareText}&amp;url=${shareUrl}" target="_blank" rel="noopener">▶ この記事をXでシェア</a>
          </p>
        </aside>`;
  }

  // コメント欄（APIのURLが設定されているときだけ）。表示と投稿は assets/comments.js が行う
  function commentSection(article, apiId = article.slug) {
    if (!config.blogApi || config.comments === false) return "";
    return `
        <section class="comments" id="comments" aria-labelledby="comments-heading" data-api="${esc(config.blogApi)}" data-slug="${esc(apiId)}">
          <h2 id="comments-heading">コメント</h2>
          <div class="comment-list" aria-live="polite"><p class="comment-empty">コメントを読み込んでいます…</p></div>

          <form class="comment-form" novalidate>
            <h3 class="comment-form-title">コメントを書く</h3>
            <p class="comment-replying" hidden>
              <span class="comment-replying-text"></span>
              <button type="button" class="comment-reply-cancel">返信をやめる</button>
            </p>
            <p class="comments-note">コメントは確認してから表示します。本名・住所・学校名など、だれかが特定できることは書かないでください。</p>
            <label class="comment-field">
              <span>名前（ニックネーム）</span>
              <input name="name" type="text" maxlength="30" autocomplete="nickname" required />
            </label>
            <label class="comment-field">
              <span>コメント</span>
              <textarea name="body" rows="5" maxlength="1000" required></textarea>
            </label>
            <div class="comment-hp" aria-hidden="true">
              <label>この欄は空のままにしてください <input name="website" type="text" tabindex="-1" autocomplete="off" /></label>
            </div>
            <button type="submit" class="comment-submit">コメントを送る</button>
            <p class="comment-status" role="status"></p>
          </form>
        </section>`;
  }

  // 同じシリーズの前後の記事へのリンク（コメント欄の上に置く）
  function pager(article, prev, next) {
    if (!prev && !next) return "";
    const seriesLink = article.series
      ? `<p class="pager-series"><a href="${url(seriesPath(article.series))}">${esc(article.series)}の日記一覧を見る</a></p>`
      : "";
    return `
        <nav class="pager-wrap" aria-label="前後の記事">
          <div class="pager">
            ${pagerLink(prev, "prev", article.series ? "◀ まえの日" : "◀ まえの記事")}
            ${pagerLink(next, "next", article.series ? "つぎの日 ▶" : "つぎの記事 ▶")}
          </div>
          ${seriesLink}
        </nav>`;
  }

  // 日記の最後に出す「この日記に関係する攻略」
  function relatedGuides(guides) {
    if (!guides || !guides.length) return "";
    return `
        <aside class="related-box" aria-labelledby="related-guides">
          <h2 id="related-guides" class="related-title">この日記に関係する攻略</h2>
          <ul class="related-list">${guides.map((g) => `<li><a href="${url(guidePath(g))}">${esc(g.title)}</a></li>`).join("")}</ul>
        </aside>`;
  }

  // 攻略の最後に出す「この攻略が出てくる日記」
  function relatedArticles(articles) {
    if (!articles || !articles.length) return "";
    return `
        <aside class="related-box" aria-labelledby="related-articles">
          <h2 id="related-articles" class="related-title">実際に遊んだ日記</h2>
          <ul class="related-list">${articles.map((a) => `<li><a href="${url(articlePath(a))}">${esc(labeledTitle(a))}</a></li>`).join("")}</ul>
        </aside>`;
  }

  // ---------- 攻略ページ ----------

  // 攻略トップ（ゲームの一覧）
  function guideTopPage({ games }) {
    const content = `
      <section class="list-section">
        <p class="breadcrumb"><a href="${url()}">トップ</a> ／ 攻略</p>
        <h1>攻略</h1>
        <p class="lead">実際に遊んで、つまずいたところやわかったことをまとめた攻略です。</p>
        ${games
          .map(
            (g) => `
        <section class="game-block">
          <h2 class="game-block-title"><a href="${url(gamePath(g.slug))}">${esc(gameTitle(g.name))}</a></h2>
          ${gameInfo(g.name).description ? `<p class="game-block-desc">${esc(gameInfo(g.name).description)}</p>` : ""}
          <p class="more-link"><a href="${url(gamePath(g.slug))}">攻略記事 ${g.guides.length}件を見る ▶</a></p>
        </section>`
          )
          .join("")}
      </section>`;
    return layout({
      title: "攻略",
      description: `${config.siteName}のゲーム攻略の一覧です。`,
      path: guideRootPath,
      content,
    });
  }

  // ゲームごとの攻略トップ（カテゴリごとに並べる）
  function gamePage({ game }) {
    const info = gameInfo(game.name);
    const order = info.categories || [];
    const byCategory = new Map();
    for (const g of game.guides) {
      const key = g.category || "その他";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(g);
    }
    const categories = [...byCategory.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    const recent = [...game.guides].sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt)).slice(0, 4);

    const content = `
      <section class="list-section">
        <p class="breadcrumb"><a href="${url()}">トップ</a> ／ <a href="${url(guideRootPath)}">攻略</a> ／ ${esc(game.name)}</p>
        <div class="msg-window game-head">
          <h1 class="game-title">${esc(gameTitle(game.name))}</h1>
          ${info.description ? `<p>${esc(info.description)}</p>` : ""}
        </div>

        <h2 class="guide-section-title">最近更新された攻略</h2>
        ${guideCardList(recent)}

        ${
          categories.length > 1
            ? `<nav class="category-nav" aria-label="カテゴリ"><ul class="tag-list">${categories
                .map((c, i) => `<li><a href="#cat-${i + 1}">${esc(c)}</a></li>`)
                .join("")}</ul></nav>`
            : ""
        }
        ${categories
          .map(
            (c, i) => `
        <section class="guide-category-block" id="cat-${i + 1}">
          <h2 class="guide-section-title">${esc(c)}</h2>
          <ul class="guide-rows">${byCategory.get(c).map(guideRow).join("")}
          </ul>
        </section>`
          )
          .join("")}
      </section>`;

    return layout({
      title: gameTitle(game.name),
      description: info.description || `${game.name}の攻略記事の一覧です。`,
      path: gamePath(game.slug),
      content,
    });
  }

  // 攻略記事
  function guidePage({ guide, bodyHtml, tocHtml, galleryHtml, sameCategory }) {
    const meta = [
      `<span>最終更新：<time datetime="${isoDate(guide.updatedAt)}">${formatDate(guide.updatedAt)}</time></span>`,
      guide.version ? `<span>対応バージョン：${esc(guide.version)}</span>` : "",
    ]
      .filter(Boolean)
      .join("");

    const others = (sameCategory || []).filter((g) => g !== guide).slice(0, 8);

    const content = `
      <article class="article guide">
        ${statusLabel(guide) ? `<p class="preview-banner">${esc(statusLabel(guide))}：この攻略はまだ公開されていません。</p>` : ""}
        <p class="breadcrumb"><a href="${url()}">トップ</a> ／ <a href="${url(guideRootPath)}">攻略</a> ／ <a href="${url(gamePath(guide.gameSlug))}">${esc(guide.game)}</a>${guide.category ? ` ／ ${esc(guide.category)}` : ""}</p>
        <header class="guide-header">
          ${guide.category ? `<p class="guide-category">${esc(guide.category)}</p>` : ""}
          <h1 class="guide-title">${esc(guide.title)}</h1>
          <p class="guide-meta">${meta}</p>
          ${guide.excerpt ? `<p class="guide-lead">${esc(guide.excerpt)}</p>` : ""}
        </header>
        ${tocHtml}
        <div class="body">
${bodyHtml || '<p class="empty">本文がまだありません。Airtableの body 列に書くとここに表示されます。</p>'}
        </div>
        ${galleryHtml}
        ${relatedArticles(guide.relatedArticles)}
        ${
          others.length
            ? `<aside class="related-box" aria-labelledby="same-category">
          <h2 id="same-category" class="related-title">${esc(guide.category || guide.game)}のほかの攻略</h2>
          <ul class="related-list">${others.map((g) => `<li><a href="${url(guidePath(g))}">${esc(g.title)}</a></li>`).join("")}</ul>
        </aside>`
            : ""
        }
        ${likeButton(guide, guide.apiId)}
        ${followBox(guide, { what: "新しい攻略", title: guide.title, path: guidePath(guide) })}
        ${commentSection(guide, guide.apiId)}
      </article>`;

    return layout({
      title: `${guide.title}【${guide.game}】`,
      description: guide.excerpt,
      path: guidePath(guide),
      ogImage: guide.topImage ? guide.topImage.src : guide.gallery[0] && guide.gallery[0].src,
      ogType: "article",
      content,
      scripts: [
        "assets/caption.js",
        ...(config.blogApi ? ["assets/likes.js"] : []),
        ...(config.blogApi && config.comments !== false ? ["assets/comments.js"] : []),
      ],
    });
  }

  function articlePage({ article, bodyHtml, tocHtml, galleryHtml, prev, next }) {
    // top image は記事ページには出さず、一覧のサムネイルとリンク画像（OGP）にだけ使う

    const meta = [
      `<time datetime="${isoDate(article.publishedAt)}">${formatDate(article.publishedAt)}</time>`,
      article.modVersion
        ? `<span>${esc((seriesConfig[article.series] || {}).versionLabel || "Ver.")} ${esc(article.modVersion)}</span>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const content = `
      <article class="article">
        ${statusLabel(article) ? `<p class="preview-banner">${esc(statusLabel(article))}：この記事はまだ公開されていません。</p>` : ""}
        <header class="article-header msg-window">
          ${fullLabel(article) ? `<p class="article-day">${article.series ? `<a href="${url(seriesPath(article.series))}">${esc(article.series)}</a>` : ""}${dayLabel(article) ? `<span>${esc(dayLabel(article))}</span>` : ""}</p>` : ""}
          <h1 class="article-title">${esc(article.title)}</h1>
          <p class="article-meta">${meta}</p>
        </header>
        ${tagLinks(article.tags)}
        ${tocHtml}
        <div class="body">
${bodyHtml || '<p class="empty">本文がまだありません。Airtableの body 列に書くとここに表示されます。</p>'}
        </div>
        ${galleryHtml}
        ${relatedGuides(article.relatedGuides)}
        ${likeButton(article)}
        ${followBox(article)}
        ${pager(article, prev, next)}
        ${commentSection(article)}
      </article>`;

    return layout({
      title: labeledTitle(article),
      description: article.excerpt,
      path: articlePath(article),
      ogImage: article.topImage ? article.topImage.src : article.gallery[0] && article.gallery[0].src,
      ogType: "article",
      content,
      scripts: [
        "assets/caption.js",
        ...(config.blogApi ? ["assets/likes.js"] : []),
        ...(config.blogApi && config.comments !== false ? ["assets/comments.js"] : []),
      ],
    });
  }

  // ---------- 固定ページ ----------

  function staticPage({ slug, title, html }) {
    const content = `
      <article class="article static-page">
        <h1 class="static-title">${esc(title)}</h1>
        <div class="body">
${html}
        </div>
      </article>`;
    return layout({ title, path: `${slug}/`, content });
  }

  function notFoundPage() {
    const content = `
      <section class="not-found msg-window">
        <p>しかし ページは みつからなかった！</p>
        <p>URLが変わったか、削除された可能性があります。</p>
        <p><a href="${url()}">▶ トップへもどる</a></p>
      </section>`;
    return layout({ title: "ページが見つかりません", path: "404.html", content, noindex: true });
  }

  return {
    homePage,
    blogIndexPage,
    guideTopPage,
    gamePage,
    guidePage,
    gamePath,
    guidePath,
    blogPath,
    guideRootPath,
    seriesPage,
    tagPage,
    articlePage,
    staticPage,
    notFoundPage,
    articlePath,
    labeledTitle,
    tagPath,
    seriesPath,
    url,
    absUrl,
  };
}

module.exports = { createTemplates };
