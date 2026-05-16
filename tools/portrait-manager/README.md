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
angle, viewpoint, expression, headwear, facial hair, hair color, eye
color, gender, setting, mood, and dedicated image-thread ID remain on
the record so the portrait can later be linked to game data without
relying on the temporary browser list.

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
role,nationality,port,age,setting,mood,costumePeriod,faceAngle,gender,viewAngle,expression,headwear,facialHair,hairColor,eyeColor
```

Example:

```text
navigator,portugal,lisbon,30s,careful pilot,stern expression,late_16c,three_quarter_left,male,slightly_high,wary,flat_cap,faint_stubble,dark_brown,hazel
corsair,england,plymouth,30s,privateer sailor,confident smile,late_16c,three_quarter_left,male,slightly_low,confident,none,trimmed_moustache,dark_brown,grey
missionary,portugal,goa,40s,missionary interpreter,calm persuasive eyes,mid_16c,three_quarter_left,male,eye_level,calm,zucchetto,clean_shaven,dark_brown,dark_brown
sailor,netherlands,rotterdam,40s,veteran North Sea sailor,watchful eyes,late_16c,three_quarter_left,male,chin_down_eyes_up,skeptical,flat_cap,short_beard,grey,blue
```

Supported role values include `navigator`, `sailor`, `barmaid`,
`merchant`, `officer`, `mercenary`, `corsair`, `missionary`,
`guild_master`, `shipwright`, `noble`, and `scholar`.

`costumePeriod` is optional. Supported values are `strict_16c`,
`early_16c`, `mid_16c`, and `late_16c`. Prompts include explicit
16th-century costume constraints and negative terms for later Baroque,
pirate, tricorn, frock coat, cravat, modern clerical collar, bishop
mitre, and naval-uniform styles.

`faceAngle` is optional. Supported values are `random`, `front`,
`three_quarter_left`, `three_quarter_right`, `profile_left`, and
`profile_right`. `random` resolves to a stable varied angle per entry.

`gender` can be added as the ninth column. Supported values are
`unspecified`, `male`, and `female`.

Additional optional columns control visual variation:
`viewAngle`, `expression`, `headwear`, `facialHair`, `hairColor`, and
`eyeColor`. Use `random` to let the manager pick a stable varied value
per entry. Headwear values include `none`, `flat_cap`, `soft_bonnet`,
`cloth_cap`, `hood_or_coif`, `morion`, `zucchetto`, and `turban`.
Automatic headwear variation narrows those choices by role and cultural
context, so missionary-style zucchettos and military morions do not
bleed into unrelated briefs. `corsair` is available as a role for
16th-century pirate/privateer characters. It explicitly avoids
Caribbean or Golden Age pirate costume and instead uses loosened 1500s
maritime clothing.

## Style Direction

Portrait prompts prioritize original Japanese console tactical RPG
character art. The prompt builder now splits the prompt into fixed
style blocks and per-character blocks. The fixed blocks are inserted at
the top of every prompt, then the prompt adds character identity,
historical costume guidance, role cues, and a final self-check.

The core style phrase remains part of the fixed style lock:

```text
エッチングっぽい陰影がついた繊細な日本のゲームイラスト的な線画、褪せた色味の水彩で陰影をつけた塗り
```

The fixed blocks lock: line-art-first 2D hand-drawn Japanese console
RPG portrait, UI-ready conversation face graphic, thin restrained ink
linework, sharp hatching and cross-hatching, faded transparent
watercolor, open paper-like skin areas, and simplified character-design
facial structure. The character-specific blocks only supply identity,
period clothing, role cue, pose, expression, hair, eyes, headwear, and
small prop placement. The final self-check repeats the line and
watercolor priority so later generated portraits are less likely to
drift toward realistic rendering.

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
