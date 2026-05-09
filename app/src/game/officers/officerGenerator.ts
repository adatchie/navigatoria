import type { Nationality, Officer, OfficerSpecialty, OfficerStats } from '@/types/character.ts'
import type { Port } from '@/types/port.ts'
import { createCharacterId } from '@/types/common.ts'

const SPECIALTIES: OfficerSpecialty[] = ['navigation', 'trade', 'gunnery', 'repair', 'leadership']

const SPECIALTY_DESCRIPTIONS: Record<OfficerSpecialty, string> = {
  navigation: '航路取りと操帆に長け、艦隊の速力と旋回を支える。',
  trade: '相場交渉と積荷管理に強く、売却益と船倉運用を助ける。',
  gunnery: '砲列指揮に通じ、戦術戦闘で砲撃力を底上げする。',
  repair: '船大工仕事に明るく、港での修理効率を上げる。',
  leadership: '当直と規律をまとめ、航海中の士気低下を抑える。',
}

const NAMES: Record<Nationality, string[]> = {
  portugal: ['Diogo Fernandes', 'Leonor Vaz', 'Tome Pires', 'Duarte Barbosa', 'Joao Rodrigues'],
  spain: ['Rodrigo de Triana', 'Beatriz de Mendoza', 'Juan de la Cosa', 'Ines de Vargas', 'Alonso Pinzon'],
  england: ['William Hawkins', 'Mary Frobisher', 'John Rut', 'Thomas Wyndham', 'Grace O Malley'],
  netherlands: ['Cornelis de Houtman', 'Pieter van der Meer', 'Anika Jansz', 'Dirck Gerritsz', 'Jan Huygen'],
  france: ['Jean Fleury', 'Marguerite Le Clerc', 'Pierre Crignon', 'Guillaume Le Testu', 'Jacques Cartier'],
  venice: ['Nicolo Zeno', 'Marco da Mosto', 'Bianca Contarini', 'Alvise Cadamosto', 'Pietro Querini'],
  ottoman: ['Piri Reis', 'Seydi Ali Reis', 'Ayla Hatun', 'Kemal Reis', 'Murat Reis'],
}

const SAMPLE_PORTRAIT_URL = 'generated/portraits/sample-navigator.jpg'

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

export function generateTavernOfficerOffers(port: Port, day: number, tavernLevel: number, playerFame = 0): Officer[] {
  const offerCount = Math.min(4, 2 + Math.floor(tavernLevel / 2))
  const baseSeed = hashSeed(`${port.id}:${day}:${tavernLevel}:${playerFame}`)
  const nationality = port.nationality
  const names = NAMES[nationality] ?? NAMES.portugal

  return Array.from({ length: offerCount }, (_, index) => {
    const seed = baseSeed + index * 101
    const specialty = pick(SPECIALTIES, seed + 7)
    const level = Math.min(10, Math.max(1, tavernLevel + Math.floor(playerFame / 450) + Math.floor(random(seed + 13) * 3)))
    const stats = buildStats(specialty, level, seed)
    const statTotal = Object.values(stats).reduce((sum, value) => sum + value, 0)
    const name = pick(names, seed + 19)

    return {
      id: createCharacterId(`officer:${port.id}:${day}:${index}:${name.toLowerCase().replaceAll(' ', '-')}`),
      name,
      nationality,
      specialty,
      stats,
      level,
      hireCost: 260 + level * 120 + statTotal * 18,
      salary: 18 + level * 7 + Math.round(statTotal * 1.6),
      portraitUrl: SAMPLE_PORTRAIT_URL,
      description: SPECIALTY_DESCRIPTIONS[specialty],
    }
  })
}
