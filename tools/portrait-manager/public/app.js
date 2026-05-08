const roles = [
  ['navigator', '航海士'],
  ['barmaid', '酒場女'],
  ['merchant', '商人'],
  ['officer', '士官'],
  ['mercenary', '傭兵'],
  ['guild_master', 'ギルド'],
  ['shipwright', '船大工'],
  ['noble', '貴族'],
  ['scholar', '学者'],
]

const nationalities = [
  ['portugal', 'ポルトガル'],
  ['spain', 'スペイン'],
  ['england', 'イングランド'],
  ['netherlands', 'ネーデルラント'],
  ['france', 'フランス'],
  ['venice', 'ヴェネツィア'],
  ['ottoman', 'オスマン'],
  ['local', '現地'],
]

const ages = [
  ['', '未指定'],
  ['late teens', '10代後半'],
  ['20s', '20代'],
  ['30s', '30代'],
  ['40s', '40代'],
  ['50s', '50代'],
  ['elder', '老年'],
]

const periods = [
  ['strict_16c', '16世紀通期'],
  ['early_16c', '1500-1530年頃'],
  ['mid_16c', '1540-1560年頃'],
  ['late_16c', '1570-1590年頃'],
]

const faceAngles = [
  ['random', 'ランダム'],
  ['front', '正面'],
  ['three_quarter_left', '左向き3/4'],
  ['three_quarter_right', '右向き3/4'],
  ['profile_left', '左横顔'],
  ['profile_right', '右横顔'],
]

const genders = [
  ['unspecified', '未指定'],
  ['male', '男性'],
  ['female', '女性'],
]

const defaultRows = [
  '航海士,ポルトガル,リスボン,30代,慎重な熟練航海士',
  '酒場女,ヴェネツィア,ヴェネツィア,20代,噂好きで顔が広い酒場女',
  '士官,スペイン,セビリア,40代,軍務上がりの厳格な士官',
].join('\n')

const coreStylePhrase = 'エッチングっぽい陰影がついた繊細な日本のゲームイラスト的な線画、褪せた色味の水彩で陰影をつけた塗り'

const state = {
  items: [],
  parsedRows: [],
  search: '',
}

const $ = (id) => document.getElementById(id)

const elements = {
  summary: $('summary'),
  roleInput: $('roleInput'),
  nationalityInput: $('nationalityInput'),
  portInput: $('portInput'),
  ageInput: $('ageInput'),
  periodInput: $('periodInput'),
  faceAngleInput: $('faceAngleInput'),
  genderInput: $('genderInput'),
  settingInput: $('settingInput'),
  moodInput: $('moodInput'),
  addSingleButton: $('addSingleButton'),
  rowsInput: $('rowsInput'),
  rowPreview: $('rowPreview'),
  previewRowsButton: $('previewRowsButton'),
  addRowsButton: $('addRowsButton'),
  clearRowsButton: $('clearRowsButton'),
  generateAllButton: $('generateAllButton'),
  clearAllButton: $('clearAllButton'),
  searchInput: $('searchInput'),
  cards: $('cards'),
  toast: $('toast'),
}

function fillOptions(select, options) {
  select.replaceChildren()
  for (const [value, label] of options) {
    select.append(new Option(label, value))
  }
}

function labelFor(options, value) {
  if (!value) return ''
  const exact = options.find((option) => option[0] === value || option[1] === value)
  return exact?.[1] ?? value
}

function valueFor(options, value, fallback = '') {
  if (!value) return fallback
  const exact = options.find((option) => option[0] === value || option[1] === value)
  return exact?.[0] ?? value
}

function showToast(message) {
  elements.toast.textContent = message
  elements.toast.classList.add('show')
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove('show')
  }, 1800)
}

