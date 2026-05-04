import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { Shape, type Vector3 } from 'three'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { ShipModelRenderer, ShipRenderer } from '@/rendering/ShipRenderer.tsx'
import {
  BATTLEFIELD_BOUNDS,
  buildInitialTacticalBattle,
  buildPredictedCourse,
  confirmOrder,
  createTargetOrder,
  estimateDirectionalMovementRange,
  estimateMovementRange,
  getHeadingDelta,
  getHeadingToPosition,
  isPositionInMovementRange,
} from '@/game/combat/tacticalCombat.ts'
import type { Position2D } from '@/types/common.ts'
import type { TacticalBattlePhase, TacticalShipOrder, TacticalShipState, TacticalWindState } from '@/types/tacticalCombat.ts'

const FIELD_SCALE_X = 1.12
const FIELD_SCALE_Z = 0.82
const CANNON_RANGE = 22
const CANNON_ARC_DEGREES = 48
const BOARDING_RANGE = 4.8
const ACTION_DURATION_MS = 8000
const ACTION_TICK_MS = 80
const PROJECTILE_DURATION = 0.13
const BOARDING_TICK_PROGRESS = 1000 / ACTION_DURATION_MS

export function BattleScreen() {
  const encounter = useEncounterStore((s) => s.activeEncounter)
  const combatState = useEncounterStore((s) => s.combatState)
  const performCombatAction = useEncounterStore((s) => s.performCombatAction)
  const closeEncounter = useEncounterStore((s) => s.closeEncounter)
  const playerFleet = usePlayerStore((s) => s.ships)
  const getShip = useDataStore((s) => s.getShip)
  const windDirection = useNavigationStore((s) => s.wind.direction)
  const windSpeed = useNavigationStore((s) => s.wind.speed)
  const wind = useMemo<TacticalWindState>(() => ({ direction: windDirection, speed: windSpeed }), [windDirection, windSpeed])
  const initialBattle = useMemo(() => {
    if (!encounter) return null
    return buildInitialTacticalBattle({
      encounter,
      playerShips: playerFleet,
      getShipType: (typeId) => getShip(typeId),
      wind,
    })
  }, [encounter, getShip, playerFleet, wind])

  const [ships, setShips] = useState<TacticalShipState[]>(() => initialBattle?.ships ?? [])
  const [orders, setOrders] = useState<TacticalShipOrder[]>([])
  const [enemyOrders, setEnemyOrders] = useState<TacticalShipOrder[]>([])
  const [phase, setPhase] = useState<TacticalBattlePhase>('player_targeting')
  const [turn, setTurn] = useState(1)
  const [selectedShipId, setSelectedShipId] = useState<string | undefined>(() => initialBattle?.ships.find((ship) => ship.side === 'player' && ship.status === 'active')?.id)
  const [targetEnemyId, setTargetEnemyId] = useState<string | undefined>()
  const [battleLog, setBattleLog] = useState<string[]>(['交戦海域に入りました。味方艦に目標を設定してください。'])
  const [hint, setHint] = useState('味方船を選択し、海面をクリックして航路を設定します。敵艦をクリックすると追撃指示を選べます。')
  const [actionProgress, setActionProgress] = useState(0)
  const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([])
  const [boardingEvents, setBoardingEvents] = useState<BoardingEvent[]>([])
  const actionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (actionTimerRef.current !== null) window.clearInterval(actionTimerRef.current)
    }
  }, [])

  if (!encounter || !combatState || !initialBattle) return null

  const selectedShip = ships.find((ship) => ship.id === selectedShipId)
  const playerShips = ships.filter((ship) => ship.side === 'player')
  const enemyShips = ships.filter((ship) => ship.side === 'enemy')
  const activePlayerShips = playerShips.filter((ship) => ship.status === 'active')
  const activeEnemyShips = enemyShips.filter((ship) => ship.status === 'active')
  const orderedCount = orders.length
  const battleResolved = phase === 'resolved' || activePlayerShips.length === 0 || activeEnemyShips.length === 0

  const replaceOrder = (nextOrder: TacticalShipOrder) => {
    setOrders((current) => [
      ...current.filter((order) => order.shipId !== nextOrder.shipId),
      nextOrder,
    ])
  }

  const handleTargetPosition = (position: Position2D) => {
    if (phase !== 'player_targeting') return
    if (!selectedShip || selectedShip.side !== 'player' || selectedShip.status !== 'active') return

    if (!isPositionInMovementRange(selectedShip, wind, position)) {
      setHint('移動範囲外です。船首方向・旋回性能・風の影響で、この地点までは届きません。')
      return
    }

    replaceOrder(confirmOrder(createTargetOrder(selectedShip.id, clampPosition(position))))
    setTargetEnemyId(undefined)
    setHint(selectedShip.name + ' の航路を設定しました。行動フェイズでこのラインに沿って移動します。')
  }

  const handleShipSelect = (ship: TacticalShipState) => {
    if (phase !== 'player_targeting') return

    if (ship.side === 'player') {
      if (ship.status !== 'active') return
      setSelectedShipId(ship.id)
      setTargetEnemyId(undefined)
      setHint(ship.name + ' を選択しました。海面クリックで移動、敵艦クリックで追撃を指定できます。')
      return
    }

    if (!selectedShip || selectedShip.side !== 'player' || selectedShip.status !== 'active') return
    if (!isPositionInMovementRange(selectedShip, wind, ship.position)) {
      setHint('敵艦は現在の移動範囲外です。まず接近できる海面を指定してください。')
      return
    }
    setTargetEnemyId(ship.id)
    setHint(ship.name + ' を捕捉しました。追撃か、現在位置への移動を選べます。')
  }

  const assignPursuitOrder = () => {
    if (!selectedShip || !targetEnemyId) return
    replaceOrder({
      shipId: selectedShip.id,
      type: 'pursue',
      targetShipId: targetEnemyId,
      confirmed: true,
    })
    setTargetEnemyId(undefined)
    setHint(selectedShip.name + ' に追撃指示を設定しました。行動フェイズで敵艦を追います。')
  }

  const assignMoveToEnemyPosition = () => {
    if (!selectedShip || !targetEnemyId) return
    const enemy = ships.find((ship) => ship.id === targetEnemyId)
    if (!enemy) return
    replaceOrder(confirmOrder(createTargetOrder(selectedShip.id, enemy.position)))
    setTargetEnemyId(undefined)
    setHint(selectedShip.name + ' に敵艦現在位置への移動ラインを設定しました。')
  }

  const advanceActionPhase = () => {
    if (phase !== 'player_targeting') return
    const aiOrders = buildEnemyOrders(ships, wind)
    const confirmedOrders = orders.filter((order) => order.confirmed)
    const allOrders = [...confirmedOrders, ...aiOrders]
    const courses = buildMovementCourses(ships, allOrders, wind)
    const events = buildCombatEvents(ships, courses)
    const boarding = buildBoardingEvents(ships, courses, allOrders)
    const startedAt = performance.now()

    if (actionTimerRef.current !== null) window.clearInterval(actionTimerRef.current)

    setPhase('action')
    setEnemyOrders(aiOrders)
    setCombatEvents(events)
    setBoardingEvents(boarding)
    setActionProgress(0)
    setHint(events.length > 0 || boarding.length > 0 ? '行動フェイズ中です。砲撃・接舷が発生します。' : '行動フェイズ中です。各艦が航路に沿って機動しています。')
    setTargetEnemyId(undefined)
    setBattleLog((current) => [`Turn ${turn}: 行動フェイズ開始。`, ...current].slice(0, 12))

    actionTimerRef.current = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / ACTION_DURATION_MS)
      setActionProgress(progress)
      setShips(applyBoardingEventsToShips(applyCombatEventsToShips(interpolateMovementCourses(ships, courses, progress, boarding), events, progress), boarding, progress))

      if (progress < 1) return
      if (actionTimerRef.current !== null) {
        window.clearInterval(actionTimerRef.current)
        actionTimerRef.current = null
      }

      const finalShips = applyBoardingEventsToShips(applyCombatEventsToShips(interpolateMovementCourses(ships, courses, 1, boarding), events, 1), boarding, 1)
      const result = resolveTacticalAction(finalShips, events, boarding)
      setPhase(result.resolved ? 'resolved' : 'player_targeting')
      setShips(result.ships)
      setOrders([])
      setCombatEvents([])
      setBoardingEvents([])
      setTurn((current) => current + 1)
      setBattleLog((current) => [...result.log, ...current].slice(0, 12))
      setHint(result.resolved ? '戦闘が決着しました。航海へ戻れます。' : '行動フェイズを解決しました。次の目標を設定してください。')
      const nextSelectable = result.ships.find((ship) => ship.side === 'player' && ship.status === 'active')
      setSelectedShipId(nextSelectable?.id)
    }, ACTION_TICK_MS)
  }

  const withdraw = () => {
    void performCombatAction('withdraw')
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>戦闘海域 / Turn {turn}</div>
          <h2 style={styles.title}>{encounter.title}</h2>
        </div>
        <div style={styles.windPanel}>
          <span>風向 {Math.round(windDirection)}°</span>
          <strong>{windSpeed.toFixed(1)} kt</strong>
          <span style={styles.cameraHelp}>右ドラッグ/ホイールで視点変更</span>
        </div>
      </div>

      {phase === 'action' && (
        <div style={styles.actionOverlay}>
          <strong>行動フェイズ</strong>
          <span>{Math.round(actionProgress * 100)}%</span>
          <div style={styles.actionProgressTrack}><div style={{ ...styles.actionProgressFill, width: `${actionProgress * 100}%` }} /></div>
        </div>
      )}

      <div style={styles.battlefield}>
        <BattleField3D
          ships={ships}
          orders={orders}
          enemyOrders={enemyOrders}
          selectedShipId={selectedShipId}
          selectedShip={selectedShip}
          wind={wind}
          actionProgress={actionProgress}
          combatEvents={combatEvents}
          boardingEvents={boardingEvents}
          onSelectShip={handleShipSelect}
          onSelectTarget={handleTargetPosition}
        />
      </div>

      <aside style={styles.fleetPanel}>
        <div style={styles.panelTitle}>味方艦隊</div>
        <div style={styles.statusList}>
          {playerShips.map((ship, index) => (
            <ShipStatusCard key={ship.id} index={index + 1} ship={ship} selected={ship.id === selectedShipId} onClick={() => handleShipSelect(ship)} />
          ))}
        </div>
      </aside>

      <aside style={styles.enemyPanel}>
        <div style={styles.panelTitle}>敵艦隊</div>
        <div style={styles.statusList}>
          {enemyShips.map((ship, index) => (
            <ShipStatusCard key={ship.id} index={index + 1} ship={ship} enemy selected={ship.id === targetEnemyId} onClick={() => handleShipSelect(ship)} />
          ))}
        </div>
      </aside>

      <div style={styles.logPanel}>
        <strong>{battleResolved ? '戦闘結果' : '戦闘ログ'}</strong>
        {battleLog.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
      </div>

      <div style={styles.commandPanel}>
        <div style={styles.hint}>{hint}</div>
        <div style={styles.commandRow}>
          {targetEnemyId && <button style={styles.primaryButton} onClick={assignPursuitOrder}>追撃</button>}
          {targetEnemyId && <button style={styles.secondaryButton} onClick={assignMoveToEnemyPosition}>敵位置へ移動</button>}
          {!battleResolved && <button style={styles.actionButton} onClick={advanceActionPhase} disabled={phase === 'action'}>行動フェイズへ ({orderedCount}/{activePlayerShips.length})</button>}
          {!battleResolved && <button style={styles.secondaryButton} onClick={withdraw} disabled={phase === 'action'}>離脱</button>}
          {battleResolved && <button style={styles.actionButton} onClick={closeEncounter}>航海へ戻る</button>}
        </div>
      </div>
    </div>
  )
}

