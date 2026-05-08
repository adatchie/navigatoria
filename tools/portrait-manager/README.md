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

The local browser does not call an external image API. Pressing
`承認分を画像スレッドへ送信` writes the latest request to:

```text
tools/portrait-manager/data/latest-generation-request.json
```

Then the local server starts `codex app-server`, creates or reuses the
dedicated image thread stored in:

```text
tools/portrait-manager/data/image-thread.json
```

and sends approved portraits one by one through `turn/start`. Job status
is stored in:

```text
tools/portrait-manager/data/app-server-job.json
```

Each sent portrait is also recorded in the local implementation DB:

```text
tools/portrait-manager/data/portrait-records.json
```

Those files are ignored by Git. Generated images are accumulated by Codex
under the generated-images store for the dedicated thread, not in the
current planning thread.

## Approval Flow

Use `属性案作成` to create non-duplicated character briefs. Edit any
brief in the candidate list, approve individual entries or use `全承認`,
then send only the approved list to the image thread.

## Implementation DB

`顔グラDB` is a thin local database for production use. It is created
from approved generation requests, then lets you attach the final display
name, implementation ID, generated image path, and notes after the image
exists. The generated prompt, role, nationality, port, age, period, face
angle, gender, setting, mood, and dedicated image-thread ID remain on the
record so the portrait can later be linked to game data without relying
on the temporary browser list.

The server also exposes generated image discovery for the dedicated
thread through:

```text
GET /api/generated-images
```

Image previews are served only from Codex's generated-images directory
when an image path is attached to a DB record.

After each App Server generation turn, the manager checks the dedicated
thread's generated-images directory and attaches the new file path to the
matching DB record. The same reconciliation also runs when loading
`顔グラDB`, so older generated files can be picked up after a restart.
The `生成画像フォルダ` section also lists all images found for the
dedicated thread, independent of whether they are already linked to a DB
record.

## Batch Input

One record per line:

```text
role,nationality,port,age,setting,mood,costumePeriod,faceAngle
```

Example:

```text
navigator,portugal,lisbon,30s,careful pilot,stern expression,late_16c,three_quarter_left,male
barmaid,portugal,lisbon,20s,warm tavern hostess,friendly smile,strict_16c,random,female
```

`costumePeriod` is optional. Supported values are `strict_16c`,
`early_16c`, `mid_16c`, and `late_16c`. Prompts include explicit
16th-century costume constraints and negative terms for later Baroque,
pirate, tricorn, frock coat, cravat, and naval-uniform styles.

`faceAngle` is optional. Supported values are `random`, `front`,
`three_quarter_left`, `three_quarter_right`, `profile_left`, and
`profile_right`. `random` resolves to a stable varied angle per entry.

`gender` can be added as the ninth column. Supported values are
`unspecified`, `male`, and `female`.

## Style Direction

Portrait prompts prioritize original Japanese console tactical RPG
character art. The core style phrase is inserted at the top of each
prompt and repeated inside the detailed style guardrails:

```text
エッチングっぽい陰影がついた繊細な日本のゲームイラスト的な線画、褪せた色味の水彩で陰影をつけた塗り
```

The prompt does not use living artist names. Instead, it locks the
desired result through concrete illustration rules: line-art-first 2D
hand-drawn Japanese console RPG portrait, thin restrained ink linework,
hatching and cross-hatching on the face and costume, faded transparent
watercolor shadows, pale paper-like skin areas, and simplified
character-design facial structure. It also adds controlled attractive
stylization: slightly emphasized memorable eyes, elegant eyelid lines,
cleaner facial silhouettes, and subtle cool/cute distortion that stays
short of comedy, chibi proportions, childish faces, or oversized anime
eyes. The failure check rejects outputs where shading, skin texture,
lighting, or painted volume dominates the linework.

Each generation request also stores a separate `styleProfile` object
beside the final prompt. That keeps the target style, required visual
traits, and rejection criteria machine-readable so future generation
steps can inspect or reinforce the style lock without scraping the
prompt text.

## Prompt Lessons Applied

The better female test worked because it kept the subject controlled:
one clear profession, one subtle prop, 16th-century clothing, muted
background, and a calm Japanese game portrait read. It did not try to
create weight through dirt, scars, rough hands, heavy beard, muscle,
weapons, strong lighting, or toughness.

The prompt builder now applies that pattern to every role. Role identity
comes from clothing structure, posture, age, social role, and one small
prop near the lower edge. Male prompts also include a guardrail against
the failure loop seen in tests: rugged western RPG man, beard-dominant
face, muscular laborer, fantasy rogue, fashion-model beauty, skin
texture rendering, and cinematic toughness.
