// scripts/fetch-news.mjs
//
// MLBニュース自動収集スクリプト。
// GitHub Actions から定期実行され、英語圏の信頼できるMLBメディアのRSSを
// 取得 → 日本人メジャーリーガー所属球団・選手・話題タグに分類 → 重複統合
// → Anthropic APIで日本語要約を生成 → 新しい順に並べて src/data/news.json
// に書き出す。
//
// このリポジトリは静的サイト(GitHub Pages)なのでサーバーは動かせない。
// 代わりに「ビルド時点の最新ニュース」をこのJSONに固定し、Astroが静的HTML
// として出力する。定期的にこのスクリプト→ビルド→デプロイを繰り返すことで
// 疑似リアルタイム更新を実現する(Curation NPBと同じアーキテクチャ)。
//
// 収集した記事は「見出し・要約・リンク・出典」のみを保持し、本文は一切
// コピーしない(著作権に配慮し、参照元サイトへ送客する設計)。日本語要約は
// Anthropic APIによる翻訳であり、原文の忠実な翻訳を心がけているが、機械翻訳
// であることに変わりはないため、正確な内容は必ずリンク先の原文を確認すること。

import Parser from "rss-parser";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TEAMS = JSON.parse(
  await readFile(path.join(ROOT, "src/data/teams.json"), "utf-8"),
);
const PLAYERS = JSON.parse(
  await readFile(path.join(ROOT, "src/data/players.json"), "utf-8"),
);
const FEEDS = JSON.parse(
  await readFile(path.join(ROOT, "src/data/feeds.json"), "utf-8"),
);
const TOPICS = JSON.parse(
  await readFile(path.join(ROOT, "src/data/topics.json"), "utf-8"),
);

const OUTPUT_PATH = path.join(ROOT, "src/data/news.json");

// RSSは「今取れる最新N件」しか返さない(=フィード側に過去ログは残っていない)。
// そのため実行のたびに取得結果を過去のnews.jsonへ積み増し(マージ)し、
// 直近RETENTION_DAYS日分をローリングウィンドウとして保持する。
const RETENTION_DAYS = 30;
const MAX_ITEMS = 4000;
const MAX_PER_FEED = 40;
const FETCH_TIMEOUT_MS = 15000;

// タイアップ・スポンサード記事の除外マーカー(広告ゼロ方針のため)
const AD_MARKERS = ["[Sponsored]", "(Sponsored)", "Sponsored Content", "Presented by", "[Partner]"];