function BattleField3D(props: {
  ships: TacticalShipState[]
  orders: TacticalShipOrder[]
  enemyOrders: TacticalShipOrder[]
  selectedShipId?: string
  selectedShip?: TacticalShipState
  wind: TacticalWindState
  actionProgress: number
  combatEvents: CombatEvent[]
  boardingEvents: BoardingEvent[]
  onSelectShip: (ship: TacticalShipState) => void
  onSelectTarget: (position: Position2D) => void
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 50, 74], fov: 48, near: 0.1, far: 900 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={styles.canvas}
    >
      <BattleCamera />
      <color attach="background" args={['#071b2d']} />
      <fog attach="fog" args={['#071b2d', 160, 620]} />
      <ambientLight intensity={1.18} />
      <directionalLight position={[-42, 64, 28]} intensity={1.45} />
      <directionalLight position={[38, 26, -34]} intensity={0.34} />
      <BattleSea onSelectTarget={props.onSelectTarget} />
      <BattlefieldBoundary />
      <WindArrow3D direction={props.wind.direction} />
      {[...props.orders, ...props.enemyOrders].map((order) => {
        const ship = props.ships.find((entry) => entry.id === order.shipId)
        const targetPosition = getOrderTargetPosition(order, props.ships)
        if (!ship || !targetPosition) return null
        return (
          <CourseLine3D
            key={`${order.shipId}-${order.confirmed ? 'confirmed' : 'draft'}-${order.targetShipId ?? 'pos'}`}
            ship={ship}
            targetPosition={targetPosition}
            wind={props.wind}
            confirmed={order.confirmed}
            enemy={ship.side === 'enemy'}
          />
        )
      })}
      {props.selectedShip && <MovementRange3D ship={props.selectedShip} wind={props.wind} />}
      {props.ships.map((ship) => (
        <BattleShip3D
          key={ship.id}
          ship={ship}
          selected={ship.id === props.selectedShipId}
          targetSet={props.orders.some((order) => order.shipId === ship.id && order.confirmed)}
          onSelect={() => props.onSelectShip(ship)}
        />
      ))}
      <CombatEventEffects events={props.combatEvents} progress={props.actionProgress} />
      <BoardingEventEffects events={props.boardingEvents} progress={props.actionProgress} />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={32}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2.18}
        minPolarAngle={Math.PI / 5.2}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}

