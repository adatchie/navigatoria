import type { CSSProperties } from 'react'

const COMBAT_QUEST_ICON_URL = `${import.meta.env.BASE_URL}generated/quest/combat-wanted-poster.png`

type CombatQuestIconProps = {
  label?: string
  size?: number
}

export function CombatQuestIcon({ label = '討伐クエスト', size = 44 }: CombatQuestIconProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    display: 'inline-block',
    overflow: 'hidden',
    borderRadius: 8,
    border: '1px solid rgba(251, 146, 60, 0.34)',
    backgroundColor: 'rgba(6, 15, 28, 0.72)',
    backgroundImage: `url(${COMBAT_QUEST_ICON_URL})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'contain',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 18px rgba(0,0,0,0.22)',
  }

  return <span style={style} role="img" aria-label={label} title={label} />
}
