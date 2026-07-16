import topicsData from "../data/topics.json";

export interface Topic {
  id: string;
  label: string;
  keywords: string[];
}

export const topics: Topic[] = topicsData as Topic[];

export const topicsById: Record<string, Topic> = Object.fromEntries(
  topics.map((t) => [t.id, t]),
);

export function getTopic(id: string): Topic | undefined {
  return topicsById[id];
}
