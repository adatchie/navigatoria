---
version: alpha
name: Navigatoria Antique Brass
description: >
  16世紀大航海時代の古地図・航海日誌をモチーフにしたUI。
  羊皮紙・真鍮・オーク材の質感で、AI生成臭のない本物のゲームUIを目指す。
colors:
  # === 羊皮紙 ===
  parchment: "#f4e8c1"
  parchment-dark: "#d4c4a0"
  parchment-edge: "#c8b88a"
  # === インク ===
  ink: "#2c1810"
  ink-light: "#5a3d2b"
  ink-faded: "#8b7355"
  # === 真鍮 ===
  brass: "#b8860b"
  brass-light: "#d4a843"
  brass-bright: "#e8b86d"
  brass-dark: "#8b6508"
  gold-leaf: "#c5a044"
  # === 木材 ===
  wood: "#3e2723"
  wood-light: "#5d4037"
  wood-grain: "#4a3228"
  # === 封蝋・赤 ===
  seal-red: "#8b1a1a"
  seal-red-light: "#a04040"
  # === 海 ===
  ocean-deep: "#0a1628"
  ocean-mid: "#1a3a5c"
  ocean-surface: "#0d2847"
  # === 汎用 ===
  on-parchment: "#2c1810"
  on-wood: "#f4e8c1"
  on-ocean: "#f5deb3"
typography:
  port-title:
    fontFamily: Cinzel
    fontSize: 1.375rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
  section-heading:
    fontFamily: Cinzel
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
  body:
    fontFamily: "Noto Serif JP"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.8
  body-italic:
    fontFamily: "Noto Serif JP"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: italic
  label:
    fontFamily: "Noto Serif JP"
    fontSize: 0.6875rem
    fontWeight: 400
    lineHeight: 1.0
    letterSpacing: "0.05em"
  stat-value:
    fontFamily: "Noto Serif JP"
    fontSize: 0.8125rem
    fontWeight: 700
    lineHeight: 1.0
  stat-label:
    fontFamily: "Noto Serif JP"
    fontSize: 0.6875rem
    fontWeight: 400
    lineHeight: 1.0
    letterSpacing: "0.05em"
  hud-mono:
    fontFamily: "JetBrains Mono"
    fontSize: 0.6875rem
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  none: 0px
  sm: 2px
  md: 4px
  lg: 6px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
components:
  # === 港画面: ヘッダー ===
  header-bar:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.gold-leaf}"
    height: 56px
    padding: "{spacing.md}"
  # === 港画面: ステータスバー ===
  status-bar:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    height: 36px
    padding: "{spacing.sm} {spacing.xl}"
  # === 港画面: サイドバー ===
  sidebar:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.brass-light}"
    width: 200px
  sidebar-item:
    textColor: "{colors.brass-light}"
    padding: "10px {spacing.md}"
  sidebar-item-active:
    textColor: "{colors.gold-leaf}"
    backgroundColor: "rgba(184,134,11,0.15)"
  # === 港画面: コンテンツ（羊皮紙） ===
  content-parchment:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    padding: "{spacing.xxl} {spacing.xl}"
  # === 施設カード ===
  facility-card:
    backgroundColor: "rgba(255,255,255,0.35)"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 14px
  facility-card-hover:
    backgroundColor: "rgba(255,255,255,0.55)"
    borderColor: "{colors.brass}"
  # === ボタン ===
  button-wood:
    backgroundColor: "{colors.wood-light}"
    textColor: "{colors.gold-leaf}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  button-wood-hover:
    backgroundColor: "#6d4c41"
  button-captain:
    backgroundColor: transparent
    textColor: "{colors.brass}"
    borderColor: "{colors.brass}"
    rounded: "{rounded.sm}"
    padding: "6px {spacing.md}"
  # === 洋上画面: HUD ===
  ocean-hud-panel:
    backgroundColor: "rgba(62,39,35,0.9)"
    textColor: "{colors.parchment}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  compass-ring:
    size: 80px
    borderColor: "{colors.brass}"
    rounded: full
  fleet-card:
    backgroundColor: "rgba(62,39,35,0.9)"
    textColor: "{colors.parchment-dark}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  fleet-card-flagship:
    borderColor: "{colors.brass}"
---

## Overview

Navigatoriaは16世紀の大航海時代を舞台にしたシングルプレイ交易・航海ゲーム。
UIは「船長の船室に広げた古地図と航海日誌」をメタファーとする。

