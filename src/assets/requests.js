// 記事の最後の「次に読みたい記事をリクエスト」。送ったものは Cloudflare Worker（blog-api/）に保存する。
// コメントとちがって公開しない。ブログ主が管理ページで読む。
(function () {
  const box = document.querySelector(".request-box");
  if (!box) return;

  const endpoint = `${box.dataset.api}/requests?slug=${encodeURIComponent(box.dataset.slug)}`;
  const form = box.querySelector(".request-form");
  const status = box.querySelector(".request-status");
  const submit = box.querySelector(".request-submit");
  const bodyInput = form.elements.body;

  const ERRORS = {
    body_required: "リクエストを入れてください。",
    too_many_links: "リンク（URL）は1つまでにしてください。",
    rate_limited: "短い時間にたくさん送られています。少し時間をおいてから送ってください。",
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = bodyInput.value.trim();
    if (!body) {
      status.textContent = ERRORS.body_required;
      bodyInput.focus();
      return;
    }

    const checked = form.querySelector('input[name="topic"]:checked');
    submit.disabled = true;
    status.textContent = "送信中…";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: checked ? checked.value : "", body, website: form.elements.website.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || String(res.status));
      bodyInput.value = "";
      status.textContent = "リクエストを受け付けました！ありがとうございます。記事を書くときの参考にします。";
    } catch (e) {
      status.textContent = ERRORS[e.message] || "うまく送れませんでした。時間をおいてもう一度お試しください。";
    } finally {
      submit.disabled = false;
    }
  });
})();
