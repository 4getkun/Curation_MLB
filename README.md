# Curation MLB

広告ゼロで読める、日本人メジャーリーガーの所属球団を中心としたMLB(メジャーリーグベースボール)ニュース・まとめキュレーションサイトです。
英語圏の信頼できる野球専門メディアのRSSを自動収集し、球団別・選手別・話題別に整理して掲載します。実験的な運営のため、記事は現在すべて英語の原文のまま掲載しています(AI日本語翻訳の仕組みはコードに実装済みですが、既定では無効です。詳細は後述)。
Astro + Tailwind CSS で構築し、GitHub Pages の無料枠だけで完結するように作っています。姉妹サイト「[Curation NPB](https://github.com/4getkun/Curation_NPB)」と同じ設計思想です。

- 公開URL(予定): https://4getkun.github.io/Curation_MLB/
- リポジトリ: https://github.com/4getkun/Curation_MLB

## 特徴

- **広告・トラッキングなし** — バナー広告、アフィリエイト、アクセス解析は一切なし
- **日本人メジャーリーガーを目立つ位置に** — トップページに「日本人メジャーリーガー」セクションを配置し、所属球団・関連ニュース件数を一覧表示。選手ごとの個別ページも自動生成
- **MLBニュースを自動収集** — 英語圏の野球専門メディアのRSSを定期取得し、球団別・選手別に自動振り分け
- **AI日本語翻訳(オプション・既定オフ)** — ANTHROPIC_API_KEYを設定すればAnthropic API(Claude)による見出し・要約の日本語自動翻訳を有効化できる仕組みを実装済み。ただし本サイトは実験運用のため、現時点では無効(記事は英語原文のまま掲載)
- **直近30日分をローリング蓄積** — RSSは「今取れる最新分」しか返さないため、実行のたびに過去データへ積み増し、30日を超えた分だけ捨てるアーカイブ方式
- **GitHub Actionsで自動更新＋自動デプロイ** — 30分ごとにニュースを取得し、そのままビルド・公開まで自動実行
- **記事本文はコピーしない** — 見出し・要約・リンクのみを掲載し、詳細は配信元サイトに送客(著作権に配慮)
- **サイト内検索** — タイトル・要約・球団名・選手名からニュースをクライアントサイドで検索
- **マイ球団(お気に入り)** — 応援球団を選ぶと、トップページにその球団のニュースだけを表示(端末内保存のみ)
- **話題から探す(トピックタグ)** — 「トレード」「故障」「契約」など、球団の枠を超えた話題別の横断閲覧
- **同一ニュースの統合表示** — 複数メディアが同じ出来事を報じている場合、1件にまとめて出典を併記
- **独自RSS配信** — `feed.xml` でこのサイト自体をRSSリーダーから購読可能
- **PWA対応** — ホーム画面への追加・オフライン時の簡易閲覧に対応

## 使用技術

| 用途 | 技術 |
| --- | --- |
| サイト生成 | [Astro](https://astro.build/) 7 (静的サイト出力) |
| スタイリング | [Tailwind CSS](https://tailwindcss.com/) v4 |
| ニュース取得 | Node.js + [rss-parser](https://www.npmjs.com/package/rss-parser) |
| 日本語翻訳 | [Anthropic API](https://docs.claude.com/) (Claude Haiku) |
| ホスティング | GitHub Pages (無料枠) |
| 自動更新・デプロイ | GitHub Actions (無料枠 / スケジュール実行) |

## ニュース取得元

| フィード | 種別 | 補足 |
| --- | --- | --- |
| MLB.com | 総合 | MLB公式ニュース |
| Yahoo Sports MLB | 総合 | ※当初ESPN MLBを予定していましたが、ESPNのRSSはBotアクセスをブロックするWAF(Web Application Firewall)が常時作動しており、GitHub Actions上のNode.jsからは安定して取得できないことを検証で確認したため、同等の総合ニュースソースとしてYahoo Sports MLBに差し替えています |
| CBS Sports MLB | 総合 | |
| MLB Trade Rumors | 総合 | 移籍・契約情報に強い専門メディア |
| MLB.com(球団別) | 球団専門 | 日本人選手所属10球団(アストロズ/カブス/ドジャース/ブルージェイズ/エンゼルス/ロッキーズ/メッツ/パドレス/ホワイトソックス/レッドソックス)分を個別取得 |

## セットアップ手順(GitHubへの公開まで)

### 1. このプロジェクトをリポジトリにpush

```bash
cd curation-mlb
git init   # 既にgit initされている場合は不要
git add .
git commit -m "Initial commit: Curation MLB site"
git branch -M main
git remote add origin https://github.com/4getkun/Curation_MLB.git
git push -u origin main
```

### 2. GitHub PagesをActions経由で公開する設定にする

1. リポジトリの **Settings → Pages** を開く
2. "Build and deployment" の **Source** を **GitHub Actions** に変更する

### 3. Actionsに書き込み権限を与える(ニュース自動コミットに必要)

1. リポジトリの **Settings → Actions → General** を開く
2. "Workflow permissions" を **Read and write permissions** に変更して保存

### 4. (任意・既定オフ)日本語翻訳を有効にする — ANTHROPIC_API_KEYの登録

このAPIキーを登録しなくてもサイトは正常に動作します(見出し・要約が英語のまま掲載されるだけです)。日本語訳を有効にしたい場合のみ設定してください。

1. [Anthropic Console](https://console.anthropic.com/) でAPIキーを発行する
2. リポジトリの **Settings → Secrets and variables → Actions** を開く
3. **New repository secret** で以下を登録する
   - Name: `ANTHROPIC_API_KEY`
   - Secret: 発行したAPIキー
4. 次回のワークフロー実行から自動的に翻訳が有効になります(`.github/workflows/deploy.yml` がこのSecretを `ANTHROPIC_API_KEY` 環境変数として `npm run fetch-news` に渡します)

**費用の目安**: 翻訳コストはサイトの閲覧者数ではなく、新規に取得される記事数(=ニュースの量)に比例します。ビルド時に1回翻訳した結果は
`src/data/news.json` にキャッシュされ、同じ記事を毎回翻訳し直すことはありません。使用モデルはClaude Haiku 4.5(2026年7月時点の料金で
入力$1/MTok・出力$5/MTok)で、1日あたり数十〜百件程度の新着記事であれば月額換算でごく少額(数百円〜)に収まる見込みです。正確な費用は
[Anthropicの料金ページ](https://www.anthropic.com/pricing)で確認してください。

### 5. ワークフローを実行する

- 何もしなくても `main` にpushした時点で `.github/workflows/deploy.yml` が自動実行されます
- 手動で今すぐ実行したい場合は **Actions** タブ → "Build and deploy to GitHub Pages" → **Run workflow**
- 以降は30分おきに自動でニュースを取得・翻訳し直し、ビルド・再デプロイされます

数分待つと `https://4getkun.github.io/Curation_MLB/` でサイトが確認できます。

## ローカルでの開発

```bash
npm install
npm run dev       # http://localhost:4321/Curation_MLB/ で確認
npm run fetch-news   # RSSを取得して src/data/news.json を更新(ANTHROPIC_API_KEY未設定なら翻訳はスキップされ英語のまま)
ANTHROPIC_API_KEY=sk-ant-xxxx npm run fetch-news  # 翻訳ありで取得したい場合
npm run build      # dist/ に静的ファイルを生成
npm run preview     # ビルド結果をローカルで確認
```

## ディレクトリ構成

```
src/
  data/
    teams.json    球団マスタ(日本人選手所属10球団の名称・カラー・判定キーワード)
    players.json   日本人メジャーリーガーのマスタ(氏名・所属球団・MLBデビュー日・判定キーワード)
    feeds.json    ニュース取得元のRSSフィード一覧
    topics.json    話題タグのマスタ(ラベル・判定キーワード)
    news.json     自動生成されるニュースデータ(fetch-newsで更新)
  lib/         データ読み込み・整形用のユーティリティ(news.ts, teams.ts, players.ts, topics.ts, url.ts)
  components/     Header, Footer, NewsRow, FeaturedNews, TeamLinkRow, TeamChipLink,
             PlayerLinkRow, PlayerChipLink, TopicLinkRow, TopicChipLink など
  layouts/       共通レイアウト(Base.astro)
  pages/
    index.astro         トップページ(日本人メジャーリーガー・マイ球団・話題から探すを含む)
    news/index.astro     ニュース一覧(球団フィルター付き)
    team/index.astro      球団別ニュースのランディングページ
    team/[team].astro     球団別ページ(10球団分を自動生成)
    player/index.astro     日本人メジャーリーガー一覧ページ
    player/[player].astro   選手別ページ(15選手分を自動生成)
    topic/index.astro     話題タグのランディングページ
    topic/[topic].astro    話題別ページ(話題タグ分を自動生成)
    search/index.astro     サイト内検索ページ
    data/news-index.json.ts  検索・マイ球団機能向けの軽量JSONエンドポイント
    feed.xml.ts        このサイト自体のRSS配信エンドポイント
    about/index.astro     このサイトについて(AI翻訳についての注記を含む)
scripts/
  fetch-news.mjs     RSS取得→球団/選手/話題分類→AI翻訳→重複統合→news.json書き出しスクリプト
  generate-icons.py    PWAアイコン生成スクリプト(開発時に手動実行するツール、ビルドには含まれません)
public/
  manifest.webmanifest  PWA用マニフェスト
  sw.js          Service Worker(オフライン対応)
  offline.html      オフライン時のフォールバックページ
  icons/         PWAアイコン(192px/512px)
.github/workflows/
  deploy.yml       ニュース更新→翻訳→ビルド→GitHub Pagesデプロイを行うワークフロー
```

## ニュース取得元・分類ロジックをカスタマイズする

- `src/data/feeds.json` にRSSフィードを追加・削除できます。球団専門フィードには `"teamId"` を指定してください(そのフィードから
  取得した記事は無条件でその球団のタグが付きます)
- `src/data/teams.json` の `keywords`、`src/data/players.json` の `nameVariants` を調整すると、記事の球団・選手振り分け精度を調整できます。
  英語の記事タイトル・要約に対して単語境界つきの完全一致(大文字小文字無視)で判定しているため、日本語版(Curation NPB)のような
  「短い略称が地名・企業名と衝突する」問題は基本的に起きませんが、新しい選手・球団を追加する際は誤判定がないか
  `node scripts/fetch-news.mjs` 実行後に `src/data/news.json` を確認することをおすすめします
- `scripts/fetch-news.mjs` の `AD_MARKERS` で、広告・タイアップ記事を除外するための見出しマーカー(`[Sponsored]` 等)を追加・調整できます
- 新しい日本人メジャーリーガーが誕生した場合は `src/data/players.json` に選手を追加し、`src/data/teams.json` に未収録の球団があれば
  あわせて追加してください(球団追加時は `src/data/feeds.json` にもその球団のMLB.com RSSフィードを追加すると網羅性が上がります)

## AI日本語翻訳の仕組み

`scripts/fetch-news.mjs` は、重複統合が終わった後・まだ日本語訳が付いていない記事だけをAnthropic API(Claude Haiku)にまとめて送り、
見出し・要約の日本語訳を取得します。

- 翻訳は英語記事の内容を要約・意訳するのみで、原文にない情報を付け加えることはありません(プロンプトで明示的に禁止)
- 球団名・選手名は `src/data/teams.json` / `src/data/players.json` から自動生成した対訳表に基づいて表記を統一しています
- 一度翻訳された記事は `src/data/news.json` にキャッシュされ、英語の原題が変わらない限り再翻訳されません(コスト削減のため)
- `ANTHROPIC_API_KEY` が未設定、またはAPI呼び出しに失敗した場合は、該当記事は英語のまま掲載され、次回実行時に再試行されます。
  パイプライン全体が止まることはありません
- **翻訳はAIによる自動処理のため、誤訳・意訳のニュアンス差が生じる場合があります。** 正確な内容を確認したい場合は、必ず記事の
  「原文(英語)」リンクから配信元サイトの原文をご確認ください(サイト内の about ページ・記事表示にも同様の注記があります)

## ニュースのアーカイブ(直近30日分の蓄積)について

RSSフィードは「その時点で配信元が公開している最新N件」しか返さない仕組みで、フィード側に過去ログは残っていません。
そのため `scripts/fetch-news.mjs` は実行のたびに次のように動作します。

1. 直前にコミットされている `src/data/news.json`(=これまでに蓄積した記事、翻訳結果も含む)を読み込む
2. 今回RSSから新しく取得した記事とリンクでマージする(英語の原題が変わっていなければ、既存の翻訳結果を引き継ぐ)
3. `RETENTION_DAYS`(既定30日)より古い記事は間引く
4. 念のための安全弁として `MAX_ITEMS`(既定4000件)を超えた分も間引く
5. 同一ニュースの重複統合を行う
6. まだ翻訳されていない記事だけをAnthropic APIに送って日本語訳を取得する
7. 結果を `src/data/news.json` に書き戻す(GitHub Actionsがこれをコミット)

**注意点**: この仕組みは「これから運用開始した時点から」少しずつ記事が積み上がっていく方式です。RSS自体に
過去1ヶ月分のログが残っているわけではないため、公開した瞬間にいきなり1ヶ月分のニュースが揃うわけではありません。
30分おきの自動更新を繰り返すことで、だいたい1ヶ月ほど運用すると直近30日分のアーカイブが揃った状態になります。
保持期間を変えたい場合は `scripts/fetch-news.mjs` 冒頭の `RETENTION_DAYS` を書き換えてください。

## デザインについて

姉妹サイト「Curation NPB」と同じデザイン言語(エディトリアル/マガジン調、クリーム地+アクセントカラー)をベースに実装しています。
配色はすべて `src/styles/global.css` の `:root` / `.dark` に定義したCSS変数(`--page-bg` `--text` `--accent` など)にまとまっているため、
この変数を書き換えるだけでライト/ダーク両方の配色を一括調整できます。コンポーネント側は `var(--xxx)` を参照しているだけなので、
`dark:` バリアントを個別に書き足す必要はありません。球団ごとのアクセントカラーは `src/data/teams.json` の `color` フィールドで
個別に管理しています。

さらにデザインを調整する場合は、`src/styles/global.css` のテーマ変数と `src/components/` 配下(特に `NewsRow.astro` `FeaturedNews.astro`
`TeamLinkRow.astro` `PlayerLinkRow.astro`)を中心に編集してください。

## 免責事項

掲載しているニュースの著作権は各配信元メディアに帰属します。本サイトは見出し・要約・リンクのみを掲載するキュレーション(リンク集)であり、
記事本文の転載は行っていません。日本語要約はAI(Anthropic API)による自動翻訳であり、正確な内容は必ずリンク先の原文でご確認ください。
RSS配信元の利用規約に変更があった場合は、`src/data/feeds.json` の見直しが必要になることがあります。
