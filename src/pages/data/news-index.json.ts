// クライアントサイド機能(サイト内検索・マイ球団)から fetch() で読み込むための
// 軽量なJSONエンドポイント。ビルド時に静的ファイルとして出力される
// (このリポジトリは output:"static" の静的サイトなので、サーバーは不要)。
import type { APIRoute } from "astro";
import { allNews } from "../../lib/news";

export const prerender = true;

export const GET: APIRoute = () => {
  const items = allNews.map((item) => ({
    title: item.title,
    summary: item.summary,
    titleJa: item.titleJa,
    summaryJa: item.summaryJa,
    link: item.link,
    pubDate: item.pubDate,
    source: item.source,
    teams: item.teams,
    players: item.players ?? [],
    topics: item.topics ?? [],
    sourceCount: item.sources?.length ?? 1,
  }));

  return new Response(JSON.stringify(items), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