function createId() {
  return `brief_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function normalizeBrief(input = {}) {
  return {
    id: input.id || createId(),
    role: valueFor(roles, input.role, 'navigator'),
    nationality: valueFor(nationalities, input.nationality, 'portugal'),
    port: String(input.port ?? '').trim(),
    age: valueFor(ages, input.age, ''),
    period: valueFor(periods, input.period, 'strict_16c'),
    faceAngle: valueFor(faceAngles, input.faceAngle, 'random'),
    gender: valueFor(genders, input.gender, 'unspecified'),
    setting: String(input.setting ?? '').trim(),
    mood: String(input.mood ?? '').trim(),
  }
}

function briefTitle(brief) {
  return [
    labelFor(roles, brief.role),
    labelFor(nationalities, brief.nationality),
    brief.port,
    labelFor(ages, brief.age),
    labelFor(periods, brief.period),
    labelFor(faceAngles, brief.faceAngle),
  ].filter(Boolean).join(' / ')
}

function hashString(input) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function periodLabelForPrompt(period) {
  switch (period) {
    case 'early_16c':
      return 'early 16th century, circa 1500-1530'
    case 'mid_16c':
      return 'mid-16th century, circa 1540-1560'
    case 'late_16c':
      return 'late 16th century, circa 1570-1590'
    default:
      return 'strictly 16th century, 1500s only'
  }
}

function faceAnglePrompt(brief) {
  const resolvedAngle = brief.faceAngle === 'random'
    ? faceAngles[1 + (hashString(brief.id) % (faceAngles.length - 1))][0]
    : brief.faceAngle

  switch (resolvedAngle) {
    case 'front':
      return 'face angle: front-facing portrait, direct gaze, symmetrical head position'
    case 'three_quarter_left':
      return 'face angle: three-quarter view turned to the viewer\'s left, eyes still readable'
    case 'three_quarter_right':
      return 'face angle: three-quarter view turned to the viewer\'s right, eyes still readable'
    case 'profile_left':
      return 'face angle: left-facing profile portrait, visible nose bridge and jaw silhouette'
    case 'profile_right':
      return 'face angle: right-facing profile portrait, visible nose bridge and jaw silhouette'
    default:
      return 'face angle: natural three-quarter portrait, not a passport photo'
  }
}

function costumeGuidance(brief) {
  const isFemale = brief.gender === 'female' || brief.role === 'barmaid'
  const isElite = ['noble', 'officer', 'guild_master', 'scholar'].includes(brief.role)
  const isWorkingMaritime = ['navigator', 'shipwright', 'mercenary'].includes(brief.role)

  const guidance = [
    `costume date: ${periodLabelForPrompt(brief.period)}`,
    'historically grounded Renaissance clothing, not Baroque, not Golden Age pirate costume',
    'visible garments must read as 1500s: linen shirt or smock, fitted doublet or bodice, jerkin, cloak or gown appropriate to status',
  ]

  if (brief.nationality === 'ottoman') {
    guidance.push(
      'Ottoman 16th-century dress: wrapped turban or soft cap, long kaftan or robe, layered textile collar, silk or wool according to status',
      'do not use European ruff collars, tricorn hats, frock coats, cravats, wigs, or western naval uniforms',
    )
    return guidance
  }

  if (isFemale) {
    guidance.push(
      'European 16th-century women: linen smock, partlet or modest square neckline, fitted bodice, kirtle or gown, coif, hood, or simple cap according to class',
      'for tavern workers use practical linen/wool clothing and apron-like working layers, not court fantasy costume',
    )
  } else if (isWorkingMaritime) {
    guidance.push(
      'working maritime 16th-century men: plain linen shirt with tied or gathered neck, wool or leather jerkin over a fitted doublet, simple flat cap or bonnet',
      'clothing should look practical, patched, sun-worn, and shipboard-ready rather than aristocratic',
    )
  } else {
    guidance.push(
      'European 16th-century men: fitted doublet, leather or textile jerkin, short cloak if needed, flat cap or soft bonnet, small linen collar or restrained late-century ruff only when status-appropriate',
    )
  }

  if (isElite) {
    guidance.push(
      'for elite status allow restrained embroidery, silk, velvet, gold or silver thread, but keep the silhouette within the 1500s',
    )
  }

  if (brief.nationality === 'netherlands' || brief.nationality === 'england') {
    guidance.push('late-century northern European details may include a modest ruff or high linen collar, never a 17th-century falling band or cavalier look')
  }

  if (['portugal', 'spain', 'venice', 'france'].includes(brief.nationality)) {
    guidance.push('Iberian, Italian, or French Renaissance styling: fitted doublet or bodice, sober dark wool, leather, linen, and small cap; avoid later musketeer fashion')
  }

  return guidance
}

function styleGuidance() {
  return [
    `最重要の画風指定: ${coreStylePhrase}`,
    '用途指定: 会話ウィンドウ用の顔グラフィック、ジョブや職業が一目で伝わる日本のゲームキャラクター肖像',
    '画面上の第一印象: 写真でも西洋古典絵画でもなく、日本のコンソールRPGの設定画・会話用顔グラとして見えること',
    '線画: 細く繊細で抑制されたインク線、髪・まぶた・鼻筋・唇・襟・布の皺に密度のある描線、輪郭線は太くしない',
    '陰影: 写実的な光源再現ではなく、細いハッチングとクロスハッチングの線の重なりで頬・鼻梁・目元・首・襟の立体感を作る',
    '塗り: 彩度を落とした淡い水彩、薄い影色を何層も重ねる、紙に染み込むような透明感、線画を塗りで潰さない',
    '顔: 写真のような写実ではなく、日本のゲームイラストとして整理された目鼻立ち、印象に残る目、静かな表情、端正なキャラクターデザイン',
    '服飾の描写: 16世紀の衣服構造を細い線で読み取れるように描き、布の質感は淡い水彩と線影で出す',
    '失敗判定: 西洋肖像画、古い銅版画そのもの、洋ゲー風リアル、映画的な写実レンダー、厚塗りコンセプトアートに見える場合は誤り',
  ]
}

function styleProfile() {
  return {
    core: coreStylePhrase,
    targetRead: 'Japanese console tactical RPG conversation portrait, delicate line art, faded watercolor shadows',
    mustHave: [
      'thin restrained ink linework',
      'visible hatching and cross-hatching on face, neck, hair, collar, and costume folds',
      'faded transparent watercolor shadows',
      'Japanese game character-design facial simplification',
      '16th-century costume details readable through linework',
    ],
    rejectIfReadsAs: [
      'western museum portrait',
      'old master oil painting',
      'literal antique print',
      'photorealistic western RPG concept art',
      'cinematic character render',
      'thick opaque digital painting',
    ],
  }
}

function buildPrompt(brief) {
  const role = labelFor(roles, brief.role)
  const nationality = labelFor(nationalities, brief.nationality)
  const age = labelFor(ages, brief.age)
  const gender = labelFor(genders, brief.gender)
  return [
    `primary art direction: ${coreStylePhrase}`,
    'original Japanese console tactical RPG face portrait of a historically accurate 16th-century Renaissance maritime character',
    'must read as Japanese game character portrait art and character design, not as western museum art or live-action concept art',
    role,
    nationality,
    gender !== '未指定' ? gender : '',
    age !== '未指定' ? age : '',
    brief.setting,
    brief.mood,
    brief.port ? `associated with ${brief.port}` : '',
    'head and shoulders portrait, UI-ready face icon crop',
    faceAnglePrompt(brief),
    ...costumeGuidance(brief),
    ...styleGuidance(),
    'self-check before final image: if the result resembles a western oil portrait, photorealistic western RPG concept art, antique print, or cinematic render, redraw it toward delicate Japanese game illustration linework with faded watercolor shadows',
    'expressive eyes and believable facial structure simplified into a memorable game portrait, not a live-action likeness',
    'simple parchment-toned or muted wash background, no cinematic lighting',
    'square 1024x1024 composition, UI-ready face icon, no readable text',
  ].filter(Boolean).join(', ')
}

function negativePrompt() {
  return [
    'low resolution',
    'blurry',
    'duplicate face',
    'deformed eyes',
    'extra limbs',
    '17th century clothing',
    '18th century clothing',
    'Baroque fashion',
    'Golden Age pirate costume',
    'tricorn hat',
    'frock coat',
    'waistcoat',
    'cravat',
    'periwig',
    'cavalier hat',
    'musketeer costume',
    'modern naval uniform',
    'modern clothing',
    'western museum portrait',
    'European old master painting',
    'literal antique engraving plate',
    'documentary reenactor portrait',
    'western RPG character portrait',
    'gritty western fantasy realism',
    'AAA game concept art',
    'cinematic character render',
    'photorealistic digital painting',
    'oil painting',
    'smooth painterly rendering',
    'airbrushed skin',
    'studio lighting',
    'dramatic rim light',
    'opaque paint fill',
    'generic modern anime cel shading',
    'flat vector art',
    'glossy digital painting',
    'plastic skin',
    'oversaturated fantasy colors',
    'thick comic outline',
    'readable text',
    'watermark',
  ].join(', ')
}

function parseRows(text = elements.rowsInput.value) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const columns = line.split(/\t|,/).map((value) => value.trim())
      return normalizeBrief({
        role: columns[0],
        nationality: columns[1],
        port: columns[2],
        age: columns[3],
        setting: columns[4],
        mood: columns[5],
        period: columns[6],
        faceAngle: columns[7],
      })
    })
}

function renderRowPreview() {
  state.parsedRows = parseRows()
  elements.rowPreview.replaceChildren()

  for (const row of state.parsedRows.slice(0, 8)) {
    const line = document.createElement('div')
    line.className = 'preview-row'
    line.append(
      textCell(labelFor(roles, row.role)),
      textCell(labelFor(nationalities, row.nationality)),
      textCell(row.port || '-'),
      textCell(labelFor(ages, row.age) || '-'),
      textCell(row.setting || '-'),
    )
    elements.rowPreview.append(line)
  }

  if (state.parsedRows.length > 8) {
    elements.rowPreview.append(textCell(`+${state.parsedRows.length - 8}件`))
  }
}

function textCell(text) {
  const span = document.createElement('span')
  span.textContent = text
  return span
}

function matchesSearch(brief) {
  const needle = state.search.trim().toLowerCase()
  if (!needle) return true
  return [
    labelFor(roles, brief.role),
    labelFor(nationalities, brief.nationality),
    brief.port,
    labelFor(ages, brief.age),
    labelFor(periods, brief.period),
    labelFor(faceAngles, brief.faceAngle),
    labelFor(genders, brief.gender),
    brief.setting,
    brief.mood,
  ].join(' ').toLowerCase().includes(needle)
}

function renderCards() {
  const filtered = state.items.filter(matchesSearch)
  elements.summary.textContent = `${filtered.length} / ${state.items.length}件`
  elements.cards.replaceChildren()

  if (!filtered.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.textContent = '生成案なし'
    elements.cards.append(empty)
    return
  }

  for (const brief of filtered) {
    elements.cards.append(createCard(brief))
  }
}

function createCard(brief) {
  const card = document.createElement('article')
  card.className = 'brief-card'

  const head = document.createElement('div')
  head.className = 'brief-head'

  const title = document.createElement('h3')
  title.textContent = briefTitle(brief) || '未設定'

  const actions = document.createElement('div')
  actions.className = 'card-actions'

  const generateButton = document.createElement('button')
  generateButton.type = 'button'
  generateButton.className = 'primary'
  generateButton.textContent = '画像生成'
  generateButton.addEventListener('click', () => requestGeneration([brief]))

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.textContent = '削除'
  removeButton.addEventListener('click', () => {
    state.items = state.items.filter((item) => item.id !== brief.id)
    renderCards()
  })

  actions.append(generateButton, removeButton)
  head.append(title, actions)

  const meta = document.createElement('div')
  meta.className = 'brief-meta'
  for (const value of [
    labelFor(roles, brief.role),
    labelFor(nationalities, brief.nationality),
    brief.port,
    labelFor(ages, brief.age),
    labelFor(periods, brief.period),
    labelFor(faceAngles, brief.faceAngle),
    labelFor(genders, brief.gender),
  ].filter(Boolean)) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = value
    meta.append(chip)
  }

  const setting = document.createElement('p')
  setting.className = 'setting'
  setting.textContent = [brief.setting, brief.mood].filter(Boolean).join(' / ') || '-'

  const prompt = document.createElement('textarea')
  prompt.className = 'prompt-box'
  prompt.rows = 7
  prompt.readOnly = true
  prompt.value = buildPrompt(brief)

  card.append(head, meta, setting, prompt)
  return card
}

async function requestGeneration(briefs) {
  if (!briefs.length) {
    showToast('生成対象がありません')
    return
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: briefs.map((brief) => ({
        title: briefTitle(brief),
        prompt: buildPrompt(brief),
        negativePrompt: negativePrompt(),
        styleProfile: styleProfile(),
        brief,
      })),
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`)
  }
  showToast(`${data.count}件の画像生成を依頼しました`)
}

