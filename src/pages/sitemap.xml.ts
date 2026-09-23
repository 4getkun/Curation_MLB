// サイトマップ。fourgetkun.com の robots.txt から案内される（fourgetkun-hub の build-manifest.js）。
// サイト内検索と 404 は載せない（noindex）。ニュースは 30 分ごとに作り直されるので、
// lastmod はビルドした日にする。
import type { APIRoute } from "astro";
import { teams } from "../lib/teams";
import { topics } from "../lib/topics";
import { players } from "../lib/players";
import { absoluteUrl } from "../lib/seo";

const STATIC_PATHS = ["/", "/news/", "/team/", "/team/general/", "/topic/", "/player/", "/about/"];

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const paths = [
    ...STATIC_PATHS,
    ...teams.map((t) => `/team/${t.id}/`),
    ...topics.map((t) => `/topic/${t.id}/`),
    ...players.map((p) => `/player/${p.id}/`),
  ];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths
      .map((p) => `  <url>\n    <loc>${absoluteUrl(p)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
      .join("\n") +
    "\n</urlset>\n";
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