function BattleCamera() {
  const { camera } = useThree()
  camera.lookAt(0, 0, 0)
  return null
}

function BattleSea(props: { onSelectTarget: (position: Position2D) => void }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.04, 0]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        props.onSelectTarget(sceneToBattlePosition(event.point))
      }}
    >
      <planeGeometry args={[900, 900, 1, 1]} />
      <meshStandardMaterial color="#0b4163" roughness={0.82} metalness={0.03} emissive="#061f35" emissiveIntensity={0.52} />
    </mesh>
  )
}

function BattlefieldBoundary() {
  return (
    <group position={[0, 0.055, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[56, 57.2, 128]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.23} depthWrite={false} />
      </mesh>
      {[
        [0, -57],
        [57, 0],
        [0, 57],
        [-57, 0],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 0.9, z]}>
          <cylinderGeometry args={[0.45, 0.58, 1.7, 12]} />
          <meshStandardMaterial color="#f59e0b" emissive="#7c2d12" emissiveIntensity={0.15} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function MovementRange3D(props: { ship: TacticalShipState; wind: TacticalWindState }) {
  const [x, , z] = battleToScenePosition(props.ship.position)
  const shape = useMemo(() => buildReachableAreaShape(props.ship, props.wind), [props.ship, props.wind])
  return (
    <group position={[x, 0.06, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.17} depthWrite={false} />
      </mesh>
      <mesh position={battleDirectionOffset(props.ship.heading, estimateMovementRange(props.ship, props.wind) * 0.62)} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[1.1, 2.3, 3]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}

function buildReachableAreaShape(ship: TacticalShipState, wind: TacticalWindState): Shape {
  const shape = new Shape()
  const samples = 80
  for (let index = 0; index <= samples; index += 1) {
    const heading = (index / samples) * 360
    const rad = (heading * Math.PI) / 180
    const probeTarget = {
      x: ship.position.x + Math.sin(rad) * 100,
      y: ship.position.y + Math.cos(rad) * 100,
    }
    const distance = estimateDirectionalMovementRange(ship, wind, probeTarget)
    const localX = Math.sin(rad) * distance * FIELD_SCALE_X
    const localZ = Math.cos(rad) * distance * FIELD_SCALE_Z
    if (index === 0) shape.moveTo(localX, localZ)
    else shape.lineTo(localX, localZ)
  }
  shape.closePath()
  return shape
}

function battleDirectionOffset(heading: number, distance: number): [number, number, number] {
  const rad = (heading * Math.PI) / 180
  return [Math.sin(rad) * distance * FIELD_SCALE_X, 0.03, Math.cos(rad) * distance * FIELD_SCALE_Z]
}

function HeadingIndicator3D(props: { heading: number; color: string }) {
  return (
    <group position={[0, 0.18, 0]} rotation={[0, (-props.heading * Math.PI) / 180, 0]}>
      <mesh position={[0, 0, -4.2]}>
        <boxGeometry args={[0.16, 0.08, 5.2]} />
        <meshBasicMaterial color={props.color} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -7]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.95, 1.9, 3]} />
        <meshBasicMaterial color={props.color} transparent opacity={0.95} depthWrite={false} />
      </mesh>
    </group>
  )
}

function BroadsideArc3D(props: { side: 'left' | 'right'; color: string }) {
  const sideSign = props.side === 'left' ? -1 : 1
  return (
    <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, sideSign * Math.PI / 2]}>
      <ringGeometry args={[3.4, CANNON_RANGE * 0.52, 48, 1, -Math.PI * 0.24, Math.PI * 0.48]} />
      <meshBasicMaterial color={props.color} transparent opacity={0.18} depthWrite={false} />
    </mesh>
  )
}

