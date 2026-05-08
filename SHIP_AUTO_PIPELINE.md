# 船3Dモデル自動生成パイプライン設計

## 0. 参考: モジョンさんのアプローチ

@mojon1 さんの投稿で実現していたこと:
- Claudeに「〇〇の3Dモデル作って」と一言頼むだけ
- Tripo API で3Dモデル自動生成
- Cinema 4D にMCPで連携して自動インポート
- レンダリング→画像保存まで全自動
- Cinema 4D用のMCPサーバーとプラグインはClaudeが自動生成
- FBX変換でテクスチャ読み込みも対応
- **プログラムは一行も書いていない**

### 我々のプロジェクトへの適用

| モジョンさん | 我々のプロジェクト |
|------------|------------------|
| Cinema 4D | Blender (無料) → Three.js/R3F |
| レンダリング出力 | ゲーム内リアルタイム描画 |
| 1モデル完成がゴール | 20船種の量産 + パーツ分離が必要 |
| MCP + C4Dプラグイン | MCP + Blender Addon |

**核心的な違い**: モジョンさんのワークフローは「1枚の静止画」が最終成果物だが、
我々は「ゲーム用の分離されたパーツ付きGLBモデル」が必要。そのため、
Blenderでの後処理自動化が重要になる。

---

## 1. 自動化パイプライン全体像

```
┌─────────────────────────────────────────────────────────────────┐
│                Claude Code + MCP 統合パイプライン                 │
│                                                                 │
│  ① Claudeへの指示                                               │
│  「ガレオン船の3Dモデルを作って、ゲーム用に最適化して」             │
│         │                                                       │
│         ▼                                                       │
│  ② Tripo MCP Server                                            │
│  ├─ text_to_model API呼び出し                                   │
│  ├─ プロンプト自動生成（船種データから）                           │
│  └─ GLBモデル取得・ローカル保存                                  │
│         │                                                       │
│         ▼                                                       │
│  ③ Blender MCP Server（自動後処理）                              │
│  ├─ GLBインポート                                               │
│  ├─ リトポロジー（ポリゴン数調整）                                │
│  ├─ パーツ分離（船体/帆/マスト/大砲スロット）                    │
│  ├─ 帆のモーフターゲット作成                                     │
│  ├─ 大砲スロット（Empty）の配置                                  │
│  ├─ テクスチャベイク・最適化                                     │
│  └─ 最適化済みGLBエクスポート                                    │
│         │                                                       │
│         ▼                                                       │
│  ④ gltfjsx 変換                                                 │
│  └─ GLB → React Three Fiber コンポーネント自動生成               │
│         │                                                       │
│         ▼                                                       │
│  ⑤ ゲームプロジェクトに自動配置                                  │
│  ├─ src/rendering/ship/models/ にコンポーネント配置               │
│  ├─ public/models/ships/ にGLBファイル配置                       │
│  └─ ships.json にメタデータ追加                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 必要なMCPサーバー構成

### 2.1 Tripo MCP Server（公式）
VAST-AI-Research が公式提供。Claude Desktopから直接3Dモデル生成が可能。

**セットアップ:**
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "tripo-mcp": {
      "command": "uvx",
      "args": ["tripo-mcp"],
      "env": {
        "TRIPO_API_KEY": "tsk_xxxxxxxxxxxxx"
      }
    }
  }
}
```

**利用可能ツール:**
| ツール | 機能 |
|--------|------|
| `text_to_model` | テキストプロンプトから3D生成 |
| `image_to_model` | 画像から3D生成 |
| `multiview_to_model` | 複数視点画像から3D生成 |
| `stylize_model` | スタイル適用 |
| `animate_model` | アニメーション付与 |
| `rig_model` | リギング |

### 2.2 Blender MCP Server
BlenderをClaudeから操作するMCPサーバー。Blenderの後処理を自動化する。

**選択肢:**
- **blender-mcp** (Siddharth Ahuja): 汎用的なBlender MCP。Pythonスクリプト実行対応
- **Tripo公式 Blender Addon**: Tripo生成モデルの直接インポートに特化