function addBriefs(briefs) {
  state.items = [...state.items, ...briefs.map(normalizeBrief)]
  renderCards()
  showToast(`${briefs.length}件追加しました`)
}

function addSingle() {
  addBriefs([{
    role: elements.roleInput.value,
    nationality: elements.nationalityInput.value,
    port: elements.portInput.value,
    age: elements.ageInput.value,
    period: elements.periodInput.value,
    faceAngle: elements.faceAngleInput.value,
    gender: elements.genderInput.value,
    setting: elements.settingInput.value,
    mood: elements.moodInput.value,
  }])
}

function bindEvents() {
  elements.addSingleButton.addEventListener('click', addSingle)
  elements.previewRowsButton.addEventListener('click', renderRowPreview)
  elements.rowsInput.addEventListener('input', renderRowPreview)
  elements.addRowsButton.addEventListener('click', () => addBriefs(parseRows()))
  elements.clearRowsButton.addEventListener('click', () => {
    elements.rowsInput.value = ''
    renderRowPreview()
  })
  elements.generateAllButton.addEventListener('click', () => {
    requestGeneration(state.items.filter(matchesSearch)).catch((error) => showToast(error.message))
  })
  elements.clearAllButton.addEventListener('click', () => {
    state.items = []
    renderCards()
  })
  elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value
    renderCards()
  })
}

fillOptions(elements.roleInput, roles)
fillOptions(elements.nationalityInput, nationalities)
fillOptions(elements.ageInput, ages)
fillOptions(elements.periodInput, periods)
fillOptions(elements.faceAngleInput, faceAngles)
fillOptions(elements.genderInput, genders)
elements.roleInput.value = 'navigator'
elements.nationalityInput.value = 'portugal'
elements.periodInput.value = 'strict_16c'
elements.faceAngleInput.value = 'random'
elements.rowsInput.placeholder = '役職,国籍,街,年齢,設定,表情・雰囲気,服飾年代（任意）,顔向き（任意）'
elements.rowsInput.value = defaultRows
bindEvents()
renderRowPreview()
renderCards()