function CourseLine3D(props: {
  ship: TacticalShipState
  targetPosition: Position2D
  wind: TacticalWindState
  confirmed: boolean
  enemy?: boolean
}) {
  const course = buildPredictedCourse(props.ship, props.targetPosition, props.wind, 22)
  const [toX, , toZ] = battleToScenePosition(props.targetPosition)
  const heading = getHeadingToPosition(props.ship.position, props.targetPosition)
  const color = props.enemy ? '#fb7185' : props.confirmed ? '#86efac' : '#fde68a'
  return (
    <group>
      {course.slice(1).map((point, index) => {
        const previous = course[index]
        const [fromX, , fromZ] = battleToScenePosition(previous)
        const [segmentToX, , segmentToZ] = battleToScenePosition(point)
        const midX = (fromX + segmentToX) / 2
        const midZ = (fromZ + segmentToZ) / 2
        const length = Math.hypot(segmentToX - fromX, segmentToZ - fromZ)
        const angle = Math.atan2(segmentToX - fromX, segmentToZ - fromZ)
        return (
          <mesh key={`${point.x}-${point.y}-${index}`} position={[midX, 0.11, midZ]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.12, 0.04, length]} />
            <meshBasicMaterial color={color} transparent opacity={props.confirmed ? 0.82 : 0.52} />
          </mesh>
        )
      })}
      <mesh position={[toX, 0.14, toZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.9, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <Html position={[toX, 2.2, toZ]} center distanceFactor={42} style={styles.courseHeadingLabel}>
        {Math.round(heading)}°
      </Html>
    </group>
  )
}

function WindArrow3D(props: { direction: number }) {
  return (
    <group position={[-46, 0.18, -44]} rotation={[0, (-props.direction * Math.PI) / 180, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.26, 0.04, 13]} />
        <meshBasicMaterial color="#bfdbfe" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0, -7.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[1.2, 2.2, 3]} />
        <meshBasicMaterial color="#bfdbfe" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function CombatEventEffects(props: { events: CombatEvent[]; progress: number }) {
  return (
    <>
      {props.events.map((event) => {
        const local = (props.progress - event.fireAt) / PROJECTILE_DURATION
        if (local < 0 || local > 1.35) return null
        const [startX, , startZ] = battleToScenePosition(event.startPosition)
        const [endX, , endZ] = battleToScenePosition(event.endPosition)
        const travel = Math.max(0, Math.min(1, local))
        const projectileX = startX + (endX - startX) * travel
        const projectileZ = startZ + (endZ - startZ) * travel
        const projectileY = 1.4 + Math.sin(travel * Math.PI) * 2.4
        const flashVisible = local < 0.22
        const impactVisible = local > 0.72
        const color = event.attackerSide === 'player' ? '#fde68a' : '#fecaca'

        return (
          <group key={event.id}>
            {flashVisible && (
              <mesh position={[startX, 1.2, startZ]}>
                <sphereGeometry args={[0.8 + local * 1.4, 12, 12]} />
                <meshBasicMaterial color="#fef3c7" transparent opacity={0.85 - local * 2.8} depthWrite={false} />
              </mesh>
            )}
            {local <= 1 && (
              <>
                <mesh position={[projectileX, projectileY, projectileZ]}>
                  <sphereGeometry args={[0.32, 12, 12]} />
                  <meshBasicMaterial color={color} />
                </mesh>
                <mesh position={[(startX + projectileX) / 2, 1.05, (startZ + projectileZ) / 2]} rotation={[0, Math.atan2(projectileX - startX, projectileZ - startZ), 0]}>
                  <boxGeometry args={[0.08, 0.08, Math.hypot(projectileX - startX, projectileZ - startZ)]} />
                  <meshBasicMaterial color={color} transparent opacity={0.38} depthWrite={false} />
                </mesh>
              </>
            )}
            {impactVisible && (
              <group position={[endX, 0.18, endZ]}>
                <mesh>
                  <cylinderGeometry args={[0.18, 1.25 + local * 0.4, event.hit ? 4.2 : 2.5, 10]} />
                  <meshBasicMaterial color={event.hit ? '#f8fafc' : '#bae6fd'} transparent opacity={Math.max(0, 1.15 - local)} depthWrite={false} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.2, event.critical ? 4.8 : 3.2, 24]} />
                  <meshBasicMaterial color={event.hit ? '#fca5a5' : '#7dd3fc'} transparent opacity={Math.max(0, 0.7 - (local - 0.72) * 1.8)} depthWrite={false} />
                </mesh>
              </group>
            )}
          </group>
        )
      })}
    </>
  )
}

function BoardingEventEffects(props: { events: BoardingEvent[]; progress: number }) {
  return (
    <>
      {props.events.map((event) => {
        if (props.progress < event.startAt) return null
        const pulse = Math.sin((props.progress - event.startAt) * ACTION_DURATION_MS * 0.018)
        const flash = 0.55 + Math.abs(pulse) * 0.45
        const [aX, , aZ] = battleToScenePosition(event.attackerPosition)
        const [tX, , tZ] = battleToScenePosition(event.targetPosition)
        const centerX = (aX + tX) / 2
        const centerZ = (aZ + tZ) / 2
        const angle = Math.atan2(tX - aX, tZ - aZ)

        return (
          <group key={event.id} position={[centerX, 2.8, centerZ]} rotation={[0, angle, 0]}>
            <mesh rotation={[0, 0, Math.PI / 4 + pulse * 0.35]}>
              <boxGeometry args={[0.14, 0.14, 4.4]} />
              <meshBasicMaterial color="#fef3c7" transparent opacity={flash} depthWrite={false} />
            </mesh>
            <mesh rotation={[0, 0, -Math.PI / 4 - pulse * 0.35]}>
              <boxGeometry args={[0.14, 0.14, 4.4]} />
              <meshBasicMaterial color="#fecaca" transparent opacity={flash} depthWrite={false} />
            </mesh>
            <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.4, 3.8 + Math.abs(pulse) * 0.7, 32]} />
              <meshBasicMaterial color="#f97316" transparent opacity={0.32} depthWrite={false} />
            </mesh>
            <Html position={[0, 2.2, 0]} center distanceFactor={42} style={styles.boardingLabel}>
              白兵戦
            </Html>
          </group>
        )
      })}
    </>
  )
}