**Blender自動処理で実行するPythonスクリプトの例:**
```python
# ship_post_process.py
# Blender MCP経由でClaudeが自動実行するスクリプト

import bpy
import os

def post_process_ship(glb_path: str, ship_type: str, output_path: str):
    """AI生成された船モデルをゲーム用に後処理"""

    # 1. シーンクリア & インポート
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)

    # 2. 全オブジェクトを結合
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
    bpy.ops.object.join()
    ship_obj = bpy.context.active_object
    ship_obj.name = f"Ship_{ship_type}"

    # 3. ポリゴン数制限 (Decimate)
    target_faces = get_target_poly_count(ship_type)
    current_faces = len(ship_obj.data.polygons)
    if current_faces > target_faces:
        modifier = ship_obj.modifiers.new(name="Decimate", type='DECIMATE')
        modifier.ratio = target_faces / current_faces
        bpy.ops.object.modifier_apply(modifier="Decimate")

    # 4. パーツ分離
    separate_ship_parts(ship_obj, ship_type)

    # 5. 大砲スロット配置
    place_cannon_slots(ship_type)

    # 6. 帆のモーフターゲット追加
    add_sail_morph_targets()

    # 7. マテリアル最適化
    optimize_materials()

    # 8. GLBエクスポート
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_draco_mesh_compression_enable=True,
        export_apply=True
    )

def get_target_poly_count(ship_type: str) -> int:
    """船種に応じた目標ポリゴン数"""
    targets = {
        'small': 2000,
        'medium_small': 3000,
        'medium': 5000,
        'medium_large': 8000,
        'large': 12000,
    }
    return targets.get(ship_type, 5000)

def separate_ship_parts(obj, ship_type: str):
    """メッシュを船体パーツに分離"""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')

    # 高さベースで大まかに分離
    # 甲板より上 → マスト・帆候補
    # 喫水線付近 → 船体
    mesh = obj.data
    import bmesh
    bm = bmesh.from_edit_mesh(mesh)

    # バウンディングボックスから高さの閾値を計算
    z_coords = [v.co.z for v in bm.verts]
    z_min, z_max = min(z_coords), max(z_coords)
    z_range = z_max - z_min

    # デッキライン（全高の60%付近）
    deck_line = z_min + z_range * 0.6

    # マスト検出: 細くて高い部分を分離
    # → 頂点グループ or ルースパーツで分離

    bm.free()
    bpy.ops.object.mode_set(mode='OBJECT')

    # 分離後のパーツ命名
    # Hull_Main, Hull_Deck, Mast_1, Mast_2, Sail_1, ...

def place_cannon_slots(ship_type: str):
    """大砲の配置位置にEmptyオブジェクトを配置"""
    cannon_configs = {
        'small': {'port': 2, 'starboard': 2, 'bow': 0, 'stern': 0},
        'medium': {'port': 4, 'starboard': 4, 'bow': 1, 'stern': 1},
        'large': {'port': 6, 'starboard': 6, 'bow': 1, 'stern': 1},
    }
    config = cannon_configs.get(ship_type, cannon_configs['medium'])

    # 船体のバウンディングボックスから配置位置を計算
    ship = bpy.data.objects.get("Hull_Main")
    if not ship:
        return

    bbox = [ship.matrix_world @ v.co for v in ship.data.vertices]
    # ... 左右舷に均等配置 ...

def add_sail_morph_targets():
    """帆メッシュにモーフターゲット（シェイプキー）を追加"""
    for obj in bpy.data.objects:
        if obj.name.startswith("Sail_"):
            bpy.context.view_layer.objects.active = obj

            # ベースシェイプ（畳んだ状態）
            obj.shape_key_add(name="Basis")

            # 膨らんだ状態のシェイプキー
            sk = obj.shape_key_add(name="Inflated")
            for i, v in enumerate(sk.data):
                # 法線方向に膨らませる
                normal = obj.data.vertices[i].normal
                uv_y = 0.5  # UV座標のY（上部ほど大きく膨らむ）
                bulge = normal * 0.3 * uv_y
                v.co += bulge

def optimize_materials():
    """マテリアルを最適化（テクスチャサイズ縮小、不要マテリアル削除）"""
    for mat in bpy.data.materials:
        if mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    img = node.image
                    # 1024x1024 以下にリサイズ
                    if img.size[0] > 1024 or img.size[1] > 1024:
                        img.scale(1024, 1024)
```

