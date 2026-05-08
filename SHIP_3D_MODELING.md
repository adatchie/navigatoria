# 船3Dモデル — モデリング & 実装技術検討

## 1. 要件整理

### 1.1 必要な船モデル
原作仕様から、初期実装で約20船種。大きさ5段階 × タイプ3種。

| 大きさ | 船種例 | ポリゴン目安 |
|--------|--------|-------------|
| 小型 | バーク、ピンネース、ダウ | 1,000-2,000 |
| 中小型 | キャラベル、ケッチ | 2,000-3,000 |
| 中型 | キャラック、フリュート、ジーベック | 3,000-5,000 |
| 中大型 | ガレオン、大型ジーベック | 5,000-8,000 |
| 大型 | 戦列艦、大型ガレオン、安宅船 | 8,000-12,000 |

### 1.2 カスタマイズ要素
船は以下の要素が見た目に反映される必要がある:

| 要素 | 変化内容 | 実装方法 |
|------|---------|---------|
| **帆** | 縦帆/横帆の艤装タイプ、補助帆の有無 | メッシュの表示/非表示切り替え |
| **大砲** | 砲門数に応じた配置 | インスタンス描画で砲門を動的配置 |
| **紋章/帆デザイン** | 帆に描かれるシンボル | テクスチャのUV差し替え |
| **船首像** | フィギュアヘッド | パーツ差し替え（5-10種） |
| **材質** | 木材/銅張り/鉄張り | マテリアルカラー/テクスチャ切り替え |
| **塗装** | 船体色 | マテリアルカラー変更 |
| **損傷** | 帆の破れ、船体の傷 | 損傷用メッシュ/テクスチャ重ねがけ |

### 1.3 パフォーマンス目標
- 1画面に同時表示: 最大20-30隻（戦闘シーン）
- ターゲットFPS: 60fps
- テクスチャ解像度: 512x512 〜 1024x1024
- モデル形式: glTF/GLB（Web標準）

---

## 2. モデル調達アプローチの比較

### アプローチA: AI生成ツール → Blender軽量調整

**推奨度: ★★★★★（最推奨）**

```
[テキストプロンプト / リファレンス画像]
        ↓
[AI 3Dモデル生成ツール] ← Meshy AI / Tripo AI / SEELE
        ↓
[生成モデル (.glb/.obj)]
        ↓
[Blender で軽量調整]
   ├─ リトポロジー（ポリゴン数調整）
   ├─ パーツ分離（船体/帆/マスト/大砲スロット）
   ├─ UV展開の修正
   ├─ PBRテクスチャのベイク
   └─ glTF/GLBエクスポート
        ↓
[gltfjsx で React コンポーネント化]
        ↓
[ゲーム内で動的カスタマイズ]
```

#### 推奨AI生成ツール

| ツール | 特徴 | 価格帯 | glTF対応 |
|--------|------|--------|----------|
| **Meshy AI** | テキスト/画像→3D。PBRテクスチャ自動生成。ゲーム用途に最適化 | 無料枠あり / $20/月〜 | ○ |
| **Tripo AI** | 60秒以内で生成。Ultra HDテクスチャ。リギング対応 | 無料枠あり / $10/月〜 | ○ |
| **SEELE** | ゲーム開発特化。ブラウザ完結。Unity/GLTF直接出力 | 無料枠あり | ○ |
| **Rodin** | トポロジー品質が高い。ゲーム用途向き | 要問合せ | ○ |

#### AI生成のプロンプト例
```
"16th century Spanish galleon, semi-realistic style,
 game asset, clean topology, wooden hull with detailed
 carvings, three masts with square sails furled,
 side view showing gun ports, low poly optimized"
```

#### メリット
- モデリング経験不要で高品質なベースモデルが得られる
- 1船種あたり数分〜数十分で生成
- PBRテクスチャ（ベースカラー、ノーマル、ラフネス）が自動生成
- 複数バリエーションを高速に試作可能

#### デメリット
- パーツ分離が自動ではないため、Blenderでの後処理は必須
- 同一スタイルの統一感を保つにはプロンプトの工夫が必要
- 細部のコントロール（砲門位置、マスト本数等）は後で調整が必要

