// GitHub Pages のプロジェクトページ(サブパス配信)でもリンクが壊れないように、
// astro.config.mjs の base 設定を踏まえたURLを組み立てるヘルパー。
export function withBase(pathname: string): string {
  const base = import.meta.env.BASE_URL; // 例: "/Curation_MLB/"
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${cleanBase}${cleanPath}`;
}
