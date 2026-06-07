import type { CSSProperties } from 'react'

const publicBase = import.meta.env.BASE_URL

export const antiqueAssets = {
  titleChart: `${publicBase}generated/ui/captains-desk-chart-bg.png`,
  parchmentTile: `${publicBase}generated/ui/parchment-tile.png`,
  darkOakTile: `${publicBase}generated/ui/dark-oak-tile.png`,
  brassButtonWide: `${publicBase}generated/ui/brass-button-wide.png`,
  ledgerRow: `${publicBase}generated/ui/ledger-row.png`,
  ledgerPanel: `${publicBase}generated/ui/ledger-panel.png`,
  ledgerCardLarge: `${publicBase}generated/ui/ledger-card-large.png`,
  compassRose: `${publicBase}generated/ui/svg/compass-rose.svg`,
  cornerFlourish: `${publicBase}generated/ui/svg/corner-flourish-tl.svg`,
  ornamentDivider: `${publicBase}generated/ui/svg/ornament-divider.svg`,
  quillPen: `${publicBase}generated/ui/svg/quill-pen.svg`,
  waxSeal: `${publicBase}generated/ui/svg/wax-seal.svg`,
} as const

export const antiqueColors = {
  parchment: '#f4e8c1',
  parchmentDark: '#d4c4a0',
  parchmentEdge: '#c8b88a',
  ink: '#2c1810',
  inkLight: '#5a3d2b',
  inkFaded: '#5f4331',
  brass: '#b8860b',
  brassLight: '#d4a843',
  brassBright: '#e8b86d',
  brassDark: '#8b6508',
  goldLeaf: '#c5a044',
  wood: '#3e2723',
  woodLight: '#5d4037',
  sealRed: '#8b1a1a',
  oceanDeep: '#0a1628',
  oceanPanel: 'rgba(13, 17, 23, 0.86)',
  candle: '#f5deb3',
} as const

export const antiqueFonts = {
  title: '"Times New Roman", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif',
  body: '"Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif',
  ui: '"Yu Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  mono: '"Consolas", "Yu Gothic", monospace',
} as const

const parchmentBackground = [
  `linear-gradient(135deg, rgba(250, 238, 198, 0.92), rgba(232, 213, 163, 0.9))`,
  `url("${antiqueAssets.parchmentTile}")`,
].join(', ')

const woodBackground = [
  'linear-gradient(180deg, rgba(74, 50, 40, 0.92), rgba(44, 24, 16, 0.96))',
  `url("${antiqueAssets.darkOakTile}")`,
].join(', ')