#### コスト見積
- AI生成ツール: $20/月 × 2-3ヶ月 = $40-60
- 1船種あたりの作業時間: AI生成15分 + Blender調整1-2時間 = 約2時間
- 20船種: 約40時間

---

### アプローチB: 既存アセット購入/無料ダウンロード → カスタマイズ

**推奨度: ★★★★☆**

```
[アセットストアで船モデルを入手]
   ├─ Sketchfab (CC-BY多数)
   ├─ CGTrader (無料/有料)
   ├─ TurboSquid (無料/有料)
   ├─ Poly Pizza (CC0)
   └─ itch.io (ゲーム用パック)
        ↓
[Blender でスタイル統一・最適化]
   ├─ ポリゴン数調整
   ├─ テクスチャスタイル統一
   ├─ パーツ分離
   └─ glTF/GLBエクスポート
        ↓
[ゲーム実装]
```

#### 注目アセット
- **Ancient Ships Collection** (Cults3D): 9隻のスタイライズド中ポリ帆船。FBX+GLTF+テクスチャ付き
- **Pirate Ship Fluyt** (RetroStyleGames): 無料ローポリ帆船
- **Poly Pizza**: CC0のシンプルな船モデル多数
- **Sketchfab**: "sailing ship" で検索すると数百のCC-BYモデルあり

#### メリット
- すぐ使えるモデルが手に入る
- プロが作った高品質モデルもある
- 特にセミリアルな歴史帆船は多い

#### デメリット
- スタイルの統一が難しい（複数ソースから集めると不統一になりがち）
- ライセンス確認が必要
- ゲーム用にパーツ分離されていないことが多い
- 必要な船種が全て見つかるとは限らない

#### コスト見積
- 有料アセット: $5-50/モデル × 20 = $100-1,000
- Blender調整: 1船種あたり2-4時間
- 20船種: 約40-80時間

---

### アプローチC: 手続き生成（プロシージャル）

**推奨度: ★★★☆☆（部分採用推奨）**

```
[パラメータ定義]
   ├─ 船体長/幅/高さ
   ├─ マスト本数/高さ
   ├─ 帆の数/サイズ
   ├─ 砲門数/位置
   └─ デッキ数
        ↓
[Three.js で手続き生成]
   ├─ 船体: カスタムジオメトリ（Loft曲面 or パラメトリック）
   ├─ マスト: CylinderGeometry
   ├─ 帆: PlaneGeometry + 風によるバーテックスアニメーション
   ├─ 大砲: 小さなBox/Cylinder
   └─ ロープ/リギング: Line3
        ↓
[マテリアル/テクスチャ適用]
```

#### TypeScriptコード例（船体生成の概念）
```typescript
// 船体の断面形状をパラメータで定義し、
// ロフト（断面の連続移動）で船体メッシュを生成
interface ShipHullParams {
  length: number;      // 船体長
  beam: number;        // 船幅
  depth: number;       // 喫水
  bowSharpness: number; // 船首の尖り具合 (0-1)
  sternShape: number;   // 船尾の形状 (0=平ら, 1=丸い)
  deckCount: number;    // デッキ数
}

function generateHullGeometry(params: ShipHullParams): THREE.BufferGeometry {
  const sections = 20; // 断面数
  const vertices: number[] = [];

  for (let i = 0; i <= sections; i++) {
    const t = i / sections; // 0(船尾) → 1(船首)
    const width = params.beam * hullWidthCurve(t, params.bowSharpness);
    const height = params.depth * hullDepthCurve(t);

    // 各断面の輪郭点を生成
    for (let j = 0; j <= 12; j++) {
      const angle = (j / 12) * Math.PI; // 半円
      const x = t * params.length - params.length / 2;
      const y = Math.sin(angle) * height - params.depth;
      const z = Math.cos(angle) * width;
      vertices.push(x, y, z);
    }
  }
  // ... 面の構築 ...
}
```

#### メリット
- パラメータ変更で無限のバリエーション
- 外部アセット不要
- 船の改造（容量変更等）が見た目に直結
- カスタマイズの自由度が最も高い

#### デメリット
- セミリアルな見た目を達成するのが最も難しい
- 開発工数が大きい（船体生成ロジックだけで数週間）
- 装飾的なディテール（彫刻、手すり等）の表現が困難