function isAdContent(title) {
  const lower = title.toLowerCase();
  return AD_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

// ---- 翻訳(Anthropic API) ----------------------------------------------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = "claude-haiku-4-5";
const TRANSLATE_BATCH_SIZE = 15;
const TRANSLATE_CONCURRENCY = 2;

// 翻訳の表記ゆれを防ぐため、既知の球団名・選手名の対訳表をプロンプトに渡す
const TEAM_GLOSSARY = TEAMS.map((t) => `${t.englishName} = ${t.name}(${t.short})`).join("\n");
const PLAYER_GLOSSARY = PLAYERS.map((p) => `${p.englishName} = ${p.name}`).join("\n");

const TRANSLATE_SYSTEM_PROMPT = `あなたはMLB(メジャーリーグベースボール)専門の翻訳者です。英語のニュース見出し・要約を、日本の野球ファン向けに自然な日本語へ翻訳してください。

ルール:
- 原文にない情報を付け加えたり、憶測で補完したりしないこと(忠実な翻訳のみ)
- 球団名は必ず次の対訳表の表記に統一すること:
${TEAM_GLOSSARY}
- 選手名は必ず次の対訳表の表記に統一すること(対訳表にない選手は一般的なカタカナ表記でよい):
${PLAYER_GLOSSARY}
- 見出しは簡潔に、要約は2文以内を目安にすること
- 要約が空(原文になし)の場合は summary_ja も空文字列にすること
- 必ずsubmit_translationsツールを呼び出して結果を返すこと`;

async function callAnthropicTranslate(batch) {
  const payload = {
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: TRANSLATE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `以下のMLB記事(id, title, summary)を日本語に翻訳してください:\n\n${JSON.stringify(
          batch.map((it) => ({ id: it.id, title: it.title, summary: it.summary })),
        )}`,
      },
    ],
    tools: [
      {
        name: "submit_translations",
        description: "翻訳結果を提出する",
        input_schema: {
          type: "object",
          properties: {
            translations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  title_ja: { type: "string" },
                  summary_ja: { type: "string" },
                },
                required: ["id", "title_ja"],
              },
            },
          },
          required: ["translations"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_translations" },
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const toolUse = (data.content ?? []).find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Anthropic API response had no tool_use block");
  return toolUse.input.translations ?? [];
}

/**
 * 未翻訳の記事をバッチに分けてAnthropic APIへ送り、日本語訳をitemsへ書き戻す。
 * APIキー未設定・API呼び出し失敗時は、翻訳をスキップして英語のまま残す
 * (次回実行時に再試行される。パイプライン全体は止めない)。
 */
async function translateItems(items) {
  if (!ANTHROPIC_API_KEY) {
    console.warn("  ANTHROPIC_API_KEY が未設定のため、日本語翻訳をスキップします(英語のまま掲載)。");
    return;
  }

  const untranslated = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.titleJa);

  if (untranslated.length === 0) return;

  console.log(`  翻訳対象: ${untranslated.length}件`);

  const batches = [];
  for (let i = 0; i < untranslated.length; i += TRANSLATE_BATCH_SIZE) {
    batches.push(untranslated.slice(i, i + TRANSLATE_BATCH_SIZE));
  }

  let done = 0;
  for (let i = 0; i < batches.length; i += TRANSLATE_CONCURRENCY) {
    const group = batches.slice(i, i + TRANSLATE_CONCURRENCY);
    await Promise.all(
      group.map(async (batch) => {
        const withIds = batch.map(({ item }, i2) => ({ ...item, id: i2 }));
        try {
          const translations = await callAnthropicTranslate(withIds);
          for (const t of translations) {
            const target = batch[t.id];
            if (!target) continue;
            target.item.titleJa = t.title_ja || "";
            target.item.summaryJa = t.summary_ja || "";
          }
          done += batch.length;
        } catch (err) {
          console.warn(`  翻訳バッチ失敗(次回再試行): ${err.message}`);
        }
      }),
    );
  }
  console.log(`  翻訳完了: ${done}/${untranslated.length}件`);
}

// ---- 分類ロジック -------------------------------------------------------

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 英語テキストからキーワード群を単語境界つきで(大文字小文字無視)検索する */
function matchesAnyKeyword(text, keywords) {
  return keywords.some((kw) => {
    const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i");
    return re.test(text);
  });
}

function classifyTeams(text) {
  const hits = [];
  for (const team of TEAMS) {
    if (matchesAnyKeyword(text, team.keywords)) hits.push(team.id);
  }
  return hits;
}

function classifyPlayers(text) {
  const hits = [];
  for (const player of PLAYERS) {
    if (matchesAnyKeyword(text, player.nameVariants)) hits.push(player.id);
  }
  return hits;
}

function classifyTopics(text) {
  const hits = [];
  for (const topic of TOPICS) {
    if (matchesAnyKeyword(text, topic.keywords)) hits.push(topic.id);
  }
  return hits;
}

function stripHtml(input) {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max = 200) {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "…";
}

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; CurationMLBBot/1.0; +https://github.com/4getkun/Curation_MLB)",
  },
});

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items = (parsed.items ?? []).slice(0, MAX_PER_FEED);
    const results = [];

    for (const item of items) {
      const title = stripHtml(item.title ?? "");
      const summary = feed.hasSummary
        ? truncate(stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ""))
        : "";
      const link = item.link ?? "";
      if (!title || !link) continue;
      if (isAdContent(title)) continue;

      const haystack = `${title} ${summary}`;

      const players = classifyPlayers(haystack);
      const teamsFromText = classifyTeams(haystack);
      const teamsFromPlayers = players
        .map((pid) => PLAYERS.find((p) => p.id === pid)?.teamId)
        .filter(Boolean);
      // フィード自体が球団専用(feed.teamId)の場合はそれを最優先の球団タグにする
      const teams = [...new Set([feed.teamId, ...teamsFromText, ...teamsFromPlayers].filter(Boolean))];

      const topics = classifyTopics(haystack);
      const pubDate = item.isoDate ?? item.pubDate ?? null;

      results.push({
        title,
        summary,
        titleJa: null,
        summaryJa: null,
        link,
        pubDate,
        source: feed.name,
        sourceId: feed.id,
        teams,
        players,
        topics,
        sources: [{ name: feed.name, sourceId: feed.id, link }],
      });
    }

    console.log(`  取得成功: ${feed.name} (${results.length}件)`);
    return results;
  } catch (err) {
    console.warn(`  取得失敗: ${feed.name} — ${err.message}`);
    return [];
  }
}