export const antiqueStyles = {
  parchmentSurface: {
    color: antiqueColors.ink,
    backgroundColor: '#efe0b2',
    backgroundImage: parchmentBackground,
    backgroundSize: 'auto, 420px 420px',
    border: `1px solid ${antiqueColors.parchmentEdge}`,
    borderRadius: 4,
    boxShadow: 'inset 0 0 30px rgba(139, 101, 8, 0.16), 0 12px 34px rgba(44, 24, 16, 0.24)',
    fontFamily: antiqueFonts.body,
  },
  woodSurface: {
    color: antiqueColors.parchment,
    backgroundColor: antiqueColors.wood,
    backgroundImage: woodBackground,
    backgroundSize: 'auto, 520px 520px',
    border: `1px solid ${antiqueColors.brassDark}`,
    borderRadius: 4,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 10px 28px rgba(0, 0, 0, 0.38)',
    fontFamily: antiqueFonts.body,
  },
  brassButton: {
    minHeight: 40,
    borderRadius: 3,
    border: `1px solid ${antiqueColors.brassDark}`,
    backgroundColor: antiqueColors.brass,
    backgroundImage: `linear-gradient(180deg, rgba(232,184,109,0.2), rgba(80,48,7,0.08)), url("${antiqueAssets.brassButtonWide}")`,
    backgroundSize: '100% 100%',
    backgroundPosition: 'center',
    color: antiqueColors.ink,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 3px 0 rgba(44, 24, 16, 0.45)',
    cursor: 'pointer',
    fontFamily: antiqueFonts.body,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  ledgerCard: {
    color: antiqueColors.ink,
    backgroundColor: '#efe0b2',
    backgroundImage: parchmentBackground,
    backgroundSize: 'auto, 360px 360px',
    backgroundPosition: 'center',
    border: '18px solid transparent',
    borderImageSource: `url("${antiqueAssets.ledgerRow}")`,
    borderImageSlice: '42 48 42 48',
    borderImageWidth: '18px 20px',
    borderImageRepeat: 'stretch',
    borderRadius: 3,
    boxShadow: 'inset 0 0 18px rgba(90,61,43,0.1), 0 2px 0 rgba(44,24,16,0.12)',
    fontFamily: antiqueFonts.body,
  },
  ledgerPanel: {
    color: antiqueColors.ink,
    backgroundColor: '#efe0b2',
    backgroundImage: parchmentBackground,
    backgroundSize: 'auto, 420px 420px',
    backgroundPosition: 'center',
    border: '32px solid transparent',
    borderImageSource: `url("${antiqueAssets.ledgerCardLarge}")`,
    borderImageSlice: '58 48 58 48',
    borderImageWidth: '32px 26px',
    borderImageRepeat: 'stretch',
    borderRadius: 3,
    boxShadow: 'inset 0 0 28px rgba(90,61,43,0.12), 0 2px 0 rgba(44,24,16,0.12)',
    fontFamily: antiqueFonts.body,
  },
  paperCard: {
    color: antiqueColors.ink,
    backgroundColor: '#f1e0ac',
    backgroundImage: parchmentBackground,
    backgroundSize: 'auto, 360px 360px',
    backgroundPosition: 'center',
    border: '1px solid rgba(90,61,43,0.42)',
    borderRadius: 3,
    boxShadow: 'inset 0 0 14px rgba(90,61,43,0.1), 0 1px 0 rgba(44,24,16,0.14)',
    fontFamily: antiqueFonts.body,
  },
  brassFlatButton: {
    minHeight: 38,
    borderRadius: 3,
    border: `1px solid ${antiqueColors.brassDark}`,
    background: `linear-gradient(180deg, ${antiqueColors.brassBright}, ${antiqueColors.brass})`,
    color: antiqueColors.ink,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 2px 0 rgba(44, 24, 16, 0.42)',
    cursor: 'pointer',
    fontFamily: antiqueFonts.body,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  woodButton: {
    minHeight: 40,
    borderRadius: 3,
    border: `1px solid ${antiqueColors.brassDark}`,
    backgroundColor: antiqueColors.wood,
    backgroundImage: woodBackground,
    backgroundSize: 'auto, 360px 360px',
    color: antiqueColors.candle,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 3px 0 rgba(20, 10, 6, 0.5)',
    cursor: 'pointer',
    fontFamily: antiqueFonts.body,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  inkLabel: {
    color: antiqueColors.inkFaded,
    fontSize: 11,
    letterSpacing: '0.08em',
  },
  smallCaps: {
    fontFamily: antiqueFonts.title,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  oceanPanel: {
    color: antiqueColors.candle,
    background: antiqueColors.oceanPanel,
    border: '1px solid rgba(201, 151, 92, 0.28)',
    borderRadius: 4,
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.34), inset 0 0 18px rgba(0, 0, 0, 0.18)',
    backdropFilter: 'blur(6px)',
    fontFamily: antiqueFonts.body,
  },
} satisfies Record<string, CSSProperties>

export function withAntiqueHover(base: CSSProperties): CSSProperties {
  return {
    ...base,
    transition: 'transform 140ms ease, border-color 140ms ease, filter 140ms ease, background-color 140ms ease',
  }
}
