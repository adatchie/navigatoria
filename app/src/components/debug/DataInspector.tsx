// ============================================================
// DataInspector — マスタデータ閲覧・編集UI
// ============================================================

import { useState } from 'react'
import { useDataStore } from '@/stores/useDataStore.ts'

type DataCategory = 'ships' | 'ports' | 'tradeGoods' | 'skills'

const CATEGORY_LABELS: Record<DataCategory, string> = {
  ships: '船種',
  ports: '港',
  tradeGoods: '交易品',
  skills: 'スキル',
}

export function DataInspector() {
  const [category, setCategory] = useState<DataCategory>('ships')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { masterData, overrides, removeOverride } = useDataStore()

  const items = masterData[category] as unknown as Array<{ id: string; name: string; [key: string]: unknown }>

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📊 Data Inspector</h3>

      {/* カテゴリタブ */}
      <div style={styles.tabs}>
        {(Object.keys(CATEGORY_LABELS) as DataCategory[]).map((cat) => (
          <button
            key={cat}
            style={{
              ...styles.tab,
              ...(category === cat ? styles.activeTab : {}),
            }}
            onClick={() => {
              setCategory(cat)
              setSelectedId(null)
            }}
          >
            {CATEGORY_LABELS[cat]} ({masterData[cat].length})
          </button>
        ))}
      </div>

      {/* アイテムリスト */}
      <div style={styles.list}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              ...styles.listItem,
              ...(selectedId === item.id ? styles.selectedItem : {}),
            }}
            onClick={() => setSelectedId(item.id)}
          >
            <span style={styles.itemId}>{item.id}</span>
            <span>{item.name}</span>
          </div>
        ))}
      </div>

      {/* 詳細表示 */}
      {selectedItem && (
        <div style={styles.detail}>
          <h4>{selectedItem.name}</h4>
          {Object.entries(selectedItem).map(([key, value]) => {
            const overridePath = `${category}.${items.indexOf(selectedItem)}.${key}`
            const hasOverride = overridePath in overrides

            return (
              <div key={key} style={styles.field}>
                <label style={styles.fieldLabel}>
                  {key}
                  {hasOverride && <span style={styles.overrideIndicator}> ✏️</span>}
                </label>
                <span style={styles.fieldValue}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* オーバーライドリスト */}
      {Object.keys(overrides).length > 0 && (
        <div style={styles.overrides}>
          <h4>Active Overrides</h4>
          {Object.entries(overrides).map(([path, value]) => (
            <div key={path} style={styles.overrideItem}>
              <span>{path}: {JSON.stringify(value)}</span>
              <button
                style={styles.removeBtn}
                onClick={() => removeOverride(path)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    right: 0,
    top: 0,
    width: 350,
    height: '100vh',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    color: '#ddd',
    fontFamily: 'monospace',
    fontSize: 12,
    overflow: 'auto',
    zIndex: 1000,
    padding: 8,
  },
  title: { margin: '0 0 8px', fontSize: 14 },
  tabs: { display: 'flex', gap: 4, marginBottom: 8 },
  tab: {
    padding: '4px 8px',
    background: '#333',
    color: '#aaa',
    border: '1px solid #555',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
  },
  activeTab: { background: '#446', color: '#fff', borderColor: '#88aaff' },
  list: { maxHeight: 200, overflow: 'auto', marginBottom: 8 },
  listItem: {
    padding: '2px 4px',
    cursor: 'pointer',
    borderBottom: '1px solid #333',
    display: 'flex',
    gap: 8,
  },
  selectedItem: { background: '#335' },
  itemId: { color: '#88aaff', minWidth: 80 },
  detail: { borderTop: '1px solid #444', paddingTop: 8 },
  field: { display: 'flex', justifyContent: 'space-between', padding: '1px 0' },
  fieldLabel: { color: '#8a8' },
  fieldValue: { color: '#ccc', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' },
  overrideIndicator: { color: '#ff8844' },
  overrides: { borderTop: '1px solid #444', paddingTop: 8, marginTop: 8 },
  overrideItem: { display: 'flex', justifyContent: 'space-between', padding: '2px 0' },
  removeBtn: { background: '#633', color: '#faa', border: 'none', cursor: 'pointer', padding: '0 4px' },
}
