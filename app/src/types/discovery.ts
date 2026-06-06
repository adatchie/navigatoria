import type { PortId, Position2D, SkillId } from './common.ts'

export type DiscoveryCategory = 'geography' | 'ruins' | 'treasure' | 'natural' | 'legend'
export type DiscoveryMethod = 'sighting' | 'search'

export interface DiscoverySkillRequirement {
  skillId: SkillId
  rank: number
}

export interface Discovery {
  id: string
  name: string
  nameEn: string
  category: DiscoveryCategory
  method: DiscoveryMethod
  description: string
  position: Position2D
  radiusKm: number
  rank: number
  requiredSkill: DiscoverySkillRequirement
  appraisalSkill?: DiscoverySkillRequirement
  reportPortId: PortId
  exp: number
  fame: number
  hints: string[]
}
