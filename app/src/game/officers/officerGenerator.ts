import type { Nationality, Officer, OfficerGender, OfficerSpecialty, OfficerStats } from '@/types/character.ts'
import type { Port } from '@/types/port.ts'
import { createCharacterId } from '@/types/common.ts'
import { assignOfficerPortraits } from '@/game/officers/officerPortraits.ts'

const SPECIALTIES: OfficerSpecialty[] = ['navigation', 'trade', 'gunnery', 'repair', 'leadership']

const SPECIALTY_DESCRIPTIONS: Record<OfficerSpecialty, string> = {
  navigation: '航路取りと操帆に長け、艦隊の速力と旋回を支える。',
  trade: '相場交渉と積荷管理に強く、売却益と船倉運用を助ける。',
  gunnery: '砲列指揮に通じ、戦術戦闘で砲撃力を底上げする。',
  repair: '船大工仕事に明るく、港での修理効率を上げる。',
  leadership: '当直と規律をまとめ、航海中の士気低下を抑える。',
}

interface OfficerNameSeed {
  first: string
  family: string
}

const NAME_MAX_CHARS = 10
const EPITHETS = ['鋭眼', '碧眼', '黒髪', '金髪', '赤髪', '美髯', '端麗', '豪胆', '寡黙', '温顔', '俊英', '老練', '剛毅', '沈着']
const FEMALE_FIRST_NAMES = new Set([
  'レオノール',
  'カタリナ',
  'イザベル',
  'ベアトリス',
  'イネス',
  'ルシア',
  'メアリ',
  'グレイス',
  'エリノア',
  'アン',
  'マーガレット',
  'アニカ',
  'マルテ',
  'エルス',
  'リスベット',
  'マルグリット',
  'アニエス',
  'イザボー',
  'ビアンカ',
  'ルチア',
  'カテリーナ',
  'オルサ',
  'アイラ',
  'レイラ',
  'ゼイネプ',
])