### 2.3 ファイルシステム操作（Claude Code 標準機能）
Claude Codeは直接ファイル操作が可能なので、MCP不要:
- gltfjsx の実行
- ファイルの移動・配置
- ships.json への追記
- Reactコンポーネントの生成

---

## 3. 具体的なワークフロー: 1船種の完全自動生成

### Step 1: Claudeへの指示
```
「16世紀のスペイン・ガレオン船の3Dモデルを作って。
 セミリアルスタイル、ゲーム用に最適化、
 4本マスト、横帆メイン、砲門16門、
 ポリゴン数8000以下で」
```

### Step 2: Tripo API 呼び出し（Tripo MCP経由）

Claudeが自動的に以下を実行:

```
Tripo MCP の text_to_model ツールを使用:
- prompt: "16th century Spanish galleon, semi-realistic game asset,
           four masts with square sails, ornate stern castle,
           16 gun ports on each side, wooden hull with carvings,
           clean topology, low poly optimized, PBR textures"
- negative_prompt: "modern, sci-fi, cartoon, broken geometry"
- model_version: "v2.5"
```

生成結果: `galleon_raw.glb` がダウンロードされる

### Step 3: Blender 自動後処理（Blender MCP経由）

Claudeが Blender MCP を通じて以下を自動実行:

1. `galleon_raw.glb` をインポート
2. Decimate で 8000ポリ以下に最適化
3. パーツ分離スクリプト実行
4. 大砲スロット（Empty）を左右8箇所ずつ配置
5. 帆のシェイプキー（Basis / Inflated）を追加
6. テクスチャを 1024x1024 にリサイズ
7. Draco圧縮付きGLBエクスポート → `galleon_optimized.glb`

### Step 4: gltfjsx 変換（Claude Code で実行）

```bash
npx gltfjsx galleon_optimized.glb --types --transform \
  --output src/rendering/ship/models/ShipGalleon.tsx
```

### Step 5: プロジェクトへの配置（Claude Code で実行）

```bash
# モデルファイル配置
cp galleon_optimized.glb public/models/ships/galleon.glb

# ships.json にエントリ追加
# ShipRegistry に型定義追加
```

### Step 6: 確認
開発サーバーで実際にモデルが表示されるか確認

---

## 4. バッチ生成: 20船種を一括生成

### 4.1 船種定義データ

