import newsData from "../data/news.json";

export interface NewsSource {
  name: string;
  sourceId: string;
  link: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  /** Anthropic APIによる日本語タイトル訳。ANTHROPIC_API_KEY未設定時はnull。 */
  titleJa: string | null;
  /** Anthropic APIによる日本語要約訳。ANTHROPIC_API_KEY未設定時はnull。 */
  summaryJa: string | null;
  link: string;
  pubDate: string | null;
  source: string;
  sourceId: string;
  teams: string[];
  /** 記事に登場する日本人メジャーリーガーのID一覧 */
  players: string[];
  topics: string[];
  /** 同一ニュースを報じている全出典。通常は1件だが、複数メディアが同じ
   *  出来事を報じている場合は統合されて2件以上になる(重複統合機能)。 */
  sources: NewsSource[];
}

export interface NewsData {
  generatedAt: string;
  count: number;
  items: NewsItem[];
}

const data = newsData as NewsData;

export const allNews: NewsItem[] = data.items;
export const newsGeneratedAt: string = data.generatedAt;

export function newsForTeam(teamId: string): NewsItem[] {
  return allNews.filter((item) => item.teams.includes(teamId));
}

export function newsForPlayer(playerId: string): NewsItem[] {
  return allNews.filter((item) => item.players?.includes(playerId));
}

export function newsForTopic(topicId: string): NewsItem[] {
  return allNews.filter((item) => item.topics?.includes(topicId));
}

// titleJa/summaryJa は翻訳未実施(ANTHROPIC_API_KEY未設定など)の場合 null になる。
// その場合は空の日本語タイトルを表示せず、英語の原文にフォールバックする。
export function displayTitle(item: Pick<NewsItem, "title" | "titleJa">): string {
  return item.titleJa && item.titleJa.trim() ? item.titleJa : item.title;
}

export function displaySummary(item: Pick<NewsItem, "summary" | "summaryJa">): string {
  return item.summaryJa && item.summaryJa.trim() ? item.summaryJa : item.summary;
}

export function isTranslated(item: Pick<NewsItem, "titleJa">): boolean {
  return Boolean(item.titleJa && item.titleJa.trim());
}

export function formatRelativeOrDate(pubDate: string | null): string {
  if (!pubDate) return "";
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

// 「18分前」「3時間前」のような相対表記。ビルド時点(=直近の自動更新時点)を
// 基準に計算するため、サイトを見るタイミングによっては多少ずれる場合がある
// (最大でも自動更新の間隔=30分程度)。
export function formatRelative(pubDate: string | null, now: Date): string {
  if (!pubDate) return "";
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;

  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

const generatedAtDate = new Date(newsGeneratedAt);
const relativeBase = Number.isNaN(generatedAtDate.getTime())
  ? new Date()
  : generatedAtDate;

/** ニュース取得時刻(=ほぼビルド時刻)を基準にした相対表記のショートハンド */
export function formatRelativeShort(pubDate: string | null): string {
  return formatRelative(pubDate, relativeBase);
}

export function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}