const NAMES: Record<Nationality, OfficerNameSeed[]> = {
  portugal: [
    { first: 'ディオゴ', family: 'フェルナンデス' },
    { first: 'レオノール', family: 'ヴァス' },
    { first: 'トメ', family: 'ピレス' },
    { first: 'ドゥアルテ', family: 'バルボザ' },
    { first: 'ジョアン', family: 'ロドリゲス' },
    { first: 'マヌエル', family: 'ペレイラ' },
    { first: 'アフォンソ', family: 'コレイア' },
    { first: 'カタリナ', family: 'ソアレス' },
    { first: 'ガスパル', family: 'デ・レモス' },
    { first: 'ルイ', family: 'コエリョ' },
    { first: 'イザベル', family: 'アルメイダ' },
    { first: 'シモン', family: 'ゴンサルヴェス' },
  ],
  spain: [
    { first: 'ロドリゴ', family: 'デ・トリアナ' },
    { first: 'ベアトリス', family: 'メンドーサ' },
    { first: 'フアン', family: 'デ・ラ・コサ' },
    { first: 'イネス', family: 'バルガス' },
    { first: 'アロンソ', family: 'ピンソン' },
    { first: 'ミゲル', family: 'エスピノサ' },
    { first: 'カタリナ', family: 'デ・ルナ' },
    { first: 'エルナン', family: 'サルセド' },
    { first: 'ディエゴ', family: 'メンドーサ' },
    { first: 'ルシア', family: 'アギーレ' },
    { first: 'ペドロ', family: 'ナバロ' },
    { first: 'マルティン', family: 'オルティス' },
  ],
  england: [
    { first: 'ウィリアム', family: 'ホーキンズ' },
    { first: 'メアリ', family: 'フロビシャー' },
    { first: 'ジョン', family: 'ラット' },
    { first: 'トマス', family: 'ウィンダム' },
    { first: 'グレイス', family: 'オマリー' },
    { first: 'リチャード', family: 'グレンヴィル' },
    { first: 'エリノア', family: 'ブレイク' },
    { first: 'エドワード', family: 'フェントン' },
    { first: 'アン', family: 'クリフォード' },
    { first: 'ロバート', family: 'クロフト' },
    { first: 'ヘンリー', family: 'パーマー' },
    { first: 'マーガレット', family: 'アッシュリー' },
  ],
  netherlands: [
    { first: 'コルネリス', family: 'ハウトマン' },
    { first: 'ピーテル', family: 'ファン・デル・メール' },
    { first: 'アニカ', family: 'ヤンス' },
    { first: 'ディルク', family: 'ヘリッツ' },
    { first: 'ヤン', family: 'ホイヘン' },
    { first: 'ヘンドリク', family: 'ブロウワー' },
    { first: 'マルテ', family: 'デ・フリース' },
    { first: 'ウィレム', family: 'バレンツ' },
    { first: 'エルス', family: 'クラース' },
    { first: 'アドリアン', family: 'ブロック' },
    { first: 'リスベット', family: 'スミット' },
    { first: 'ヨリス', family: 'ファン・スピルベルゲン' },
  ],
  france: [
    { first: 'ジャン', family: 'フルーリ' },
    { first: 'マルグリット', family: 'ルクレール' },
    { first: 'ピエール', family: 'クリニョン' },
    { first: 'ギヨーム', family: 'ル・テストゥ' },
    { first: 'ジャック', family: 'カルティエ' },
    { first: 'エティエンヌ', family: 'マルシャン' },
    { first: 'アニエス', family: 'ド・ヴィルヌーヴ' },
    { first: 'ルネ', family: 'グーレーヌ' },
    { first: 'クロード', family: 'ダンジェ' },
    { first: 'シャルル', family: 'デュボワ' },
    { first: 'イザボー', family: 'マルタン' },
    { first: 'ニコラ', family: 'ルージュ' },
  ],
  venice: [
    { first: 'ニコロ', family: 'ゼノ' },
    { first: 'マルコ', family: 'ダ・モスト' },
    { first: 'ビアンカ', family: 'コンタリーニ' },
    { first: 'アルヴィーゼ', family: 'カダモスト' },
    { first: 'ピエトロ', family: 'クエリーニ' },
    { first: 'アントニオ', family: 'グリマーニ' },
    { first: 'ルチア', family: 'ヴェニエル' },
    { first: 'ロレンツォ', family: 'ロレダン' },
    { first: 'カテリーナ', family: 'バルバリゴ' },
    { first: 'ジローラモ', family: 'プリウリ' },
    { first: 'フェデリコ', family: 'モチェニーゴ' },
    { first: 'オルサ', family: 'ダンドロ' },
  ],
  ottoman: [
    { first: 'ピーリー', family: 'レイス' },
    { first: 'セイディ', family: 'アリ・レイス' },
    { first: 'アイラ', family: 'ハトゥン' },
    { first: 'ケマル', family: 'レイス' },
    { first: 'ムラト', family: 'レイス' },
    { first: 'シナン', family: 'パシャ' },
    { first: 'レイラ', family: 'ハトゥン' },
    { first: 'サリフ', family: 'レイス' },
    { first: 'ハサン', family: 'アーガ' },
    { first: 'ナスフ', family: 'マトラクチ' },
    { first: 'メフメト', family: 'チェレビ' },
    { first: 'ゼイネプ', family: 'ハトゥン' },
  ],
}