```typescript
// ship_generation_config.ts
// Claudeがこのデータを読んで、各船種のプロンプトを自動生成する

export const SHIP_GENERATION_CONFIG = [
  {
    id: 'bark',
    name: 'バーク',
    category: 'small',
    mastCount: 2,
    sailType: 'lateen',      // 縦帆
    gunPorts: 4,
    era: '15th-16th century',
    origin: 'Mediterranean',
    style: 'simple trading vessel',
    maxPolygons: 2000,
    prompt_hints: 'small Mediterranean bark, two masts with lateen sails, '
                + 'simple wooden hull, merchant vessel'
  },
  {
    id: 'caravel',
    name: 'キャラベル',
    category: 'medium_small',
    mastCount: 3,
    sailType: 'mixed',       // 混合
    gunPorts: 6,
    era: '15th century',
    origin: 'Portuguese',
    style: 'exploration vessel',
    maxPolygons: 3000,
    prompt_hints: 'Portuguese caravel, three masts, lateen and square sails, '
                + 'slender hull designed for exploration'
  },
  {
    id: 'carrack',
    name: 'キャラック',
    category: 'medium',
    mastCount: 3,
    sailType: 'square',
    gunPorts: 10,
    era: '15th-16th century',
    origin: 'European',
    style: 'large trading and war vessel',
    maxPolygons: 5000,
    prompt_hints: 'carrack nau, three masts with square sails, '
                + 'high forecastle and sterncastle, large round hull'
  },
  {
    id: 'galleon',
    name: 'ガレオン',
    category: 'large',
    mastCount: 4,
    sailType: 'square',
    gunPorts: 16,
    era: '16th century',
    origin: 'Spanish',
    style: 'imposing warship',
    maxPolygons: 10000,
    prompt_hints: 'Spanish galleon, four masts with square sails, '
                + 'ornate stern with gilded carvings, multiple gun decks'
  },
  {
    id: 'fluyt',
    name: 'フリュート',
    category: 'medium',
    mastCount: 3,
    sailType: 'square',
    gunPorts: 4,
    era: '17th century',
    origin: 'Dutch',
    style: 'efficient cargo vessel',
    maxPolygons: 4000,
    prompt_hints: 'Dutch fluyt, three masts, pear-shaped hull, '
                + 'narrow deck, large cargo hold, minimal armament'
  },
  {
    id: 'galley',
    name: 'ガレー',
    category: 'medium',
    mastCount: 1,
    sailType: 'lateen',
    gunPorts: 2,
    era: '16th century',
    origin: 'Mediterranean',
    style: 'oar-powered warship',
    maxPolygons: 4000,
    prompt_hints: 'Mediterranean war galley, single mast with lateen sail, '
                + 'long rows of oars on each side, ram at bow'
  },
  {
    id: 'junk',
    name: 'ジャンク',
    category: 'medium',
    mastCount: 3,
    sailType: 'junk',        // ジャンク帆
    gunPorts: 6,
    era: '15th century',
    origin: 'Chinese',
    style: 'flat-bottomed sailing vessel',
    maxPolygons: 4000,
    prompt_hints: 'Chinese junk ship, three masts with battened red sails, '
                + 'flat bottom, high stern, distinctive Asian design'
  },
  // ... 残り13船種
];
```

### 4.2 バッチ生成スクリプト（Claudeが実行）

Claudeへの指示:
```
ship_generation_config.ts の全船種について、順番に以下を実行してください:
1. Tripo APIでモデル生成
2. Blenderで後処理（パーツ分離、ポリゴン最適化）
3. GLBエクスポート
4. gltfjsx変換
5. プロジェクトに配置
各船種の生成結果をレビューして、品質が低い場合は再生成してください。
```

### 4.3 コスト見積

| 項目 | 単価 | 数量 | 合計 |
|------|------|------|------|
| Tripo API (Professional) | $19.90/月 | 1-2ヶ月 | $20-40 |
| 1モデル生成 | 約20-40クレジット | 20船種 × 平均2回（リトライ含む） | 800-1600クレジット |
| Professional プランのクレジット | 3,000クレジット/月 | — | 十分 |
| Blender | 無料 | — | $0 |
| gltfjsx | 無料（OSS） | — | $0 |
| **合計** | — | — | **$20-40** |

開発者APIクレジットプログラムを利用すれば、初回5,000クレジット（$50相当）が無料で付与される。

---

## 5. セットアップ手順

### 5.1 前提条件
- [x] Node.js 18+
- [ ] Python 3.10+
- [ ] Blender 4.x (インストール)
- [ ] Tripo AI アカウント作成 & APIキー取得
- [ ] uv (Python パッケージマネージャー)

### 5.2 Tripo MCP Server セットアップ

```bash
# 1. uv インストール
pip install uv

# 2. Tripo MCP Serverインストール
uvx tripo-mcp

# 3. Claude Code の MCP設定
# ~/.claude/claude_desktop_config.json に追加:
```

```json
{
  "mcpServers": {
    "tripo-mcp": {
      "command": "uvx",
      "args": ["tripo-mcp"],
      "env": {
        "TRIPO_API_KEY": "tsk_YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### 5.3 Blender MCP Server セットアップ

```bash
# 1. blender-mcp インストール
pip install blender-mcp

