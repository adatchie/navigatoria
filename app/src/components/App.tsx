// ============================================================
// App — メインアプリケーションコンポーネント
// ============================================================

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { TitleScreen } from './screens/TitleScreen.tsx'
import { LoadingScreen } from './screens/LoadingScreen.tsx'
import { NavigationHud } from './HUD/NavigationHud.tsx'
import { MiniMap } from './HUD/MiniMap.tsx'
import { Compass } from './HUD/Compass.tsx'
import { StatusBar } from './HUD/StatusBar.tsx'
import { SailControl } from './HUD/SailControl.tsx'
import { EncounterOverlay } from './EncounterOverlay.tsx'
import { useGameStore } from '@/stores/useGameStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useEconomyStore } from '@/stores/useEconomyStore.ts'
import { useQuestStore } from '@/stores/useQuestStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { loadAllMasterData } from '@/data/loader/DataLoader.ts'
import { gameLoop } from '@/game/GameLoop.ts'
import { initializeWorld } from '@/game/world/WorldInitializer.ts'
import { buildZonesFromPorts } from '@/game/world/zones.ts'
import { WindSystem } from '@/game/systems/WindSystem.ts'
import { NavigationSystem } from '@/game/systems/NavigationSystem.ts'
import { VoyageConditionSystem } from '@/game/systems/VoyageConditionSystem.ts'
import { VoyageEventSystem } from '@/game/systems/VoyageEventSystem.ts'
import { EncounterSystem } from '@/game/systems/EncounterSystem.ts'
import { EconomySystem } from '@/game/systems/EconomySystem.ts'
import { QuestSystem } from '@/game/systems/QuestSystem.ts'
import { AutoSave } from '@/persistence/AutoSave.ts'
import { captureGameState, loadLatestSave, restoreGameState, saveCurrentGame } from '@/persistence/GameState.ts'
import { uiText } from '@/i18n/uiText.ts'
import { INITIAL_PLAYER } from '@/config/gameConfig.ts'
import { getPortWorldPosition } from '@/data/master/portWorldPosition.ts'
import { createPortId } from '@/types/common.ts'

const GameCanvas = lazy(async () => import('./GameCanvas.tsx').then((mod) => ({ default: mod.GameCanvas })))
const DebugPanel = lazy(async () => import('./debug/DebugPanel.tsx').then((mod) => ({ default: mod.DebugPanel })))
const GameTimeControl = lazy(async () => import('./debug/GameTimeControl.tsx').then((mod) => ({ default: mod.GameTimeControl })))
const DataInspector = lazy(async () => import('./debug/DataInspector.tsx').then((mod) => ({ default: mod.DataInspector })))
const TownScreen = lazy(async () => import('./screens/TownScreen.tsx').then((mod) => ({ default: mod.TownScreen })))

const ASSET_PREVIEW_URL = '/asset-preview.html'
const ASSET_PREVIEW_WINDOW = 'dol-asset-preview'