function BattleShip3D(props: { ship: TacticalShipState; selected: boolean; targetSet: boolean; onSelect: () => void }) {
  const [x, y, z] = battleToScenePosition(props.ship.position)
  const ringColor = props.ship.side === 'player' ? '#67e8f9' : '#fb7185'
  const scale = props.ship.side === 'player' ? 1.55 : 1.45
  const opacity = props.ship.status === 'active' ? 1 : 0.46
  return (
    <group position={[x, y, z]}>
      <mesh
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          props.onSelect()
        }}
      >
        <circleGeometry args={[2.7, 36]} />
        <meshBasicMaterial color={props.selected ? '#fef08a' : ringColor} transparent opacity={props.selected ? 0.28 : 0.12} depthWrite={false} />
      </mesh>
      <group scale={opacity}>
        <Suspense fallback={<ShipRenderer heading={props.ship.heading} scale={scale} />}>
          <ShipModelRenderer heading={props.ship.heading} scale={scale} />
        </Suspense>
      </group>
      <HeadingIndicator3D heading={props.ship.heading} color={ringColor} />
      {props.selected && props.ship.status === 'active' && (
        <>
          <BroadsideArc3D side="left" color={ringColor} />
          <BroadsideArc3D side="right" color={ringColor} />
        </>
      )}
      <Html position={[0, 6.2, 0]} center distanceFactor={36} style={styles.shipLabel}>
        <div style={props.selected ? styles.shipLabelSelected : styles.shipLabelInner}>
          <strong>{props.ship.name}</strong>
          <div style={styles.headingText}>船首 {Math.round(props.ship.heading)}° / {statusLabel(props.ship.status)}</div>
          <Gauge label="耐久" value={props.ship.durability} max={props.ship.maxDurability} />
          <Gauge label="船員" value={props.ship.crew} max={props.ship.maxCrew} danger />
          {props.targetSet && <span style={styles.shipLabelBadge}>目標設定済</span>}
        </div>
      </Html>
    </group>
  )
}

function ShipStatusCard(props: { index: number; ship: TacticalShipState; enemy?: boolean; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" style={props.selected ? styles.statusCardSelected : styles.statusCard} onClick={props.onClick}>
      <div style={styles.statusHeader}>
        <span>{props.index}</span>
        <strong>{props.ship.name}</strong>
        <em>{statusLabel(props.ship.status)}</em>
      </div>
      <Gauge label="耐久" value={props.ship.durability} max={props.ship.maxDurability} />
      <Gauge label="船員" value={props.ship.crew} max={props.ship.maxCrew} danger />
      <div style={styles.shipSpecs}>船首 {Math.round(props.ship.heading)}° / {props.ship.speed} kt / 旋回 {props.ship.turnRate} / 砲門 {props.ship.cannonSlots}</div>
    </button>
  )
}

function Gauge(props: { label: string; value: number; max: number; danger?: boolean }) {
  const percent = Math.max(0, Math.min(100, (props.value / Math.max(1, props.max)) * 100))
  const color = props.danger ? '#fb7185' : '#4ade80'
  return (
    <div style={styles.gauge}>
      <div style={styles.gaugeHeader}><span>{props.label}</span><strong>{Math.round(props.value)} / {Math.round(props.max)}</strong></div>
      <div style={styles.gaugeTrack}><div style={{ ...styles.gaugeFill, width: `${percent}%`, background: color }} /></div>
    </div>
  )
}

function buildEnemyOrders(ships: TacticalShipState[], wind: TacticalWindState): TacticalShipOrder[] {
  const players = ships.filter((ship) => ship.side === 'player' && ship.status === 'active')
  const enemies = ships.filter((ship) => ship.side === 'enemy' && ship.status === 'active')
  if (players.length === 0) return []

  return enemies.map((enemy) => {
    const target = players.reduce((best, candidate) => {
      const bestDistance = distance(enemy.position, best.position)
      const candidateDistance = distance(enemy.position, candidate.position)
      const crewAdvantage = enemy.crew > candidate.crew ? -8 : 0
      return candidateDistance + crewAdvantage < bestDistance ? candidate : best
    }, players[0])

    if (enemy.crew > target.crew && isPositionInMovementRange(enemy, wind, target.position)) {
      return { shipId: enemy.id, type: 'pursue', targetShipId: target.id, confirmed: true }
    }

    const angle = ((target.heading + 90 + (enemy.id.length % 2 === 0 ? 35 : -35)) * Math.PI) / 180
    const preferredPosition = clampPosition({
      x: target.position.x + Math.sin(angle) * 14,
      y: target.position.y + Math.cos(angle) * 14,
    })
    const targetPosition = clampTargetToReachable(enemy, preferredPosition, wind)
    return { shipId: enemy.id, type: 'move', targetPosition, confirmed: true }
  })
}

interface MovementCourse {
  shipId: string
  points: Position2D[]
}

interface CombatEvent {
  id: string
  fireAt: number
  attackerId: string
  targetId: string
  attackerName: string
  targetName: string
  attackerSide: TacticalShipState['side']
  startPosition: Position2D
  endPosition: Position2D
  hit: boolean
  critical: boolean
  damage: number
  crewLoss: number
}

interface BoardingEvent {
  id: string
  startAt: number
  attackerId: string
  targetId: string
  attackerName: string
  targetName: string
  attackerPosition: Position2D
  targetPosition: Position2D
  attackerCrewLossPerTick: number
  targetCrewLossPerTick: number
  advantage: 'attacker' | 'target' | 'even'
}

function buildMovementCourses(
  ships: TacticalShipState[],
  orders: TacticalShipOrder[],
  wind: TacticalWindState,
): MovementCourse[] {
  return orders.flatMap((order) => {
    const ship = ships.find((entry) => entry.id === order.shipId)
    const targetPosition = getOrderTargetPosition(order, ships)
    if (!ship || !targetPosition || ship.status !== 'active') return []
    const reachableTarget = clampTargetToReachable(ship, targetPosition, wind)
    return [{ shipId: ship.id, points: buildPredictedCourse(ship, reachableTarget, wind, 28) }]
  })
}

