import officersDbRaw from '@/data/master/officers.json'
import type { Nationality, Officer, OfficerGender, OfficerSpecialty, OfficerStats } from '@/types/character.ts'
import type { Port } from '@/types/port.ts'
import { createCharacterId } from '@/types/common.ts'
import { getOfficerPortraitUrl } from '@/game/officers/officerPortraits.ts'

interface MasterOfficerRecord {
  id: string
  name: string
  firstName: string
  familyName: string
  nationality: Nationality
  gender: OfficerGender
  specialty: OfficerSpecialty
  level: number
  stats: OfficerStats
  hireCost: number
  salary: number
  portraitId: string
  homePortId: string
  availablePortIds: string[]
  minTavernLevel: number
  minFame: number
  displayOrder: number
  description: string
}

interface OfficerMasterDatabase {
  officers: MasterOfficerRecord[]
}

const officersDb = officersDbRaw as OfficerMasterDatabase

const EPITHETS = ['鋭眼', '碧眼', '黒髪', '金髪', '赤髪', '美髯', '端麗', '豪胆', '寡黙', '温顔', '俊英', '老練', '剛毅', '沈着']

const LEGACY_NAME_OVERRIDES: Record<string, string> = {
  'Diogo Fernandes': '羅針のディオゴ',
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

export function localizeOfficerName(name: string, seed = 0): string {
  const trimmedName = name.trim()
  const legacyName = LEGACY_NAME_OVERRIDES[trimmedName] ?? Object.entries(LEGACY_NAME_OVERRIDES).find(([legacyKey]) => normalizeAsciiName(legacyKey) === normalizeAsciiName(trimmedName))?.[1]
  if (legacyName) return legacyName
  if (isAsciiName(trimmedName)) return `${pick(EPITHETS, seed + 29)}の航士`
  if (countDisplayChars(trimmedName) <= 10) return trimmedName
  return `${pick(EPITHETS, seed + 29)}の${Array.from(trimmedName).slice(0, 5).join('')}`
}

export function getOfficerSpecialtyLabel(specialty: OfficerSpecialty): string {
  if (specialty === 'navigation') return '航海'
  if (specialty === 'trade') return '交易'
  if (specialty === 'gunnery') return '砲術'
  if (specialty === 'repair') return '修理'
  return '統率'
}

function toOfficer(record: MasterOfficerRecord, port: Port): Officer {
  return {
    id: createCharacterId(record.id),
    name: record.name,
    nationality: record.nationality,
    specialty: record.specialty,
    gender: record.gender,
    originPortId: port.id,
    stats: record.stats,
    level: record.level,
    hireCost: record.hireCost,
    salary: record.salary,
    portraitId: record.portraitId,
    portraitUrl: getOfficerPortraitUrl(record.portraitId),
    description: record.description,
  }
}

function rotateRecords(records: MasterOfficerRecord[], day: number, portId: string): MasterOfficerRecord[] {
  if (records.length === 0) return records
  const offset = (Math.floor(day) + hashSeed(portId)) % records.length
  return [...records.slice(offset), ...records.slice(0, offset)]
}

export function generateTavernOfficerOffers(
  port: Port,
  day: number,
  tavernLevel: number,
  playerFame = 0,
  unavailableOfficerIds: readonly string[] = [],
): Officer[] {
  const offerCount = Math.min(4, 2 + Math.floor(tavernLevel / 2))
  const unavailable = new Set(unavailableOfficerIds)
  const eligible = officersDb.officers
    .filter((officer) => officer.availablePortIds.includes(port.id))
    .filter((officer) => officer.minTavernLevel <= tavernLevel && officer.minFame <= playerFame)
    .filter((officer) => !unavailable.has(officer.id) && !unavailable.has(officer.name))
    .sort((a, b) => a.displayOrder - b.displayOrder)

  return rotateRecords(eligible, day, port.id)
    .slice(0, offerCount)
    .map((officer) => toOfficer(officer, port))
}