async function loadExistingItems() {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function linkKey(link) {
  return link.split("?")[0];
}

// ---- 同一ニュースの重複統合(マルチソース化) ----------------------------
function normalizeTitleForCompare(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleBigrams(text) {
  const set = new Set();
  const words = text.split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    set.add(words[i]);
    if (i < words.length - 1) set.add(`${words[i]} ${words[i + 1]}`);
  }
  return set;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const DEDUPE_TITLE_SIMILARITY = 0.5;
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

function itemSources(item) {
  if (Array.isArray(item.sources) && item.sources.length > 0) return item.sources;
  return [{ name: item.source, sourceId: item.sourceId, link: item.link }];
}

function createUnionFind(size) {
  const parent = Array.from({ length: size }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  return { find, union };
}

function mergeDuplicateGroup(groupItems) {
  if (groupItems.length === 1) {
    const only = groupItems[0];
    return { ...only, sources: itemSources(only) };
  }

  // 要約が一番長い(=情報量が多い)記事を代表記事として採用
  const primary = groupItems.reduce((best, current) =>
    (current.summary?.length ?? 0) > (best.summary?.length ?? 0) ? current : best,
  );
  // 日本語訳が既にある記事を優先(翻訳コストの節約と表示の一貫性のため)
  const translated = groupItems.find((it) => it.titleJa);
  const titleSource = translated ?? primary;

  const dated = groupItems.filter((it) => it.pubDate && !Number.isNaN(new Date(it.pubDate).getTime()));
  const earliestPubDate =
    dated.length > 0
      ? dated.reduce((a, b) => (new Date(a.pubDate) < new Date(b.pubDate) ? a : b)).pubDate
      : (groupItems[0].pubDate ?? null);

  const seenSourceKey = new Set();
  const mergedSources = [];
  for (const it of groupItems) {
    for (const src of itemSources(it)) {
      const key = `${src.sourceId}|${src.link}`;
      if (seenSourceKey.has(key)) continue;
      seenSourceKey.add(key);
      mergedSources.push(src);
    }
  }
  mergedSources.sort((a, b) => {
    const aIsPrimary = a.sourceId === primary.sourceId && a.link === primary.link;
    const bIsPrimary = b.sourceId === primary.sourceId && b.link === primary.link;
    return aIsPrimary === bIsPrimary ? 0 : aIsPrimary ? -1 : 1;
  });

  const primaryTeams = primary.teams ?? [];
  const otherTeams = groupItems.flatMap((it) => it.teams ?? []).filter((t) => !primaryTeams.includes(t));
  const teams = [...primaryTeams, ...new Set(otherTeams)];
  const players = [...new Set(groupItems.flatMap((it) => it.players ?? []))];
  const topics = [...new Set(groupItems.flatMap((it) => it.topics ?? []))];

  return {
    title: primary.title,
    summary: primary.summary,
    titleJa: titleSource.titleJa ?? null,
    summaryJa: titleSource.summaryJa ?? null,
    link: primary.link,
    pubDate: earliestPubDate,
    source: primary.source,
    sourceId: primary.sourceId,
    teams,
    players,
    topics,
    sources: mergedSources,
  };
}

function dedupeSameEventItems(items) {
  const comparable = [];
  const untouched = [];
  items.forEach((item, i) => {
    if (item.pubDate && !Number.isNaN(new Date(item.pubDate).getTime()) && (item.teams?.length ?? 0) > 0) {
      comparable.push(i);
    } else {
      untouched.push(item);
    }
  });

  const uf = createUnionFind(items.length);
  const normalized = items.map((it) => normalizeTitleForCompare(it.title));
  const bigramCache = normalized.map((t) => titleBigrams(t));

  const dayBuckets = new Map();
  for (const i of comparable) {
    const dayKey = new Date(items[i].pubDate).toISOString().slice(0, 10);
    if (!dayBuckets.has(dayKey)) dayBuckets.set(dayKey, []);
    dayBuckets.get(dayKey).push(i);
  }

  for (const bucket of dayBuckets.values()) {
    for (let a = 0; a < bucket.length; a++) {
      for (let b = a + 1; b < bucket.length; b++) {
        const i = bucket[a];
        const j = bucket[b];
        const timeDiff = Math.abs(new Date(items[i].pubDate).getTime() - new Date(items[j].pubDate).getTime());
        if (timeDiff > DEDUPE_WINDOW_MS) continue;

        const teamsOverlap = items[i].teams.some((t) => items[j].teams.includes(t));
        if (!teamsOverlap) continue;

        const similarity = jaccardSimilarity(bigramCache[i], bigramCache[j]);
        if (similarity >= DEDUPE_TITLE_SIMILARITY) uf.union(i, j);
      }
    }
  }

  const groups = new Map();
  for (const i of comparable) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(items[i]);
  }

  const mergedResults = [...groups.values()].map(mergeDuplicateGroup);
  return [...mergedResults, ...untouched];
}

async function main() {
  console.log(`MLBニュース収集を開始します (${FEEDS.length}フィード)`);

  const allResults = (await Promise.all(FEEDS.map((feed) => fetchFeed(feed)))).flat();

  const existingItemsRaw = await loadExistingItems();
  const existingItems = existingItemsRaw.filter((item) => !isAdContent(item.title));
  const removedByRuleUpdate = existingItemsRaw.length - existingItems.length;
  console.log(
    `  既存アーカイブ: ${existingItemsRaw.length}件` +
      (removedByRuleUpdate > 0 ? ` (除外ルール更新により${removedByRuleUpdate}件を除去)` : ""),
  );

  // 新規取得分を優先しつつ、既存アーカイブとリンクで重複排除してマージする。
  // ただし、既に日本語訳済み(titleJaあり)かつ英語タイトルが変わっていない場合は
  // 翻訳結果を引き継ぐ(毎回再翻訳してAPI費用がかさむのを防ぐ)。
  const existingByKey = new Map(existingItems.map((item) => [linkKey(item.link), item]));
  const merged = new Map();
  for (const item of existingItems) {
    merged.set(linkKey(item.link), item);
  }
  for (const item of allResults) {
    const key = linkKey(item.link);
    const prior = existingByKey.get(key);
    if (prior && prior.titleJa && prior.title === item.title) {
      item.titleJa = prior.titleJa;
      item.summaryJa = prior.summaryJa ?? "";
    }
    merged.set(key, item);
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const withinRetention = [...merged.values()].filter((item) => {
    if (!item.pubDate) return true;
    const t = new Date(item.pubDate).getTime();
    return Number.isNaN(t) || t >= cutoff;
  });

  const deduped = dedupeSameEventItems(withinRetention);
  const mergedAwayCount = withinRetention.length - deduped.length;

  await translateItems(deduped);

  deduped.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const trimmed = deduped.slice(0, MAX_ITEMS);
  const prunedByAge = merged.size - withinRetention.length;
  const prunedByCap = deduped.length - trimmed.length;

  const output = {
    generatedAt: new Date().toISOString(),
    count: trimmed.length,
    items: trimmed,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(
    `完了: ${trimmed.length}件を src/data/news.json に書き出しました` +
      `(今回の新規取得 ${allResults.length}件 / ${RETENTION_DAYS}日超で除外 ${prunedByAge}件` +
      `${mergedAwayCount > 0 ? ` / 同一ニュース統合で ${mergedAwayCount}件を集約` : ""}` +
      `${prunedByCap > 0 ? ` / 上限超過で除外 ${prunedByCap}件` : ""})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