function clampTargetToReachable(ship: TacticalShipState, targetPosition: Position2D, wind: TacticalWindState): Position2D {
  const dx = targetPosition.x - ship.position.x
  const dy = targetPosition.y - ship.position.y
  const distanceToTarget = Math.hypot(dx, dy)
  if (distanceToTarget <= 0.001) return ship.position

  const reachableDistance = estimateDirectionalMovementRange(ship, wind, targetPosition)
  if (distanceToTarget <= reachableDistance) return targetPosition

  const ratio = reachableDistance / distanceToTarget
  return clampPosition({
    x: ship.position.x + dx * ratio,
    y: ship.position.y + dy * ratio,
  })
}

function buildCombatEvents(ships: TacticalShipState[], courses: MovementCourse[]): CombatEvent[] {
  const events: CombatEvent[] = []
  const sides = ['player', 'enemy'] as const
  let eventIndex = 0

  for (const side of sides) {
    const attackers = ships.filter((ship) => ship.side === side && ship.status === 'active')
    const targets = ships.filter((ship) => ship.side !== side && ship.status === 'active')
    for (const attacker of attackers) {
      for (const target of targets) {
        const capture = findFirstBroadsideCapture(attacker.id, target.id, ships, courses)
        if (!capture) continue
        const hitChance = capture.critical ? 0.86 : 0.72
        const hit = Math.random() < hitChance
        const baseDamage = Math.max(3, Math.round(4 + attacker.cannonSlots * 2.5))
        const damage = hit ? Math.round(baseDamage * (capture.critical ? 1.7 : 1)) : 0
        const crewLoss = hit ? (capture.critical ? Math.max(1, Math.round(damage * 0.28)) : Math.max(0, Math.round(damage * 0.08))) : 0
        events.push({
          id: `${attacker.id}-${target.id}-${eventIndex}`,
          fireAt: capture.progress,
          attackerId: attacker.id,
          targetId: target.id,
          attackerName: attacker.name,
          targetName: target.name,
          attackerSide: attacker.side,
          startPosition: capture.attacker.position,
          endPosition: capture.target.position,
          hit,
          critical: capture.critical,
          damage,
          crewLoss,
        })
        eventIndex += 1
      }
    }
  }

  return events.sort((a, b) => a.fireAt - b.fireAt)
}

function buildBoardingEvents(ships: TacticalShipState[], courses: MovementCourse[], orders: TacticalShipOrder[]): BoardingEvent[] {
  const events: BoardingEvent[] = []
  const seenPairs = new Set<string>()

  for (const attacker of ships.filter((ship) => ship.status === 'active')) {
    for (const target of ships.filter((ship) => ship.status === 'active' && ship.side !== attacker.side)) {
      const pairKey = [attacker.id, target.id].sort().join(':')
      if (seenPairs.has(pairKey)) continue

      const capture = findFirstBoardingContact(attacker.id, target.id, ships, courses)
      if (!capture) continue

      const attackerPursuing = orders.some((order) => order.shipId === attacker.id && order.type === 'pursue' && order.targetShipId === target.id)
      const targetPursuing = orders.some((order) => order.shipId === target.id && order.type === 'pursue' && order.targetShipId === attacker.id)
      const advantage: BoardingEvent['advantage'] = attackerPursuing && !targetPursuing ? 'attacker' : targetPursuing && !attackerPursuing ? 'target' : 'even'
      const baseAttackerLoss = Math.max(1, Math.round(capture.target.crew * 0.045))
      const baseTargetLoss = Math.max(1, Math.round(capture.attacker.crew * 0.045))
      const attackerCrewLossPerTick = advantage === 'target' ? Math.round(baseAttackerLoss * 1.35) : advantage === 'attacker' ? Math.max(1, Math.round(baseAttackerLoss * 0.75)) : baseAttackerLoss
      const targetCrewLossPerTick = advantage === 'attacker' ? Math.round(baseTargetLoss * 1.35) : advantage === 'target' ? Math.max(1, Math.round(baseTargetLoss * 0.75)) : baseTargetLoss

      events.push({
        id: `boarding-${pairKey}`,
        startAt: capture.progress,
        attackerId: capture.attacker.id,
        targetId: capture.target.id,
        attackerName: capture.attacker.name,
        targetName: capture.target.name,
        attackerPosition: capture.attacker.position,
        targetPosition: capture.target.position,
        attackerCrewLossPerTick,
        targetCrewLossPerTick,
        advantage,
      })
      seenPairs.add(pairKey)
    }
  }

  return events.sort((a, b) => a.startAt - b.startAt)
}

function findFirstBroadsideCapture(
  attackerId: string,
  targetId: string,
  ships: TacticalShipState[],
  courses: MovementCourse[],
): { progress: number; attacker: TacticalShipState; target: TacticalShipState; critical: boolean } | null {
  for (let step = 1; step <= 40; step += 1) {
    const progress = step / 40
    const snapshot = interpolateMovementCourses(ships, courses, progress)
    const attacker = snapshot.find((ship) => ship.id === attackerId)
    const target = snapshot.find((ship) => ship.id === targetId)
    if (!attacker || !target || attacker.status !== 'active' || target.status !== 'active') continue
    if (!isTargetInBroadside(attacker, target)) continue
    return {
      progress,
      attacker,
      target,
      critical: isSternShot(attacker, target),
    }
  }

  return null
}

function findFirstBoardingContact(
  attackerId: string,
  targetId: string,
  ships: TacticalShipState[],
  courses: MovementCourse[],
): { progress: number; attacker: TacticalShipState; target: TacticalShipState } | null {
  for (let step = 1; step <= 40; step += 1) {
    const progress = step / 40
    const snapshot = interpolateMovementCourses(ships, courses, progress)
    const attacker = snapshot.find((ship) => ship.id === attackerId)
    const target = snapshot.find((ship) => ship.id === targetId)
    if (!attacker || !target || attacker.status !== 'active' || target.status !== 'active') continue
    if (distance(attacker.position, target.position) > BOARDING_RANGE) continue
    return { progress, attacker, target }
  }

  return null
}