#### 推奨用途
- **帆のアニメーション**（風になびく表現）は手続き生成が最適
- **大砲の動的配置**はインスタンシングで実装
- **波しぶきエフェクト**はパーティクルで手続き生成

---

## 3. 推奨ハイブリッドアプローチ

**最も現実的で高品質な結果を得られるのは、アプローチA+Cのハイブリッド。**

```
┌───────────────────────────────────────────────┐
│              モデル制作パイプライン              │
├───────────────────────────────────────────────┤
│                                               │
│  [AI生成] → [Blender調整] → [パーツ分離GLB]   │
│     │           │                │             │
│     │           │         ┌──────┴──────┐      │
│     ▼           ▼         ▼             ▼      │
│  ベース船体  テクスチャ  静的パーツ   動的パーツ │
│  (5カテゴリ)  統一       (船体,デッキ) (帆,大砲) │
│                                               │
│  ┌─ 小型帆船ベース    ← AI生成                │
│  ├─ 中型帆船ベース    ← AI生成                │
│  ├─ 大型帆船ベース    ← AI生成                │
│  ├─ ガレー船ベース    ← AI生成                │
│  └─ 東洋船ベース      ← AI生成                │
│                                               │
│  [ゲーム内] ← 手続き生成で動的カスタマイズ      │
│  ├─ 帆のアニメーション（頂点シェーダー）       │
│  ├─ 大砲の配置（インスタンシング）             │
│  ├─ 紋章/帆デザイン（テクスチャ差し替え）       │
│  ├─ 船首像（パーツ差し替え）                   │
│  ├─ 材質表現（マテリアル切り替え）              │
│  └─ 損傷表現（テクスチャ + メッシュ変形）       │
│                                               │
└───────────────────────────────────────────────┘
```

### 3.1 ベースモデルのカテゴリ分け（5カテゴリ × バリエーション）

全20船種を5つのベースカテゴリに分類し、バリエーションで対応する:

| カテゴリ | ベースモデル | 派生船種 | AI生成プロンプトキーワード |
|---------|------------|---------|-------------------------|
| **A. 小型帆船** | キャラベル | バーク、ピンネース、スループ | "small caravel, two masts, lateen sails" |
| **B. 中型帆船** | キャラック/フリュート | ナオ、コグ、フリュート、フリゲート | "merchant carrack, three masts, round hull" |
| **C. 大型帆船** | ガレオン | 戦列艦、大型ガレオン、東インド船 | "spanish galleon, four masts, ornate stern" |
| **D. ガレー船** | ガレー | ガレアス、ジーベック、ダウ | "mediterranean galley, oars, single mast" |
| **E. 東洋船** | ジャンク | 安宅船、関船、ダウ | "chinese junk, battened sails, flat bottom" |

**バリエーション生成方法:**
- マスト本数の増減
- 船体のスケーリング（長さ/幅/高さ比率の調整）
- デッキの追加/削除
- 装飾レベルの変更
- テクスチャの差し替え

### 3.2 GLTFモデルのパーツ構造設計

Blenderでのパーツ分離ルール:

```
ShipModel (GLTFシーン)
├── Hull            # 船体（メイン）
│   ├── Hull_Main   # 本体
│   ├── Hull_Deck   # 甲板
│   ├── Hull_Stern  # 船尾楼
│   └── Hull_Bow    # 船首
├── Masts           # マスト群
│   ├── Mast_1      # フォアマスト
│   ├── Mast_2      # メインマスト
│   ├── Mast_3      # ミズンマスト
│   └── Mast_4      # （大型船のみ）
├── Sails           # 帆群（風アニメーション用に別メッシュ）
│   ├── Sail_1_Square  # 横帆
│   ├── Sail_1_Lateen  # 縦帆（差し替え用）
│   ├── Sail_2_Square
│   └── ...
├── Cannons         # 大砲スロット（位置マーカー）
│   ├── CannonSlot_L1  # 左舷砲門1
│   ├── CannonSlot_L2
│   ├── CannonSlot_R1  # 右舷砲門1
│   └── ...
├── Figurehead      # 船首像スロット
├── Rigging         # リギング（ロープ類）
├── Flag            # 旗（国旗）
└── WaterLine       # 喫水線マーカー
```