const SAMPLE_PORTRAIT_URL = 'generated/portraits/sample-navigator.jpg'
const LEGACY_NAME_OVERRIDES: Record<string, string> = {
  'Diogo Fernandes': '鋭眼のディオゴ',
  'Leonor Vaz': 'レオノール・ヴァス',
  'Tome Pires': 'トメ・ピレス',
  'Duarte Barbosa': '沈着のドゥアルテ',
  'Joao Rodrigues': '温顔のジョアン',
  'Rodrigo de Triana': '鋭眼のロドリゴ',
  'Beatriz de Mendoza': '碧眼のベアトリス',
  'Juan de la Cosa': 'フアン・デ・ラ・コサ',
  'Ines de Vargas': 'イネス・バルガス',
  'Alonso Pinzon': 'アロンソ・ピンソン',
  'William Hawkins': '豪胆のウィリアム',
  'Mary Frobisher': '寡黙のメアリ',
  'John Rut': 'ジョン・ラット',
  'Thomas Wyndham': 'トマス・ウィンダム',
  'Grace O Malley': 'グレイス・オマリー',
  'Cornelis de Houtman': '俊英のコルネリス',
  'Pieter van der Meer': '温顔のピーテル',
  'Anika Jansz': 'アニカ・ヤンス',
  'Dirck Gerritsz': 'ディルク・ヘリッツ',
  'Jan Huygen': 'ヤン・ホイヘン',
  'Jean Fleury': 'ジャン・フルーリ',
  'Marguerite Le Clerc': '端麗のマルグリット',
  'Pierre Crignon': 'ピエール・クリニョン',
  'Guillaume Le Testu': '老練のギヨーム',
  'Jacques Cartier': 'ジャック・カルティエ',
  'Nicolo Zeno': 'ニコロ・ゼノ',
  'Marco da Mosto': 'マルコ・ダ・モスト',
  'Bianca Contarini': '碧眼のビアンカ',
  'Alvise Cadamosto': '沈着のアルヴィーゼ',
  'Pietro Querini': 'ピエトロ・クエリーニ',
  'Piri Reis': 'ピーリー・レイス',
  'Seydi Ali Reis': '鋭眼のセイディ',
  'Ayla Hatun': 'アイラ・ハトゥン',
  'Kemal Reis': 'ケマル・レイス',
  'Murat Reis': 'ムラト・レイス',
}

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function random(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function pick<T>(items: T[], seed: number): T {
  return items[Math.floor(random(seed) * items.length)] ?? items[0]!
}

function countDisplayChars(value: string): number {
  return Array.from(value).length
}

function isAsciiName(value: string): boolean {
  return Array.from(value).every((char) => char.charCodeAt(0) <= 0x7F)
}

function normalizeAsciiName(value: string): string {
  return value
    .trim()
    .replace(/[’']/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function buildOfficerName(name: OfficerNameSeed, seed: number): string {
  const fullName = `${name.first}・${name.family}`
  if (countDisplayChars(fullName) <= NAME_MAX_CHARS) return fullName
  return `${pick(EPITHETS, seed + 29)}の${name.first}`
}

function inferOfficerGender(name: OfficerNameSeed): OfficerGender {
  return FEMALE_FIRST_NAMES.has(name.first) ? 'female' : 'male'
}

function getOfficerBaseName(displayName: string): string {
  const localizedName = localizeOfficerName(displayName)
  const epithetIndex = localizedName.lastIndexOf('の')
  if (epithetIndex >= 0) return localizedName.slice(epithetIndex + 1)
  return localizedName.split('・')[0] ?? localizedName
}

function buildNamePool(nationality: Nationality): OfficerNameSeed[] {
  const localNames = NAMES[nationality] ?? NAMES.portugal
  const seenFirstNames = new Set(localNames.map((name) => name.first))
  const otherNames = Object.entries(NAMES)
    .filter(([entryNationality]) => entryNationality !== nationality)
    .flatMap(([, entryNames]) => entryNames)
    .filter((name) => {
      if (seenFirstNames.has(name.first)) return false
      seenFirstNames.add(name.first)
      return true
    })

  return [...localNames, ...otherNames]
}

function createOfficerOffer(
  port: Port,
  day: number,
  tavernLevel: number,
  playerFame: number,
  namePool: OfficerNameSeed[],
  attempt: number,
): Officer {
  const baseSeed = hashSeed(`${port.id}:${day}:${tavernLevel}:${playerFame}`)
  const seed = baseSeed + attempt * 101
  const specialty = pick(SPECIALTIES, seed + 7)
  const level = Math.min(10, Math.max(1, tavernLevel + Math.floor(playerFame / 450) + Math.floor(random(seed + 13) * 3)))
  const stats = buildStats(specialty, level, seed)
  const statTotal = Object.values(stats).reduce((sum, value) => sum + value, 0)
  const nameSeed = pick(namePool, seed + 19)
  const name = buildOfficerName(nameSeed, seed)

  return {
    id: createCharacterId(`officer:${port.id}:${day}:${attempt}:${hashSeed(name).toString(36)}`),
    name,
    nationality: port.nationality,
    specialty,
    gender: inferOfficerGender(nameSeed),
    stats,
    level,
    hireCost: 260 + level * 120 + statTotal * 18,
    salary: 18 + level * 7 + Math.round(statTotal * 1.6),
    portraitUrl: SAMPLE_PORTRAIT_URL,
    description: SPECIALTY_DESCRIPTIONS[specialty],
  }
}

export function localizeOfficerName(name: string, seed = 0): string {
  const trimmedName = name.trim()
  const legacyName = LEGACY_NAME_OVERRIDES[trimmedName] ?? Object.entries(LEGACY_NAME_OVERRIDES).find(([legacyKey]) => normalizeAsciiName(legacyKey) === normalizeAsciiName(trimmedName))?.[1]
  if (legacyName) return legacyName
  if (isAsciiName(trimmedName)) return `${pick(EPITHETS, seed + 29)}の航士`
  if (countDisplayChars(trimmedName) <= NAME_MAX_CHARS) return trimmedName
  return `${pick(EPITHETS, seed + 29)}の${Array.from(trimmedName).slice(0, 5).join('')}`
}

function buildStats(specialty: OfficerSpecialty, level: number, seed: number): OfficerStats {
  const stats: OfficerStats = {
    navigation: 1 + Math.floor(random(seed + 11) * level),
    trade: 1 + Math.floor(random(seed + 23) * level),
    gunnery: 1 + Math.floor(random(seed + 37) * level),
    repair: 1 + Math.floor(random(seed + 41) * level),
    leadership: 1 + Math.floor(random(seed + 53) * level),
  }
  stats[specialty] = Math.min(10, stats[specialty] + 2 + Math.floor(level / 2))
  return stats
}

export function getOfficerSpecialtyLabel(specialty: OfficerSpecialty): string {
  if (specialty === 'navigation') return '航海'
  if (specialty === 'trade') return '交易'
  if (specialty === 'gunnery') return '砲術'
  if (specialty === 'repair') return '修理'
  return '統率'
}

export function generateTavernOfficerOffers(
  port: Port,
  day: number,
  tavernLevel: number,
  playerFame = 0,
  unavailableOfficerNames: readonly string[] = [],
): Officer[] {
  const offerCount = Math.min(4, 2 + Math.floor(tavernLevel / 2))
  const nationality = port.nationality
  const localNames = NAMES[nationality] ?? NAMES.portugal
  const fallbackNames = buildNamePool(nationality)
  const usedDisplayNames = new Set(unavailableOfficerNames.map((name) => localizeOfficerName(name)))
  const usedBaseNames = new Set(unavailableOfficerNames.map(getOfficerBaseName))
  const offers: Officer[] = []

  function addUniqueOffers(namePool: OfficerNameSeed[], attemptOffset: number) {
    const maxAttempts = Math.max(offerCount * 12, namePool.length * 2)
    for (let attempt = 0; offers.length < offerCount && attempt < maxAttempts; attempt += 1) {
      const officer = createOfficerOffer(port, day, tavernLevel, playerFame, namePool, attemptOffset + attempt)
      const displayName = localizeOfficerName(officer.name)
      const baseName = getOfficerBaseName(displayName)

      if (usedDisplayNames.has(displayName) || usedBaseNames.has(baseName)) continue
      usedDisplayNames.add(displayName)
      usedBaseNames.add(baseName)
      offers.push(officer)
    }
  }

  addUniqueOffers(localNames, 0)
  if (offers.length < offerCount) addUniqueOffers(fallbackNames, localNames.length * 3)

  return assignOfficerPortraits(port, offers)
}
