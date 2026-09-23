// 検索エンジン向けの構造化データ（JSON-LD）と、その絶対URLを組み立てるヘルパー。
// 公開URLは astro.config.mjs の site + base（例: https://fourgetkun.com/npb-news/）。
import { withBase } from "./url";

export const SITE_NAME = "Curation MLB";

/** サイト内パス（base を含まない。例: "/team/giants/"）を公開側の絶対URLにする */
export function absoluteUrl(path: string): string {
  return new URL(withBase(path), import.meta.env.SITE).toString();
}

/** トップページの WebSite */
export function websiteLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description,
    inLanguage: "ja",
  };
}

/** パンくず。最後の要素は path を省略してよい（今いるページ） */
export function breadcrumb(items: { name: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: absoluteUrl(it.path) } : {}),
    })),
  };
}

/** <script type="application/ld+json"> に安全に埋め込める文字列（</script> で閉じさせない） */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