---

## 4. Three.js / React Three Fiber 実装設計

### 4.1 モデルの読み込みとコンポーネント化

**gltfjsx** でGLTFモデルをReactコンポーネントに変換:

```bash
npx gltfjsx ship_galleon.glb --types --transform
```

生成されるコンポーネント:
```typescript
// src/rendering/ship/ShipGalleon.tsx
import { useGLTF } from '@react-three/drei'

interface ShipModelProps {
  // カスタマイズパラメータ
  riggingType: 'square' | 'lateen' | 'mixed';  // 艤装タイプ
  cannonCount: number;                          // 砲門数
  hullMaterial: ShipMaterial;                    // 船体材質
  emblemTexture: string;                         // 紋章テクスチャ
  figureheadType: string;                        // 船首像タイプ
  damageLevel: number;                           // 損傷レベル (0-1)
  // アニメーションパラメータ
  windDirection: THREE.Vector3;                  // 風向き
  windStrength: number;                          // 風力
  speed: number;                                 // 現在速度
  roll: number;                                  // ロール角
}
```

### 4.2 船の動的カスタマイズ実装

```typescript
// src/rendering/ship/ShipRenderer.tsx
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface ShipRendererProps {
  shipTypeId: string;       // 船種ID → ベースモデル選択
  customization: ShipCustomization;
  position: [number, number, number];
  rotation: [number, number, number];
  windDir: number;          // 風向（ラジアン）
  windPower: number;        // 風力 (0-1)
}

export const ShipRenderer: React.FC<ShipRendererProps> = ({
  shipTypeId, customization, position, rotation, windDir, windPower
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, nodes, materials } = useGLTF(`/models/ships/${shipTypeId}.glb`);

  // --- 材質カスタマイズ ---
  const hullMaterial = useMemo(() => {
    const mat = (materials.Hull as THREE.MeshStandardMaterial).clone();
    switch (customization.material) {
      case 'oak':
        mat.color.set('#8B6914');
        mat.roughness = 0.7;
        break;
      case 'copper':
        mat.color.set('#B87333');
        mat.metalness = 0.6;
        mat.roughness = 0.3;
        break;
      case 'iron':
        mat.color.set('#71797E');
        mat.metalness = 0.8;
        mat.roughness = 0.2;
        break;
      // ... 9種類の材質
    }
    return mat;
  }, [customization.material, materials]);

  // --- 帆のテクスチャ（紋章差し替え） ---
  const sailTexture = useMemo(() => {
    if (!customization.emblemId) return null;
    const loader = new THREE.TextureLoader();
    return loader.load(`/textures/emblems/${customization.emblemId}.png`);
  }, [customization.emblemId]);

  // --- 帆の風アニメーション ---
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 船体のローリング
    const roll = Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
    const pitch = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    groupRef.current.rotation.z = roll;
    groupRef.current.rotation.x = pitch;

    // 帆の膨らみアニメーション（頂点シェーダーが理想だが、
    // 簡易実装としてモーフターゲットを使用）
    const sailNodes = Object.entries(nodes)
      .filter(([name]) => name.startsWith('Sail_'));

    sailNodes.forEach(([name, node]) => {
      if (node instanceof THREE.Mesh && node.morphTargetInfluences) {
        // morphTarget[0] = 帆が膨らんだ状態
        const targetInfluence = windPower * 0.8;
        node.morphTargetInfluences[0] = THREE.MathUtils.lerp(
          node.morphTargetInfluences[0],
          targetInfluence,
          delta * 2
        );
      }
    });
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* 船体 */}
      <primitive object={nodes.Hull_Main} material={hullMaterial} />
      <primitive object={nodes.Hull_Deck} />
      <primitive object={nodes.Hull_Stern} />
      <primitive object={nodes.Hull_Bow} />

      {/* マスト（船種に応じて表示/非表示） */}
      {nodes.Mast_1 && <primitive object={nodes.Mast_1} />}
      {nodes.Mast_2 && <primitive object={nodes.Mast_2} />}
      {nodes.Mast_3 && <primitive object={nodes.Mast_3} />}

      {/* 帆（艤装タイプに応じて切り替え） */}
      <SailSystem
        nodes={nodes}
        riggingType={customization.riggingType}
        emblemTexture={sailTexture}
        windDir={windDir}
        windPower={windPower}
      />

      {/* 大砲（動的配置） */}
      <CannonArray
        slots={nodes}
        cannonCount={customization.cannonCount}
        cannonType={customization.cannonType}
      />

      {/* 船首像 */}
      {customization.figureheadId && (
        <FigureheadModel
          type={customization.figureheadId}
          position={nodes.Figurehead?.position}
        />
      )}

      {/* 国旗 */}
      <FlagRenderer
        country={customization.country}
        position={nodes.Flag?.position}
        windDir={windDir}
      />

      {/* 航跡エフェクト */}
      <WakeEffect speed={customization.currentSpeed} />
    </group>
  );
};
```

