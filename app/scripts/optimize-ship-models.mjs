import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const jobs = [
  {
    id: 'galley',
    inputs: ['models-source/ships/galley.source.glb', 'dist/models/galley.glb'],
    output: 'public/models/ships/galley.glb',
  },
  {
    id: 'cog',
    inputs: ['models-source/ships/cog.source.glb', 'dist/models/cog.glb'],
    output: 'public/models/ships/cog.glb',
  },
  {
    id: 'barsha',
    inputs: ['models-source/ships/barsha.source.glb', 'dist/models/balca.glb', 'dist/models/barsha.glb'],
    output: 'public/models/ships/barsha.glb',
  },
  {
    id: 'caravel',
    inputs: ['models-source/ships/caravel.source.glb', 'dist/models/caravel.glb'],
    output: 'public/models/ships/caravel.glb',
  },
  {
    id: 'carrack',
    inputs: ['models-source/ships/carrack.source.glb', 'dist/models/carrack.glb'],
    output: 'public/models/ships/carrack.glb',
  },
  {
    id: 'galleon',
    inputs: ['models-source/ships/galleon.source.glb', 'dist/models/galleon.glb'],
    output: 'public/models/ships/galleon.glb',
  },
  {
    id: 'heavy_galleon',
    inputs: ['models-source/ships/heavy_galleon.source.glb', 'dist/models/heavy_galleon.glb'],
    output: 'public/models/ships/heavy_galleon.glb',
  },
  {
    id: 'treasure_galleon',
    inputs: ['models-source/ships/treasure_galleon.source.glb', 'public/models/treasure_galleon.glb', 'dist/models/treasure_galleon.glb'],
    output: 'public/models/ships/treasure_galleon.glb',
  },
  {
    id: 'galleass',
    inputs: ['models-source/ships/galleass.source.glb', 'public/models/galleass.glb', 'dist/models/galleass.glb'],
    output: 'public/models/ships/galleass.glb',
  },
  {
    id: 'galeazza',
    inputs: ['models-source/ships/galeazza.source.glb', 'dist/models/galeazza.glb'],
    output: 'public/models/ships/galeazza.glb',
  },
  {
    id: 'xebec',
    inputs: ['models-source/ships/xebec.source.glb', 'dist/models/xebec.glb', 'dist/models/xebeck.glb'],
    output: 'public/models/ships/xebec.glb',
  },
  {
    id: 'dhow',
    inputs: ['models-source/ships/dhow.source.glb', 'dist/models/dhow.glb', 'dist/models/dau.glb'],
    output: 'public/models/ships/dhow.glb',
  },
  {
    id: 'sambuk',
    inputs: ['models-source/ships/sambuk.source.glb', 'dist/models/sambuk.glb', 'dist/models/samubuc.glb'],
    output: 'public/models/ships/sambuk.glb',
  },
  {
    id: 'schooner',
    inputs: ['models-source/ships/schooner.source.glb', 'public/models/schooner.glb', 'dist/models/schooner.glb'],
    output: 'public/models/ships/schooner.glb',
  },
  {
    id: 'pinnace',
    inputs: ['models-source/ships/pinnace.source.glb', 'dist/models/pinnace.glb'],
    output: 'public/models/ships/pinnace.glb',
  },
]

const optimizeArgs = [
  '--compress',
  'meshopt',
  '--texture-compress',
  'webp',
  '--texture-size',
  '1024',
  '--simplify',
  'true',
  '--simplify-ratio',
  '0.18',
  '--simplify-error',
  '0.012',
  '--weld',
  'true',
  '--join',
  'true',
  '--prune',
  'true',
]

function findSource(inputs) {
  return inputs.map((input) => resolve(appRoot, input)).find((input) => existsSync(input))
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function quoteArg(value) {
  const text = String(value)
  if (/^[A-Za-z0-9_:/\\.@=-]+$/.test(text)) return text
  return `"${text.replaceAll('"', '\\"')}"`
}

for (const job of jobs) {
  const source = findSource(job.inputs)
  if (!source) {
    throw new Error(`${job.id}: source GLB was not found. Checked: ${job.inputs.join(', ')}`)
  }

  const output = resolve(appRoot, job.output)
  mkdirSync(dirname(output), { recursive: true })

  console.log(`\n${job.id}: ${source} -> ${output}`)
  const commandLine = [
    'npm',
    'exec',
    '--yes',
    '@gltf-transform/cli',
    '--',
    'optimize',
    source,
    output,
    ...optimizeArgs,
  ].map(quoteArg).join(' ')
  const result = spawnSync(commandLine, {
    cwd: appRoot,
    stdio: 'inherit',
    shell: true,
  })

  if (result.status !== 0) {
    throw new Error(`${job.id}: glTF optimization failed.`)
  }

  const sourceSize = statSync(source).size
  const outputSize = statSync(output).size
  console.log(`${job.id}: ${formatMb(sourceSize)} -> ${formatMb(outputSize)}`)
}
