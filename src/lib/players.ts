import playersData from "../data/players.json";
import { getTeam } from "./teams";

export interface Player {
  id: string;
  name: string;
  englishName: string;
  nameVariants: string[];
  teamId: string;
  mlbDebut: string;
}

export const players: Player[] = playersData as Player[];

export const playersById: Record<string, Player> = Object.fromEntries(
  players.map((p) => [p.id, p]),
);

export function getPlayer(id: string): Player | undefined {
  return playersById[id];
}

export function playersForTeam(teamId: string): Player[] {
  return players.filter((p) => p.teamId === teamId);
}

/** 選手が所属している球団情報も一緒に返す。所属球団未収録の場合は undefined。 */
export function playerTeam(player: Player) {
  return getTeam(player.teamId);
}

export function formatDebut(mlbDebut: string): string {
  const date = new Date(mlbDebut);
  if (Number.isNaN(date.getTime())) return mlbDebut;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