# 2. Blender側: Tripo AI Blender Addon インストール
#    → Blenderの Preferences > Add-ons から追加

# 3. Claude Code の MCP設定に追加:
```

```json
{
  "mcpServers": {
    "tripo-mcp": { ... },
    "blender-mcp": {
      "command": "uvx",
      "args": ["blender-mcp"]
    }
  }
}
```

### 5.4 動作確認

Claudeに以下を依頼:
```
テスト: 「小さな帆船の3Dモデルを生成して、Blenderで開いてスクリーンショットを撮って」
```

---

## 6. 品質管理

### 6.1 自動チェック項目
各モデル生成後にClaudeが自動確認:

- [ ] ポリゴン数が上限以内か
- [ ] テクスチャ解像度が適切か（512〜1024）
- [ ] パーツ分離が正しく行われたか（Hull, Mast, Sail が存在するか）
- [ ] 大砲スロットが正しい位置に配置されているか
- [ ] GLBファイルサイズが妥当か（1船種あたり1-5MB以内）
- [ ] gltfjsx変換が成功したか
- [ ] Three.jsでのテスト表示が正常か

### 6.2 スタイル統一のためのプロンプトテンプレート

全船種で統一感を出すための共通プロンプト要素:

```
共通サフィックス:
", semi-realistic game asset, hand-painted PBR textures,
 warm color palette, wooden vessel, age of sail era,
 clean topology, game-ready, consistent art style,
 studio lighting reference"

共通ネガティブプロンプト:
"modern, sci-fi, cartoon, anime, photorealistic,
 broken geometry, floating parts, missing textures,
 distorted proportions, too detailed for game use"
```

### 6.3 リトライ戦略
生成品質が低い場合:
1. プロンプトを修正して再生成（最大3回）
2. image_to_model を試す（リファレンス画像を用意）
3. multiview_to_model を試す（複数角度の画像を生成してから3D化）
4. 最終手段: 別のAIツール（Meshy等）で生成

---

## 7. 将来の拡張

### 7.1 画像→3Dワークフロー
セミリアルスタイルの統一が難しい場合:
1. まずAI画像生成（Stable Diffusion / DALL-E）で統一スタイルの帆船画像を生成
2. その画像をTripo の `image_to_model` に入力
3. → より統一感のあるモデル群が得られる

### 7.2 自動プレビューページ
生成した全船種を一覧で確認できるHTMLページを自動生成:
```
public/ship-preview.html
├── 全20船種のGLBをThree.jsで表示
├── 回転・ズーム可能
├── パーツ別の表示/非表示切り替え
├── 材質切り替えプレビュー
└── ポリゴン数・テクスチャサイズ表示
```

### 7.3 ユーザーによるカスタム船の追加
ゲーム内で「造船所」からTripo APIを呼び出し、
プレイヤーが自分だけのオリジナル船をAI生成する機能（課金要素にもなりうる）

---

## 参考リンク

### ツール
- [Tripo AI](https://www.tripo3d.ai/) - 3Dモデル生成AI
- [Tripo API Documentation](https://platform.tripo3d.ai/docs/generation) - API仕様
- [Tripo MCP Server (公式)](https://github.com/VAST-AI-Research/tripo-mcp) - Claude連携
- [Tripo Game Hub Developer Credits](https://www.tripo3d.ai/blog/tripo-game-hub-developer-api-credits-program-english) - 開発者向け無料クレジット
- [blender-mcp](https://github.com/ahujasid/blender-mcp) - Blender MCP Server
- [gltfjsx](https://gltf.pmnd.rs/) - GLTF → React Three Fiber 変換
- [Meshy AI](https://www.meshy.ai/) - 代替3D生成AI

### 価格比較
- [3D AI Price Comparison 2026](https://www.sloyd.ai/blog/3d-ai-price-comparison)
- Tripo Professional: $19.90/月 (3,000クレジット、1モデル≈$0.21)
- Meshy: $20/月 (1,000クレジット、1モデル≈$0.40)