AI生成特有の紫グラデーション、フラットな角丸カード、モダンWeb的な余白を禁止する。
代わりに羊皮紙の温かみ、真鍮の金属光沢、インクの滲み、オーク材の木目で質感を表現する。

## Colors

### 羊皮紙パレット（港画面コンテンツ領域）
- **parchment (#f4e8c1):** メインコンテンツ背景。温かいクリーム。
- **parchment-dark (#d4c4a0):** ステータスバー端、カードボーダー。
- **parchment-edge (#c8b88a):** 羊皮紙の端の経年変色。

### インクパレット（テキスト・描画）
- **ink (#2c1810):** 見出し・重要テキスト。深い焦げ茶。
- **ink-light (#5a3d2b):** 本文・説明文。
- **ink-faded (#8b7355):** 補足情報、メタデータ。

### 真鍮パレット（アクセント・装飾・インタラクション）
- **brass (#b8860b):** ボーダー、アイコン、選択状態。
- **brass-light (#d4a843):** ホバー状態、サブアイコン。
- **brass-bright (#e8b86d):** コンパス針、ハイライト。
- **brass-dark (#8b6508):** 影、非アクティブ装飾。
- **gold-leaf (#c5a044):** 港名見出し、旗艦マーク。

### 木材パレット（ヘッダー・サイドバー・フレーム）
- **wood (#3e2723):** ヘッダー背景、サイドバー。
- **wood-light (#5d4037):** ボタン背景、ホバー。
- **wood-grain (#4a3228):** 木目グラデーションの中間色。

### 海パレット（洋上画面3DビューのHUD背景）
- **ocean-deep (#0a1628):** 洋上画面のベース背景。
- **ocean-mid (#1a3a5c):** 海面近く。
- **ocean-surface (#0d2847):** HUD透過パネルの裏側。

## Typography

- **Cinzel**: 港名（LISSABON）、セクション見出し。ラテン碑文風のセリフ体。
- **Noto Serif JP**: 本文、ボタンラベル、ステータス値。温かみのある明朝体。
- **JetBrains Mono**: は使用しない（Naval Charts方向は不採用）。洋上の座標表示のみ許可。

見出しは `letter-spacing: 0.1em` 以上で広めに。本文は `line-height: 1.8` でゆったりと。

## Layout

- **ヘッダー**: 56px固定、木材背景、真鍮下ボーダー3px
- **ステータスバー**: 36px固定、羊皮紙背景、ステータス項目を横並び
- **サイドバー**: 200px固定幅、木材背景、ナビ項目は縦並び
- **コンテンツ**: 残り全幅、羊皮紙背景、パディング24-32px
- **施設定義**: グリッド `repeat(auto-fill, minmax(210px, 1fr))`

## Elevation & Depth

- **木材→羊皮紙の境界**: `box-shadow: inset -3px 0 8px rgba(0,0,0,0.3)` でサイドバー右端に影
- **羊皮紙の内側グロー**: `box-shadow: inset 0 0 30px rgba(139,101,8,0.15)` でコンテンツ領域の端を暗く
- **カードの浮き**: `box-shadow: 0 1px 3px rgba(139,101,8,0.1)` → ホバーで `0 3px 8px`
- **コンパスリング**: `box-shadow: 0 0 12px rgba(0,0,0,0.5), inset 0 0 15px rgba(0,0,0,0.3)`
- **蝋封**: 影なし、opacity低めで背景に馴染ませる

## Shapes

- 角丸は原則小さく: `sm`(2px)〜`md`(4px)
- コンパスのみ `full`(完全円)
- 羊皮紙パネルの角は意図的に少し大きめ(4px)にして、破れエッジテクスチャと競合しないようにする

## Components

### header-bar
木材背景の固定ヘッダー。左にコンパスローズSVG入り円形アイコン、港名（Cinzel）、港情報。右に保存・読込ボタン。保存ボタンには羽根ペンSVGを添える。

### status-bar
羊皮紙背景の横一列ステータス。所持金・艦隊・旗艦・耐久・船員・士気を等間隔に配置。金額は `gold-leaf` 色。

### sidebar
木材背景の縦ナビ。各項目は左3pxボーダーで、アクティブ時にbrass色に変化。右端に縄模様のSVG装飾。下端に施設レベル一覧。

### content-parchment
羊皮紙背景のメイン領域。四隅にコーナー装飾SVG。右上に蝋封SVG（低opacity）。セクション区切りに装飾罫線SVG（ダイヤモンド+スクロール）。

### facility-card
半透明白背景のカード。ホバーで背景透明度上昇 + brassボーダー + 微小上昇。カード内に微細パーチメントテクスチャのCSSパターン。

### button-wood
木材グラデーションのボタン。brass-darkの1pxボーダー。ホバーで木目が明るくなる。

### ocean-hud-panel
洋上画面のHUD要素（ナビゲーション情報、帆コントロール等）。`rgba(62,39,35,0.9)` の半透明木材 + `backdrop-filter: blur(4px)`。

## Decorative Vocabulary（装飾語彙）

AIテキストのみでは表現できない質感を、SVG装飾とAI生成テクスチャで補う。

### SVG装飾（ベクター — 解像度非依存）
| アセット | ファイル | 配置場所 | 用途 |
|---|---|---|---|
| コンパスローズ | `compass-rose.svg` | ヘッダー港アイコン内 | 港のシンボル |
| 装飾罫線 | `ornament-divider.svg` | セクション区切り | 見出し↔カード間 |
| コーナー装飾 | `corner-flourish-tl.svg` | 羊皮紙四隅 | 回転でTR/BL/BR対応 |
| 蝋封（錨印） | `wax-seal.svg` | 羊皮紙右上 | 低opacityで背景装飾 |
| 羽根ペン | `quill-pen.svg` | 保存ボタン内 | アイコン代用 |
| 羊皮紙パネル | `parchment-panel.svg` | テンプレート参照 | 破れエッジ付き背景 |

### AI生成テクスチャ（ラスター — Codex + GPT-image-2で生成予定）
| アセット | サイズ | タイリング | スタイル指定 |
|---|---|---|---|
| 羊皮紙テクスチャ | 512x512 | 可 | クリーム色(#f4e8c1)基調、経年変色シミ、微細な繊維質感、のりしろなし |
| 紙の破れエッジ上 | 2048x64 | 横可 | 不規則な破れ口、薄い茶(#c8b88a)のフチ、上下透過 |
| 紙の破れエッジ下 | 2048x64 | 横可 | 同上、反転使用可 |
| 木目テクスチャ（ダークオーク） | 512x512 | 可 | #3e2723基調、深い木目、節なし |
| インク染み（小） | 128x128 | 不可 | 黒茶(#2c1810)、不規則な滴り、透過PNG |
| インク染み（大） | 256x256 | 不可 | 同上、より大きく拡散 |
| コーヒー染み | 200x200 | 不可 | 薄い茶(#c8b88a)、リング状、透過PNG |

**テクスチャ生成時の共通プロンプト要件:**
- 透過PNG（背景透明）
- シームレスタイリング可能（テクスチャ系のみ）
- 写真ではなく「手描きイラスト」調。リアル写真はゲームUIと馴染まない
- 解像度はRetinaを想定して2xで出力

## Do's and Don'ts

### Do
- 羊皮紙領域には必ず内側グローのbox-shadowを付ける
- 真鍮要素には `box-shadow: inset 0 1px 0 rgba(255,255,255,0.2)` で金属光沢を暗示
- ホバー状態は微妙な色変化 + 微小な`translateY(-1px)`で質感を保つ
- セクション区切りには装飾罫線SVGを使用
- コーナー装飾はopacity 0.3-0.4で背景に溶け込ませる
- テクスチャは `background-repeat: repeat` + `background-size` でタイル張り

### Don't
- **紫グラデーション禁止** — これは「AIで作りました」の象徴
- **真っ白なフラットカード禁止** — 必ず羊皮紙の質感か木目を載せる
- **丸すぎる角丸禁止** — 最大4px。16px等のモダンUI的角丸は不適
- **過度なドロップシャドウ禁止** — elevationは微細に。がっつり浮いたカードはNG
- **モダンWebフォント（Inter, system-ui等）禁止** — Cinzel + Noto Serif JPに統一
- **余白の空欄禁止** — 羊皮紙の端には装飾（コーナー、罫線、染み）を配置
- **ベタ塗り禁止** — 木材背景は必ずグラデーション、羊皮紙はテクスチャ付き
- **CSS `border-radius: 50%` の乱用禁止** — コンパスとアイコンのみ
