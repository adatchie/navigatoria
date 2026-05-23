import portraitDbRaw from '@/data/master/officerPortraits.json'
import type { Nationality, Officer, OfficerGender, OfficerSpecialty } from '@/types/character.ts'
import type { CultureZone, Port } from '@/types/port.ts'

type PortraitNationality = Nationality | 'local'
type PortraitCulture = CultureZone | 'local'
type PortraitRole =
  | 'barmaid'
  | 'navigator'
  | 'merchant'
  | 'scholar'
  | 'shipwright'
  | 'officer'
  | 'guild_master'
  | 'noble'
  | 'mercenary'
  | 'sailor'
  | 'corsair'
  | 'missionary'

interface OfficerPortraitRecord {
  id: string
  assetUrl: string
  role: PortraitRole
  nationality: PortraitNationality
  portName: string
  portId: string | null
  culture: PortraitCulture
  age: string
  gender: OfficerGender
  period: string
  faceAngle: string
  setting: string
  mood: string
  sourceImageFileName: string
  sourceRecordId: string
  notes: string
}

interface PortraitAssignment {
  enabled?: boolean
  portraitId?: string
  portId?: string
  officerId?: string
  officerName?: string
  nationality?: PortraitNationality
  specialty?: OfficerSpecialty
  gender?: OfficerGender
  allowDuplicateInPort?: boolean
}

interface OfficerPortraitDatabase {
  fallbackPortraitUrl: string
  manualAssignments?: PortraitAssignment[]
  portraits: OfficerPortraitRecord[]
}

const portraitDb = portraitDbRaw as OfficerPortraitDatabase
const portraitsById = new Map(portraitDb.portraits.map((portrait) => [portrait.id, portrait]))

const NATIONALITY_CULTURE: Record<Nationality, CultureZone> = {
  portugal: 'west_europe',
  spain: 'west_europe',
  england: 'north_europe',
  netherlands: 'north_europe',
  france: 'west_europe',
  venice: 'west_europe',
  ottoman: 'islamic',
}

const LOCAL_PORTRAIT_CULTURES = new Set<CultureZone>(['africa', 'indian', 'southeast_asia', 'east_asia', 'new_world'])

const SPECIALTY_ROLE_SCORES: Record<OfficerSpecialty, Partial<Record<PortraitRole, number>>> = {
  navigation: {
    navigator: 72,
    sailor: 42,
    officer: 30,
    scholar: 16,
    missionary: 8,
  },
  trade: {
    merchant: 72,
    sailor: 28,
    noble: 28,
    scholar: 20,
    guild_master: 18,
    barmaid: 8,
  },
  gunnery: {
    officer: 68,
    mercenary: 62,
    corsair: 54,
    sailor: 32,
  },
  repair: {
    shipwright: 76,
    sailor: 36,
    navigator: 20,
    officer: 12,
  },
  leadership: {
    officer: 72,
    mercenary: 38,
    noble: 34,
    sailor: 30,
    guild_master: 26,
    corsair: 22,
  },
}

const SPECIALTY_KEYWORDS: Record<OfficerSpecialty, string[]> = {
  navigation: ['航路', '水先', '案内', '海図', '季節風', '沿岸', '航海', '読む'],
  trade: ['交易', '商人', '仲買', '荷', '倉庫', '相場', '香辛料', '絹'],
  gunnery: ['士官', '傭兵', '海賊', '護衛', '私掠', '戦', '砲', '警戒'],
  repair: ['船大工', '修理', '造船', '艤装', '職人'],
  leadership: ['士官', '貴族', '幹部', '組合', '威厳', '指揮', '護衛'],
}

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function getKeywordScore(portrait: OfficerPortraitRecord, specialty: OfficerSpecialty): number {
  const text = `${portrait.role} ${portrait.setting} ${portrait.mood}`
  return SPECIALTY_KEYWORDS[specialty].reduce((score, keyword) => score + (text.includes(keyword) ? 4 : 0), 0)
}