function interpolateMovementCourses(
  ships: TacticalShipState[],
  courses: MovementCourse[],
  progress: number,
  boardingEvents: BoardingEvent[] = [],
): TacticalShipState[] {
  const courseMap = new Map(courses.map((course) => [course.shipId, course.points]))
  return ships.map((ship) => {
    const points = courseMap.get(ship.id)
    if (!points || points.length === 0 || ship.status !== 'active') return ship

    const boarding = boardingEvents.find((event) => progress >= event.startAt && (event.attackerId === ship.id || event.targetId === ship.id))
    const clampedProgress = Math.max(0, Math.min(1, boarding ? boarding.startAt : progress))
    const rawIndex = clampedProgress * (points.length - 1)
    const index = Math.floor(rawIndex)
    const nextIndex = Math.min(points.length - 1, index + 1)
    const localT = rawIndex - index
    const from = points[index] ?? ship.position
    const to = points[nextIndex] ?? from
    const position = clampPosition({
      x: from.x + (to.x - from.x) * localT,
      y: from.y + (to.y - from.y) * localT,
    })
    const headingBase = distance(from, to) > 0.01 ? getHeadingToPosition(from, to) : ship.heading

    return {
      ...ship,
      position,
      heading: headingBase,
    }
  })
}

function applyCombatEventsToShips(ships: TacticalShipState[], events: CombatEvent[], progress: number): TacticalShipState[] {
  const activeEvents = events.filter((event) => event.fireAt <= progress)
  if (activeEvents.length === 0) return ships
  const nextShips = ships.map((ship) => ({ ...ship }))

  for (const event of activeEvents) {
    if (!event.hit) continue
    const target = nextShips.find((ship) => ship.id === event.targetId)
    if (!target || target.status !== 'active') continue
    target.durability = Math.max(0, target.durability - event.damage)
    target.crew = Math.max(0, target.crew - event.crewLoss)
  }

  for (const ship of nextShips) {
    if (ship.durability <= 0) ship.status = 'sunk'
    else if (ship.crew <= 0) ship.status = 'disabled'
  }

  return nextShips
}

function applyBoardingEventsToShips(ships: TacticalShipState[], events: BoardingEvent[], progress: number): TacticalShipState[] {
  const activeEvents = events.filter((event) => progress >= event.startAt)
  if (activeEvents.length === 0) return ships
  const nextShips = ships.map((ship) => ({ ...ship }))

  for (const event of activeEvents) {
    const ticks = Math.floor((progress - event.startAt) / BOARDING_TICK_PROGRESS) + 1
    const attacker = nextShips.find((ship) => ship.id === event.attackerId)
    const target = nextShips.find((ship) => ship.id === event.targetId)
    if (!attacker || !target) continue
    if (attacker.status !== 'active' || target.status !== 'active') continue
    attacker.crew = Math.max(0, attacker.crew - event.attackerCrewLossPerTick * ticks)
    target.crew = Math.max(0, target.crew - event.targetCrewLossPerTick * ticks)
  }

  for (const ship of nextShips) {
    if (ship.durability <= 0) ship.status = 'sunk'
    else if (ship.crew <= 0) ship.status = 'disabled'
  }

  return nextShips
}

function resolveTacticalAction(currentShips: TacticalShipState[], events: CombatEvent[], boardingEvents: BoardingEvent[]): { ships: TacticalShipState[]; log: string[]; resolved: boolean } {
  const playerActive = currentShips.some((ship) => ship.side === 'player' && ship.status === 'active')
  const enemyActive = currentShips.some((ship) => ship.side === 'enemy' && ship.status === 'active')
  const cannonLog = events.map((event) => {
    if (!event.hit) return `${event.attackerName} の砲撃は ${event.targetName} を外れました。`
    return `${event.attackerName} が ${event.targetName} を砲撃し、耐久 ${event.damage}${event.crewLoss > 0 ? `・船員 ${event.crewLoss}` : ''}${event.critical ? ' の重大損害' : ' の損害'}を与えました。`
  })
  const boardingLog = boardingEvents.map((event) => `${event.attackerName} と ${event.targetName} が接舷し、白兵戦が発生しました。${event.advantage === 'attacker' ? `${event.attackerName} が追尾側として優勢です。` : event.advantage === 'target' ? `${event.targetName} が追尾側として優勢です。` : '双方が追尾状態で互角です。'}`)
  const resultLog = [...boardingLog, ...cannonLog]

  if (!enemyActive) resultLog.unshift('敵艦隊を戦闘不能にしました。')
  if (!playerActive) resultLog.unshift('味方艦隊が戦闘継続不能になりました。')
  if (resultLog.length === 0) resultLog.unshift('各艦が機動しましたが、有効な交戦はありませんでした。')

  return {
    ships: currentShips,
    log: resultLog,
    resolved: !playerActive || !enemyActive,
  }
}

function isSternShot(attacker: TacticalShipState, target: TacticalShipState): boolean {
  return getHeadingDelta(target.heading, getHeadingToPosition(attacker.position, target.position)) < 32
}

function isTargetInBroadside(attacker: TacticalShipState, target: TacticalShipState): boolean {
  const d = distance(attacker.position, target.position)
  if (d > CANNON_RANGE) return false
  const targetBearing = getHeadingToPosition(attacker.position, target.position)
  const leftBearing = (attacker.heading + 270) % 360
  const rightBearing = (attacker.heading + 90) % 360
  return getHeadingDelta(leftBearing, targetBearing) <= CANNON_ARC_DEGREES || getHeadingDelta(rightBearing, targetBearing) <= CANNON_ARC_DEGREES
}

function getOrderTargetPosition(order: TacticalShipOrder, ships: TacticalShipState[]): Position2D | undefined {
  if (order.type === 'move') return order.targetPosition
  if (order.type === 'pursue' && order.targetShipId) return ships.find((ship) => ship.id === order.targetShipId)?.position
  return undefined
}

function battleToScenePosition(position: Position2D): [number, number, number] {
  return [(position.x - 50) * FIELD_SCALE_X, 0.1, (position.y - 50) * FIELD_SCALE_Z]
}

function sceneToBattlePosition(point: Vector3): Position2D {
  return clampPosition({
    x: point.x / FIELD_SCALE_X + 50,
    y: point.z / FIELD_SCALE_Z + 50,
  })
}

