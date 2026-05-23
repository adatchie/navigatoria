import portraitDbRaw from '@/data/master/officerPortraits.json'

interface OfficerPortraitRecord {
  id: string
  assetUrl: string
}

interface OfficerPortraitDatabase {
  fallbackPortraitUrl: string
  portraits: OfficerPortraitRecord[]
}

const portraitDb = portraitDbRaw as OfficerPortraitDatabase
const portraitsById = new Map(portraitDb.portraits.map((portrait) => [portrait.id, portrait]))

export function getOfficerPortraitUrl(portraitId?: string): string {
  if (!portraitId) return portraitDb.fallbackPortraitUrl
  return portraitsById.get(portraitId)?.assetUrl ?? portraitDb.fallbackPortraitUrl
}