function scorePortrait(portrait: OfficerPortraitRecord, officer: Officer, port: Port): number {
  let score = SPECIALTY_ROLE_SCORES[officer.specialty][portrait.role] ?? 0

  if (portrait.portId === port.id) score += 28
  if (portrait.nationality === officer.nationality) score += 32
  if (portrait.culture === port.culture) score += 20
  if (portrait.culture === NATIONALITY_CULTURE[officer.nationality]) score += 8
  if (portrait.nationality === 'local' && LOCAL_PORTRAIT_CULTURES.has(port.culture)) score += 24

  if (officer.gender && officer.gender !== 'unspecified') {
    score += portrait.gender === officer.gender ? 20 : -30
  }

  if (portrait.role === 'barmaid') score -= officer.specialty === 'trade' && portrait.gender === officer.gender ? 12 : 46
  if (portrait.role === 'guild_master') score -= officer.specialty === 'trade' || officer.specialty === 'leadership' ? 4 : 24
  if (portrait.role === 'noble' && officer.specialty !== 'trade' && officer.specialty !== 'leadership') score -= 10

  score += getKeywordScore(portrait, officer.specialty)
  score += hashSeed(`${officer.id}:${portrait.id}`) % 7
  return score
}

function assignmentMatches(assignment: PortraitAssignment, officer: Officer, port: Port): boolean {
  if (assignment.enabled === false || !assignment.portraitId) return false
  if (assignment.portId && assignment.portId !== port.id) return false
  if (assignment.officerId && assignment.officerId !== officer.id) return false
  if (assignment.officerName && assignment.officerName !== officer.name) return false
  if (assignment.nationality && assignment.nationality !== officer.nationality) return false
  if (assignment.specialty && assignment.specialty !== officer.specialty) return false
  if (assignment.gender && assignment.gender !== officer.gender) return false
  return true
}

function pickManualPortrait(officer: Officer, port: Port, usedPortraitIds: Set<string>): { portrait: OfficerPortraitRecord; allowDuplicate: boolean } | null {
  for (const assignment of portraitDb.manualAssignments ?? []) {
    if (!assignmentMatches(assignment, officer, port)) continue
    const portrait = portraitsById.get(assignment.portraitId!)
    if (!portrait) continue
    if (!assignment.allowDuplicateInPort && usedPortraitIds.has(portrait.id)) continue
    return { portrait, allowDuplicate: assignment.allowDuplicateInPort === true }
  }
  return null
}

function pickScoredPortrait(officer: Officer, port: Port, usedPortraitIds: Set<string>, avoidUsed: boolean): OfficerPortraitRecord | undefined {
  return portraitDb.portraits
    .filter((portrait) => !avoidUsed || !usedPortraitIds.has(portrait.id))
    .map((portrait) => ({ portrait, score: scorePortrait(portrait, officer, port) }))
    .sort((a, b) => b.score - a.score || hashSeed(`${officer.id}:${b.portrait.id}`) - hashSeed(`${officer.id}:${a.portrait.id}`))[0]
    ?.portrait
}

export function assignOfficerPortraits(port: Port, officers: Officer[]): Officer[] {
  const usedPortraitIds = new Set<string>()

  return officers.map((officer) => {
    const manual = pickManualPortrait(officer, port, usedPortraitIds)
    const portrait = manual?.portrait ?? pickScoredPortrait(officer, port, usedPortraitIds, true) ?? pickScoredPortrait(officer, port, usedPortraitIds, false)

    if (!portrait) {
      return { ...officer, portraitUrl: portraitDb.fallbackPortraitUrl }
    }

    if (!manual?.allowDuplicate) usedPortraitIds.add(portrait.id)
    return {
      ...officer,
      portraitId: portrait.id,
      portraitUrl: portrait.assetUrl,
    }
  })
}