### 4.3 帆の風アニメーション（頂点シェーダー）

```glsl
// src/rendering/ship/shaders/sailVertex.glsl
uniform float uTime;
uniform float uWindStrength;
uniform vec3 uWindDirection;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  vec3 pos = position;

  // 帆の上部ほど大きく膨らむ
  float heightFactor = smoothstep(0.0, 1.0, uv.y);

  // 風による膨らみ
  float bulge = sin(uv.x * 3.14159) * heightFactor * uWindStrength * 0.5;
  pos += normal * bulge;

  // 風によるなびき（微細な揺れ）
  float flutter = sin(uTime * 3.0 + uv.y * 5.0 + uv.x * 2.0)
                * heightFactor * 0.02 * uWindStrength;
  pos += normal * flutter;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

### 4.4 大砲の動的配置（インスタンスメッシュ）

```typescript
// src/rendering/ship/CannonArray.tsx
import { useRef, useMemo } from 'react';
import { InstancedMesh } from 'three';
import { useGLTF } from '@react-three/drei';

interface CannonArrayProps {
  slots: Record<string, THREE.Object3D>;  // GLTFのCannonSlotノード
  cannonCount: number;
  cannonType: string;  // 大砲モデルID
}

export const CannonArray: React.FC<CannonArrayProps> = ({
  slots, cannonCount, cannonType
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const { nodes: cannonNodes } = useGLTF(`/models/cannons/${cannonType}.glb`);

  // スロット位置を収集（左舷・右舷の砲門位置）
  const slotPositions = useMemo(() => {
    return Object.entries(slots)
      .filter(([name]) => name.startsWith('CannonSlot_'))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, cannonCount)
      .map(([, obj]) => ({
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
      }));
  }, [slots, cannonCount]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[
        (cannonNodes.Cannon as THREE.Mesh).geometry,
        (cannonNodes.Cannon as THREE.Mesh).material,
        slotPositions.length
      ]}
    >
      {slotPositions.map((slot, i) => (
        <group key={i} position={slot.position} rotation={slot.rotation}>
          {/* 個別の大砲はインスタンスとして描画 */}
        </group>
      ))}
    </instancedMesh>
  );
};
```

### 4.5 LOD（Level of Detail）システム

遠方の船は簡略化して描画パフォーマンスを確保:

```typescript
// src/rendering/ship/ShipLOD.tsx
import { Detailed } from '@react-three/drei';

export const ShipWithLOD: React.FC<ShipRendererProps> = (props) => {
  return (
    <Detailed distances={[0, 200, 500, 1000]}>
      {/* LOD 0: フルディテール（近距離） */}
      <ShipRenderer {...props} detail="high" />

      {/* LOD 1: 大砲・ロープ非表示（中距離） */}
      <ShipRenderer {...props} detail="medium" />

      {/* LOD 2: 帆のアニメーション停止（遠距離） */}
      <ShipSimplified {...props} />

      {/* LOD 3: ビルボード（超遠距離） */}
      <ShipBillboard {...props} />
    </Detailed>
  );
};
```

---

## 5. テクスチャ & マテリアル戦略

### 5.1 テクスチャアトラス
船関連のテクスチャを少数のアトラスにまとめてドローコール削減:

```
TextureAtlas_Ships (2048x2048)
├── 船体木材テクスチャ (512x512) × 4種
├── 甲板テクスチャ (256x256) × 2種
├── 帆テクスチャ (512x512) × 3種
├── ロープテクスチャ (128x128) × 1種
└── 金属テクスチャ (256x256) × 3種

