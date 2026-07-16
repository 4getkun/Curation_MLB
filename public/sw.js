// MLB Curation - Service Worker
//
// 静的サイト(GitHub Pages)なので、ビルド時にファイル名が変わる
// アセット一覧を事前キャッシュする代わりに、「アクセスした分だけ
// その場でキャッシュする(runtime caching)」方式にしている。
// これによりビルドのたびにこのファイルを更新する必要がなくなる。
//
// 戦略:
//  - ページ遷移(HTML): まずネットワークを試し、失敗したらキャッシュ、
//    それも無ければオフライン用ページを返す。
//  - CSS/JS/JSON/画像などの同一オリジンGET: stale-while-revalidate
//    (キャッシュがあれば即座に返しつつ、裏でネットワーク取得して更新)

const CACHE_NAME = "mlb-curation-v1";
const OFFLINE_URL = "/Curation_MLB/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 外部リンク(配信元記事など)には介入しない

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    ),
  );
});
