# 仕事の設定と保存の契約

利用先の `.asdd/config.json` が設定の正本です。AIは同梱の `scripts/asdd/config.mjs` の `loadConfig(root)` で検証します。これは配布プラグイン内のパスであり、別プラグインのインストールを探す必要はありません。設定なしのnullと、不正・読取不能の例外を区別します。設定がない既存環境は、明示的な移行まで保持します。

## schemaVersion 1

全項目を明示します。知らないキー、重複した選択、空の必須文字列は受理されません。

| 項目 | 値・意味 |
| --- | --- |
| `schemaVersion` | 数値 `1` |
| `project` | `name`、`purpose`、`owner` の空でない文字列。名前・目的・担当者を合意する |
| `style` | `citizen` または `developer`。仕事向けの初期提案はcitizen |
| `stage` | 試作の `poc` または継続利用の `ongoing` |
| `tools` | `claude`、`codex` から1つ以上、重複なしで選ぶ |
| `documents` | `MASTER` 必須。必要に応じ `PROJECT`、`DOMAIN`、`ARCHITECTURE`、`PATTERNS`、`TESTING`、`DEPLOYMENT` を重複なしで選ぶ |
| `features` | `ace`、`retrospective`、`multiReview`、`hooks`、`ci` の5つのboolean。新規の仕事向け版はすべて `false` |
| `workflow` | `simple`、`standard`、`strict`。簡易を出発点に相談し、既存のルールを緩めない |
| `decisions` | `{topic,status,value,reason}` の配列。topic・value・reasonは空でない文字列 |
| `github` | 未接続は明示的な `null`。接続時は下表の全項目を持つオブジェクト |

`decisions.status` は事実 `fact`、合意 `agreed`、提案 `proposed`、未決 `unresolved` のいずれかです。提案を自動で合意にしません。未決値を適当な担当者・目的で埋めず、必須事項が未確認なら設定の適用を待ちます。認証情報や会話全文は記録しません。

| GitHub項目 | 値・意味 |
| --- | --- |
| `repository` | 合意した `owner/repo` |
| `recordIssues` | Issueへ経過を記録するboolean |
| `saveHistory` | 許可した成果物をGit履歴に保存するboolean |
| `allowedPaths` | 保存を許可した相対ファイル・ディレクトリの配列。globではなく指定パスとその配下が対象 |
| `branchPolicy` | 専用保存先で合意した `direct`、または既存PR方針を守る `pull-request` |

履歴保存trueには、Issue記録trueと空でない許可パスが必要です。履歴だけの保存はこの契約では選べません。Issueだけなら履歴false、外部保存なしならgithub=nullまたは両方falseにします。許可パスには絶対パス、`.`・`..`・空の要素、バックスラッシュ、制御文字、`-`で始まる要素を使いません。管理対象へのsymlinkは使用しません。

## 新規・再設定・移行

短いMASTERを共通入口とし、7つの観点を必要な粒度で扱います。選んでいない文書は不足ではありません。カバレッジ80%、Result patternなどを一律に要求せず、仕事の完成条件に必要な確認を合意します。

生成前に変更予定を提示します。生成管理情報と現在のファイルを照合し、手編集・既存文書を無条件に上書きしません。既存内容を採用するときの `--adopt` 入力は、レビュー済みパスと現在のSHA-256の対応です。

```json
{
  "docs/MASTER.md": "レビューした現在のファイルから計算した64桁の小文字16進SHA-256"
}
```

上記は形式の説明です。文言のまま実行せず、内容と合意の一致を確認して実測hashに置き換えます。適用までに内容が変わった場合は再確認します。設定変更後も採用済み文書の内容をレビューし、設定との矛盾を残しません。

仕事向け版は5つの任意機能を収録しません。既存設定にtrueがあれば、黙ってfalseにせず、開発者向け版で扱う案を提示します。切替時は `.asdd/config.json`、生成管理情報、既存文書・AI入口、`.asdd/local/work.json`、IssueとのtaskId対応を保持し、差分を確認します。切替だけで機能の稼働や移行完了を宣言しません。開発者向け版の必要機能と実行環境を確認します。

## 状態の読み方

- `init --check` は設定・生成物の確認であり、ファイル変更や外部更新を行いません。
- 初期設定完了、仕事の完成、利用・公開可能は別に判断します。未決事項を完成済みとして扱いません。
- 履歴保存・Issue更新の失敗や成否不明は未同期です。再開時は同じtaskIdと既存記録を照合します。
- 保存先・範囲が合意済みの通常更新は毎回承認を求めません。公開・送信・破壊的操作はその合意に含まれません。