export function App() {
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const updateTime = useGameStore((s) => s.updateTime)
  const setFrameStats = useGameStore((s) => s.setFrameStats)
  const initPlayer = usePlayerStore((s) => s.initPlayer)
  const initializeMarkets = useEconomyStore((s) => s.initializeMarkets)
  const ensurePortQuests = useQuestStore((s) => s.ensurePortQuests)
  const debugFlags = useUIStore((s) => s.debugFlags)
  const dockedPortId = useNavigationStore((s) => s.dockedPortId)
  const totalDays = useGameStore((s) => s.timeState.totalDays)
  const dataVersion = useDataStore((s) => s.version)
  const masterPorts = useDataStore((s) => s.masterData.ports)

  const [showDataInspector, setShowDataInspector] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [latestSaveExists, setLatestSaveExists] = useState(false)
  const autoSaveRef = useRef<AutoSave | null>(null)

  const refreshSaveAvailability = useCallback(async () => {
    const snapshot = await loadLatestSave()
    setLatestSaveExists(Boolean(snapshot))
  }, [])

  const openAssetPreviewWindow = useCallback(() => {
    const popup = window.open(ASSET_PREVIEW_URL, ASSET_PREVIEW_WINDOW, 'popup=yes,width=980,height=760,resizable=yes,scrollbars=no')
    popup?.focus()
  }, [])

  useEffect(() => {
    async function init() {
      setPhase('loading')
      setLoadProgress(20)

      await loadAllMasterData()
      initializeWorld()
      initializeMarkets()
      setLoadProgress(75)

      gameLoop.onStatsUpdate = setFrameStats
      await refreshSaveAvailability()

      setLoadProgress(100)
      setTimeout(() => setPhase('title'), 300)
    }

    void init()
  }, [initializeMarkets, refreshSaveAvailability, setFrameStats, setPhase])

  useEffect(() => {
    gameLoop.addSystem({ name: 'GameTimeUpdater', priority: 0, update: (dt) => updateTime(dt) })
    return () => { gameLoop.removeSystem('GameTimeUpdater') }
  }, [updateTime])

  useEffect(() => {
    const windSystem = new WindSystem()
    const navigationSystem = new NavigationSystem()
    const voyageConditionSystem = new VoyageConditionSystem()
    const voyageEventSystem = new VoyageEventSystem()
    const encounterSystem = new EncounterSystem()
    const economySystem = new EconomySystem()
    const questSystem = new QuestSystem()

    gameLoop.addSystem(windSystem)
    gameLoop.addSystem(navigationSystem)
    gameLoop.addSystem(voyageConditionSystem)
    gameLoop.addSystem(voyageEventSystem)
    gameLoop.addSystem(encounterSystem)
    gameLoop.addSystem(economySystem)
    gameLoop.addSystem(questSystem)

    return () => {
      gameLoop.removeSystem(windSystem.name)
      gameLoop.removeSystem(navigationSystem.name)
      gameLoop.removeSystem(voyageConditionSystem.name)
      gameLoop.removeSystem(voyageEventSystem.name)
      gameLoop.removeSystem(encounterSystem.name)
      gameLoop.removeSystem(economySystem.name)
      gameLoop.removeSystem(questSystem.name)
    }
  }, [])

  useEffect(() => {
    if (dockedPortId) {
      ensurePortQuests(dockedPortId, totalDays)
    }
  }, [dockedPortId, ensurePortQuests, totalDays])

  useEffect(() => {
    if (masterPorts.length === 0) return

    const worldStore = useWorldStore.getState()
    worldStore.setPorts(masterPorts)
    worldStore.setZones(buildZonesFromPorts(masterPorts))

    const navigation = useNavigationStore.getState()
    const playerStore = usePlayerStore.getState()
    const currentPortId = navigation.dockedPortId ?? playerStore.player?.currentPortId
    if (!currentPortId) return

    const currentPort = masterPorts.find((port) => port.id === currentPortId)
    if (!currentPort) return

    navigation.setPosition(currentPort.position)
    playerStore.setPosition(currentPort.position)
    playerStore.updatePlayer({ currentPortId: currentPort.id })
  }, [dataVersion, masterPorts])

  useEffect(() => {
    autoSaveRef.current = new AutoSave(() => captureGameState())
    return () => { autoSaveRef.current?.stop(); autoSaveRef.current = null }
  }, [])

  useEffect(() => {
    if ((phase === 'playing' || phase === 'port' || phase === 'paused') && usePlayerStore.getState().player) autoSaveRef.current?.start()
    else autoSaveRef.current?.stop()
  }, [phase])

  useEffect(() => {
    if (dockedPortId && phase !== 'title' && phase !== 'loading') void autoSaveRef.current?.triggerDockAutoSave(dockedPortId)
    if (!dockedPortId) autoSaveRef.current?.resetDockSignature()
  }, [dockedPortId, phase])

  const handleStart = useCallback(() => {
    initPlayer('航海者')
    initializeMarkets()
    const startPortId = createPortId(INITIAL_PLAYER.START_PORT)
    const startPosition = getPortWorldPosition(startPortId)
    const navigation = useNavigationStore.getState()
    const playerStore = usePlayerStore.getState()
    navigation.setMode('docked')
    navigation.setPosition(startPosition)
    navigation.setDockedPort(startPortId)
    navigation.setSpeed(0)
    navigation.setSailRatio(0)
    navigation.resetVoyage()
    playerStore.setPosition(startPosition)
    playerStore.updatePlayer({ currentPortId: startPortId, position: startPosition })
    // 初期位置はリスボン停泊中なので港画面から開始
    setPhase('port')
    gameLoop.start()
  }, [initPlayer, initializeMarkets, setPhase])

  const handleContinue = useCallback(async () => {
    const snapshot = await loadLatestSave()
    if (!snapshot) return
    restoreGameState(snapshot)
    gameLoop.start()
  }, [])

  const handleManualSave = useCallback(async () => {
    await saveCurrentGame(`Manual:${new Date().toISOString()}`)
    await refreshSaveAvailability()
  }, [refreshSaveAvailability])

  const handleLoadLatest = useCallback(async () => {
    const snapshot = await loadLatestSave()
    if (!snapshot) return
    restoreGameState(snapshot)
    gameLoop.start()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (phase !== 'playing') return

      const nav = useNavigationStore.getState()

      switch (e.key) {
        case 'F1': e.preventDefault(); setShowDataInspector((v) => !v); break
        case 'F2': e.preventDefault(); openAssetPreviewWindow(); break
        case ' ': e.preventDefault(); useGameStore.getState().togglePause(); break

        // --- 帆操作: W/S または ↑/↓ ---
        case 'w': case 'W': case 'ArrowUp':
          e.preventDefault()
          if (nav.mode === 'docked') break
          nav.setSailRatio(Math.min(1, nav.sailRatio + 0.25))
          break
        case 's': case 'S': case 'ArrowDown':
          e.preventDefault()
          if (nav.mode === 'docked') break
          nav.setSailRatio(Math.max(0, nav.sailRatio - 0.25))
          break

        // --- 舵操作: A/D または ←/→ ---
        case 'a': case 'A': case 'ArrowLeft':
          e.preventDefault()
          if (nav.mode === 'docked') break
          nav.setTargetHeading(((nav.targetHeading - 15) + 360) % 360)
          break
        case 'd': case 'D': case 'ArrowRight':
          e.preventDefault()
          if (nav.mode === 'docked') break
          nav.setTargetHeading((nav.targetHeading + 15) % 360)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openAssetPreviewWindow, phase])

  return (
    <div style={styles.root}>
      {phase === 'loading' && <LoadingScreen progress={loadProgress} message="マスタデータを読み込み中..." />}
      {phase === 'title' && <TitleScreen onStart={handleStart} onContinue={() => void handleContinue()} canContinue={latestSaveExists} />}
      {(phase === 'playing' || phase === 'paused') && (
        <Suspense fallback={<LoadingScreen message="シーンを準備中..." />}>
          <GameCanvas />
          <StatusBar />
          <GameTimeControl />
          <NavigationHud />
          <SailControl />
          <Compass />
          <MiniMap />
          <EncounterOverlay />
          <DebugPanel />
          {debugFlags.showDebugPanel && showDataInspector && <DataInspector />}
          {debugFlags.showDebugPanel && (
            <div style={styles.keybinds}>
              <span>F1: {uiText.app.dataInspector}</span>
              <button style={styles.linkButton} onClick={openAssetPreviewWindow}>F2: {uiText.app.assetPreview}</button>
              <span>Space: {uiText.app.pause}</span>
            </div>
          )}
        </Suspense>
      )}
      {phase === 'port' && <Suspense fallback={<LoadingScreen message="港へ入港中..." />}><TownScreen onManualSave={() => void handleManualSave()} onLoadLatest={() => void handleLoadLatest()} /></Suspense>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' },
  keybinds: { position: 'fixed', bottom: 8, left: 8, display: 'flex', gap: 12, alignItems: 'center', color: '#556', fontSize: 10, fontFamily: 'monospace', zIndex: 100 },
  linkButton: { padding: 0, background: 'none', border: 'none', color: '#7ab5ff', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer' },
}