function clampPosition(position: Position2D): Position2D {
  return {
    x: Math.max(BATTLEFIELD_BOUNDS.minX, Math.min(BATTLEFIELD_BOUNDS.maxX, position.x)),
    y: Math.max(BATTLEFIELD_BOUNDS.minY, Math.min(BATTLEFIELD_BOUNDS.maxY, position.y)),
  }
}

function distance(a: Position2D, b: Position2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function statusLabel(status: TacticalShipState['status']): string {
  if (status === 'sunk') return '撃沈'
  if (status === 'disabled') return '航行不能'
  return '行動可'
}

const styles: Record<string, CSSProperties> = {
  root: { position: 'fixed', inset: 0, zIndex: 720, overflow: 'hidden', color: '#e7f2ff', background: '#071b2d', fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif' },
  header: { position: 'absolute', top: 16, left: 18, right: 18, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 18, background: 'rgba(4, 12, 24, 0.58)', border: '1px solid rgba(125, 211, 252, 0.22)', backdropFilter: 'blur(10px)', pointerEvents: 'none' },
  eyebrow: { fontSize: 11, letterSpacing: '0.18em', color: '#93c5fd' },
  title: { margin: '4px 0 0', fontSize: 22 },
  windPanel: { display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 12px', borderRadius: 12, background: 'rgba(15, 23, 42, 0.64)', color: '#bfdbfe' },
  cameraHelp: { color: '#8ba6c8', fontSize: 11 },
  battlefield: { position: 'absolute', inset: 0, cursor: 'crosshair' },
  canvas: { width: '100%', height: '100%' },
  fleetPanel: { position: 'absolute', top: 104, left: 18, width: 300, maxHeight: '54vh', zIndex: 4, padding: 12, borderRadius: 18, background: 'rgba(5, 13, 27, 0.58)', border: '1px solid rgba(148, 163, 184, 0.24)', backdropFilter: 'blur(10px)' },
  enemyPanel: { position: 'absolute', top: 104, right: 18, width: 300, maxHeight: '42vh', zIndex: 4, padding: 12, borderRadius: 18, background: 'rgba(5, 13, 27, 0.58)', border: '1px solid rgba(148, 163, 184, 0.24)', backdropFilter: 'blur(10px)' },
  panelTitle: { marginBottom: 10, fontSize: 13, letterSpacing: '0.12em', color: '#93c5fd' },
  statusList: { display: 'grid', gap: 8, overflow: 'auto', maxHeight: 'calc(54vh - 42px)' },
  statusCard: { display: 'block', width: '100%', textAlign: 'left', color: '#e7f2ff', padding: 10, borderRadius: 13, background: 'rgba(15, 23, 42, 0.62)', border: '1px solid rgba(148, 163, 184, 0.16)', cursor: 'pointer' },
  statusCardSelected: { display: 'block', width: '100%', textAlign: 'left', color: '#e7f2ff', padding: 10, borderRadius: 13, background: 'rgba(30, 64, 175, 0.54)', border: '1px solid rgba(250, 204, 21, 0.72)', cursor: 'pointer' },
  statusHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  gauge: { marginTop: 7 },
  gaugeHeader: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: '#cbd5e1' },
  gaugeTrack: { height: 7, marginTop: 4, borderRadius: 999, background: 'rgba(255,255,255,0.11)', overflow: 'hidden' },
  gaugeFill: { height: '100%' },
  shipSpecs: { marginTop: 8, fontSize: 11, color: '#8ba6c8' },
  headingText: { marginTop: 4, marginBottom: 4, fontSize: 10, color: '#bfdbfe' },
  courseHeadingLabel: { pointerEvents: 'none', color: '#fde68a', fontSize: 11, fontWeight: 800, textShadow: '0 2px 8px #000' },
  boardingLabel: { pointerEvents: 'none', color: '#fef3c7', fontSize: 13, fontWeight: 900, textShadow: '0 2px 10px #7c2d12' },
  logPanel: { position: 'absolute', left: 18, bottom: 18, width: 420, maxHeight: 190, overflow: 'auto', zIndex: 5, padding: 13, borderRadius: 16, background: 'rgba(5, 13, 27, 0.64)', border: '1px solid rgba(148, 163, 184, 0.22)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.45, backdropFilter: 'blur(10px)' },
  commandPanel: { position: 'absolute', right: 18, bottom: 18, zIndex: 5, width: 560, padding: 15, borderRadius: 18, background: 'rgba(4, 12, 24, 0.72)', border: '1px solid rgba(125, 211, 252, 0.22)', backdropFilter: 'blur(12px)' },
  actionOverlay: { position: 'absolute', top: 92, left: '50%', transform: 'translateX(-50%)', zIndex: 8, width: 320, padding: '12px 14px', borderRadius: 16, background: 'rgba(3, 7, 18, 0.72)', border: '1px solid rgba(251, 191, 36, 0.55)', color: '#fde68a', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', backdropFilter: 'blur(10px)' },
  actionProgressTrack: { gridColumn: '1 / -1', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  actionProgressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #f59e0b, #fde68a)' },
  hint: { minHeight: 20, marginBottom: 12, color: '#dbeafe', fontSize: 13 },
  commandRow: { display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  primaryButton: { padding: '10px 13px', border: 'none', borderRadius: 10, background: '#2563eb', color: '#fff', cursor: 'pointer' },
  secondaryButton: { padding: '10px 13px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer' },
  actionButton: { padding: '10px 14px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #ea580c, #f59e0b)', color: '#111827', fontWeight: 800, cursor: 'pointer' },
  shipLabel: { pointerEvents: 'none' },
  shipLabelInner: { minWidth: 130, padding: '7px 9px', borderRadius: 10, background: 'rgba(2, 6, 23, 0.66)', border: '1px solid rgba(148, 163, 184, 0.24)', color: '#dbeafe', fontSize: 11 },
  shipLabelSelected: { minWidth: 130, padding: '7px 9px', borderRadius: 10, background: 'rgba(30, 64, 175, 0.72)', border: '1px solid rgba(250, 204, 21, 0.72)', color: '#fefce8', fontSize: 11 },
  shipLabelBadge: { display: 'inline-block', marginTop: 5, padding: '2px 6px', borderRadius: 999, background: '#22c55e', color: '#052e16', fontSize: 10, fontWeight: 800 },
}
