import teamsData from "../data/teams.json";

export interface Team {
  id: string;
  league: "AL" | "NL";
  division: string;
  name: string;
  englishName: string;
  short: string;
  keywords: string[];
  mlbSlug: string;
  color: string;
}

export const teams: Team[] = teamsData as Team[];

export const teamsById: Record<string, Team> = Object.fromEntries(
  teams.map((t) => [t.id, t]),
);

export const alTeams = teams.filter((t) => t.league === "AL");
export const nlTeams = teams.filter((t) => t.league === "NL");

export const LEAGUE_LABELS: Record<Team["league"], string> = {
  AL: "アメリカン・リーグ",
  NL: "ナショナル・リーグ",
};

export const DIVISION_LABELS: Record<string, string> = {
  East: "東地区",
  Central: "中地区",
  West: "西地区",
};

export function getTeam(id: string): Team | undefined {
  return teamsById[id];
}

export function leagueLabel(team: Team): string {
  const division = DIVISION_LABELS[team.division] ?? team.division;
  return `${LEAGUE_LABELS[team.league]} ${division}`;
}

// 明るい球団カラー(黄色系など)の上に白文字を乗せると読めなくなるため、
// バッジ・チップの文字色をカラーごとに出し分ける。MLB10球団には該当色が
// 無いが、将来の追加に備えて仕組みだけ残しておく。
const LIGHT_TEAM_COLORS = new Set<string>([]);

export function textOnTeamColor(color: string): string {
  return LIGHT_TEAM_COLORS.has(color) ? "#1b263b" : "#ffffff";
}

// ホワイトソックス(#27251F)のようにほぼ黒に近い球団カラーは、ダークモードの
// 背景と同化して見えなくなるため、色ドット・色スクエアにだけ細いリングを足す。
// (チップのように隣接テキストがある要素は視認性が保たれるので対象外)
export function needsContrastRing(color: string): boolean {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.15;
}
