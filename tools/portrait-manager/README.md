# Portrait Generator

Local prompt builder for Navigatoria portrait generation.

## Start

```powershell
node tools\portrait-manager\server.mjs
```

Default URL:

```text
http://127.0.0.1:4178
```

## Generation Request

The local browser does not call an external image API. Pressing `画像生成`
writes the latest request to:

```text
tools/portrait-manager/data/latest-generation-request.json
```

## Batch Input

One record per line:

```text
role,nationality,port,age,setting,mood,costumePeriod,faceAngle
```

Example:

```text
navigator,portugal,lisbon,30s,careful pilot,stern expression,late_16c,three_quarter_left
barmaid,portugal,lisbon,20s,warm tavern hostess,friendly smile,strict_16c,random
```

`costumePeriod` is optional. Supported values are `strict_16c`,
`early_16c`, `mid_16c`, and `late_16c`. Prompts include explicit
16th-century costume constraints and negative terms for later Baroque,
pirate, tricorn, frock coat, cravat, and naval-uniform styles.

`faceAngle` is optional. Supported values are `random`, `front`,
`three_quarter_left`, `three_quarter_right`, `profile_left`, and
`profile_right`. `random` resolves to a stable varied angle per entry.

## Style Direction

Portrait prompts prioritize original Japanese console tactical RPG
character art. The core style phrase is inserted at the top of each
prompt and repeated inside the detailed style guardrails:

```text
エッチングっぽい陰影がついた繊細な日本のゲームイラスト的な線画、褪せた色味の水彩で陰影をつけた塗り
```

The prompt does not use living artist names. Instead, it locks the
desired result through concrete rendering rules: thin restrained ink
linework, hatching and cross-hatching on the face and costume, faded
transparent watercolor shadows, Japanese console RPG character-design
facial simplification, and a failure check that rejects western museum
portrait, old master painting, documentary reenactor realism, western
RPG portrait, AAA concept art, photorealistic digital painting,
cinematic lighting, oil painting, airbrushed skin, opaque painterly
fills, and literal antique-print results.

Each generation request also stores a separate `styleProfile` object
beside the final prompt. That keeps the target style, required visual
traits, and rejection criteria machine-readable so future generation
steps can inspect or reinforce the style lock without scraping the
prompt text.
