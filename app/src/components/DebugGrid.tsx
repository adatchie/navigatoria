import { Grid } from '@react-three/drei'

export function DebugGrid() {
  return (
    <Grid
      args={[100, 100]}
      cellSize={5}
      cellColor={0x444466}
      sectionSize={25}
      sectionColor={0x6666aa}
      position={[0, 0.01, 0]}
      fadeDistance={200}
    />
  )
}