TextureAtlas_Emblems (1024x1024)
├── 紋章 (128x128) × 約50種
└── 旗 (128x64) × 12種（6ヶ国 × 2）
```

### 5.2 PBRマテリアル設定

```typescript
// 材質ごとのPBRパラメータ
const SHIP_MATERIALS: Record<ShipMaterial, MaterialParams> = {
  redpine:   { color: '#C4A882', roughness: 0.8, metalness: 0.0 },
  beech:     { color: '#B8956A', roughness: 0.75, metalness: 0.0 },
  elm:       { color: '#A0784C', roughness: 0.7, metalness: 0.0 },
  teak:      { color: '#8B6914', roughness: 0.65, metalness: 0.0 },
  oak:       { color: '#6B4226', roughness: 0.6, metalness: 0.0 },
  mahogany:  { color: '#4E2728', roughness: 0.55, metalness: 0.05 },
  copper:    { color: '#B87333', roughness: 0.3, metalness: 0.6 },
  rosewood:  { color: '#3B1F0A', roughness: 0.5, metalness: 0.05 },
  iron:      { color: '#71797E', roughness: 0.2, metalness: 0.8 },
};
```

---

## 6. アセット制作スケジュール

### Week 0: パイプライン構築（Phase 0 と並行）
- [ ] Blender → glTF エクスポート設定テンプレート作成
- [ ] gltfjsx 変換スクリプト作成
- [ ] AI生成ツールの評価（Meshy / Tripo を試用）
- [ ] パーツ命名規則・構造規則の確定

### Week 1-2: ベースモデル5種（Phase 1 と並行）
- [ ] AI生成 → 小型帆船ベース → Blender調整 → GLB
- [ ] AI生成 → 中型帆船ベース → Blender調整 → GLB
- [ ] AI生成 → 大型帆船ベース → Blender調整 → GLB
- [ ] AI生成 → ガレー船ベース → Blender調整 → GLB
- [ ] AI生成 → 東洋船ベース → Blender調整 → GLB
- [ ] 帆のモーフターゲット設定（膨らみ/畳み）
- [ ] 大砲モデル3種（小/中/大）

### Week 3-4: バリエーション展開（Phase 2 と並行）
- [ ] 各ベースから3-4種の派生船種を作成（スケール/パーツ増減）
- [ ] テクスチャアトラス作成
- [ ] 紋章テクスチャ作成（6ヶ国 + 海賊等）
- [ ] 船首像モデル5種
- [ ] LODモデル作成

### Week 5-6: 戦闘用アセット（Phase 3 と並行）
- [ ] 砲撃エフェクト（パーティクル）
- [ ] 損傷表現（テクスチャ + メッシュ）
- [ ] 沈没アニメーション
- [ ] 帆が燃えるエフェクト
- [ ] 波しぶきエフェクト

---

## 7. パフォーマンス最適化チェックリスト

- [ ] 全モデルのポリゴン数を船種ごとの上限以内に収める
- [ ] テクスチャは2のべき乗サイズ（256, 512, 1024）
- [ ] 同一マテリアルの船パーツはメッシュ結合
- [ ] 大砲はInstancedMeshで描画
- [ ] LODで遠方の船を簡略化
- [ ] 帆のアニメーションは頂点シェーダーで実行（CPU負荷軽減）
- [ ] 画面外の船はカリング
- [ ] glTF Draco圧縮でファイルサイズ削減
- [ ] KTX2テクスチャ圧縮（GPU圧縮テクスチャ）

---

## 8. 参考リンク

### AI 3D生成ツール
- Meshy AI: https://www.meshy.ai/
- Tripo AI: https://www.tripo3d.ai/
- SEELE: https://www.seeles.ai/
- Rodin: Hyper Human社

### 3Dアセットソース
- Sketchfab: https://sketchfab.com/
- CGTrader: https://www.cgtrader.com/
- TurboSquid: https://www.turbosquid.com/
- Poly Pizza: https://poly.pizza/

### Three.js / R3F 技術
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber/
- gltfjsx (GLTF→JSX変換): https://gltf.pmnd.rs/
- drei (便利コンポーネント集): https://github.com/pmndrs/drei
