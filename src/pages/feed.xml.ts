// このサイト自体が発行するRSSフィード。ユーザーが自分の好きなRSSリーダーで
// 「広告ゼロで整理済みのMLBニュース」を購読できるようにするためのエンドポイント。
// news.json をもとにビルド時に静的なXMLとして出力する(サーバー不要)。
import type { APIRoute } from "astro";
import { allNews, displayTitle, displaySummary } from "../lib/news";

export const prerender = true;

function escapeXml(str: string): string {
  return (str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL ?? "/";
  const origin = site ? site.origin ?? site.toString().replace(/\/$/, "") : "https://4getkun.github.io";
  const siteUrl = `${origin}${base}`.replace(/\/+$/, "");

  const items = allNews.slice(0, 100);
  const itemsXml = items
    .map((item) => {
      const pubDate = item.pubDate && !Number.isNaN(new Date(item.pubDate).getTime())
        ? new Date(item.pubDate).toUTCString()
        : null;
      // titleJa/summaryJa が翻訳済みならそちらを、未翻訳(null)なら英語原文を使う。
      return `
    <item>
      <title>${escapeXml(displayTitle(item))}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ""}
      <description>${escapeXml(displaySummary(item))}</description>
      <source>${escapeXml(item.source)}</source>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Curation MLB</title>
    <link>${siteUrl}/</link>
    <description>広告ゼロで読める、日本人メジャーリーガーの所属球団を中心としたMLB最新ニュース・まとめキュレーションサイト</description>
    <language>ja</language>
    <generator>Curation MLB</generator>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
};
