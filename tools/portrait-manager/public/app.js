const roles = [
  ['navigator', '航海士'],
  ['sailor', '水夫'],
  ['barmaid', '酒場女'],
  ['merchant', '商人'],
  ['officer', '士官'],
  ['mercenary', '傭兵'],
  ['corsair', '海賊・私掠'],
  ['missionary', '宣教師'],
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

const viewAngles = [
  ['random', '自動ばらし'],
  ['eye_level', '目線高さ'],
  ['slightly_high', '斜め上から'],
  ['slightly_low', 'やや見上げ'],
  ['chin_down_eyes_up', '顎引き・上目'],
  ['over_shoulder', '振り返り'],
]

const expressions = [
  ['random', '自動ばらし'],
  ['calm', '静か'],
  ['faint_smile', '微笑'],
  ['skeptical', '疑い深い'],
  ['wary', '警戒'],
  ['tired', '疲れ'],
  ['confident', '自信'],
  ['amused', '面白がる'],
  ['stern', '厳格'],
]

const headwears = [
  ['random', '自動ばらし'],
  ['none', '帽子なし'],
  ['flat_cap', '平帽'],
  ['soft_bonnet', '柔らかい帽子'],
  ['cloth_cap', '布帽'],
  ['hood_or_coif', '頭巾・コイフ'],
  ['morion', 'モリオン兜'],
  ['zucchetto', 'ズケット'],
  ['turban', 'ターバン'],
]

const facialHairs = [
  ['random', '自動ばらし'],
  ['clean_shaven', '髭なし'],
  ['faint_stubble', '薄い無精髭'],
  ['trimmed_moustache', '短い口髭'],
  ['small_goatee', '小さな顎髭'],
  ['short_beard', '短い顎髭'],
]

const hairColors = [
  ['random', '自動ばらし'],
  ['black', '黒髪'],
  ['dark_brown', '濃茶'],
  ['chestnut', '栗色'],
  ['auburn', '赤褐色'],
  ['dark_blond', '暗金髪'],
  ['grey', '灰色'],
  ['white', '白髪'],
]

const eyeColors = [
  ['random', '自動ばらし'],
  ['dark_brown', '濃茶'],
  ['hazel', '榛色'],
  ['amber', '琥珀'],
  ['grey', '灰色'],
  ['blue', '青'],
  ['green', '緑'],
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
const workspaceStorageKey = 'navigatoriaPortraitManagerWorkspaceV1'

const candidateSeeds = [
  { role: 'navigator', nationality: 'portugal', port: 'リスボン', age: '30s', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: 'インド航路帰りの慎重な水先案内人', mood: '静かな目力、観察深い' },
  { role: 'merchant', nationality: 'venice', port: 'ヴェネツィア', age: '40s', period: 'mid_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: '香辛料と絹を扱う海上商人', mood: '柔らかいが抜け目ない' },
  { role: 'barmaid', nationality: 'spain', port: 'セビリア', age: '20s', period: 'late_16c', faceAngle: 'front', gender: 'female', setting: '船乗りの噂に通じた港酒場の給仕', mood: '明るい目、少し挑むような笑み' },
  { role: 'scholar', nationality: 'venice', port: 'ヴェネツィア', age: '30s', period: 'mid_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: '海図工房で記録を整理する書記', mood: '知的で控えめ' },
  { role: 'shipwright', nationality: 'netherlands', port: 'アントウェルペン', age: '50s', period: 'late_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: '北海船を修理する親方船大工', mood: '穏やかで頑固' },
  { role: 'officer', nationality: 'england', port: 'プリマス', age: '30s', period: 'late_16c', faceAngle: 'profile_left', gender: 'male', setting: '私掠船団に随行する若い士官', mood: '鋭い視線、礼節を保つ' },
  { role: 'guild_master', nationality: 'france', port: 'ルーアン', age: '50s', period: 'mid_16c', faceAngle: 'three_quarter_left', gender: 'female', setting: '港湾倉庫を束ねる商人ギルドの女主人', mood: '落ち着いた威厳' },
  { role: 'mercenary', nationality: 'spain', port: 'カディス', age: '40s', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: '護衛契約で船に乗る古参の傭兵', mood: '寡黙、警戒心がある' },
  { role: 'noble', nationality: 'portugal', port: 'ポルト', age: '20s', period: 'early_16c', faceAngle: 'three_quarter_left', gender: 'female', setting: '交易権を持つ下級貴族の令嬢', mood: '端正で芯が強い' },
  { role: 'navigator', nationality: 'ottoman', port: 'イスタンブール', age: '40s', period: 'mid_16c', faceAngle: 'front', gender: 'male', setting: '東地中海を知るオスマンの航路案内人', mood: '静かに見透かす' },
  { role: 'merchant', nationality: 'france', port: 'マルセイユ', age: '30s', period: 'late_16c', faceAngle: 'profile_right', gender: 'female', setting: '地中海ワインを扱う若い仲買商', mood: '快活で計算高い' },
  { role: 'scholar', nationality: 'spain', port: 'トレド', age: 'elder', period: 'early_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: '航海暦を読む老学者', mood: '柔らかい知性' },
  { role: 'barmaid', nationality: 'portugal', port: 'リスボン', age: '30s', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'female', setting: '帰港船員を見分ける港酒場の女主人', mood: '親しみやすく抜け目ない' },
  { role: 'officer', nationality: 'venice', port: 'キオッジャ', age: '40s', period: 'early_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: '護送船団の規律を預かる士官', mood: '冷静で実務的' },
  { role: 'shipwright', nationality: 'portugal', port: 'ラゴス', age: '30s', period: 'early_16c', faceAngle: 'profile_left', gender: 'male', setting: '探検船の艤装を担う船大工', mood: '若く集中している' },
  { role: 'guild_master', nationality: 'venice', port: 'ヴェネツィア', age: 'elder', period: 'late_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: '交易契約を裁く老ギルド長', mood: '温厚だが隙がない' },
  { role: 'mercenary', nationality: 'france', port: 'ラ・ロシェル', age: '20s', period: 'late_16c', faceAngle: 'front', gender: 'female', setting: '商船護衛に雇われた軽装の護衛', mood: '勇ましいが軽やか' },
  { role: 'noble', nationality: 'england', port: 'ロンドン', age: '40s', period: 'late_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: '海外投資に関わる廷臣貴族', mood: '優雅で警戒心がある' },
  { role: 'navigator', nationality: 'netherlands', port: 'アムステルダム', age: '20s', period: 'late_16c', faceAngle: 'three_quarter_left', gender: 'female', setting: '北海の潮流に詳しい若い航海士', mood: '涼しい目、好奇心' },
  { role: 'merchant', nationality: 'ottoman', port: 'アレクサンドリア', age: '50s', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: '紅海交易を取り仕切る隊商商人', mood: '穏やかな迫力' },
  { role: 'scholar', nationality: 'england', port: 'ブリストル', age: '30s', period: 'late_16c', faceAngle: 'profile_right', gender: 'female', setting: '天測記録を写す港町の学者', mood: '内省的で澄んだ目' },
  { role: 'barmaid', nationality: 'netherlands', port: 'ロッテルダム', age: '40s', period: 'late_16c', faceAngle: 'three_quarter_left', gender: 'female', setting: '河口の酒場を切り盛りする女主人', mood: '温かく頼もしい' },
  { role: 'officer', nationality: 'portugal', port: 'ゴア', age: '50s', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: 'インド洋拠点を守る遠征士官', mood: '疲れを隠した威厳' },
  { role: 'shipwright', nationality: 'ottoman', port: 'ガラタ', age: '40s', period: 'mid_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: 'ガレー船の修理を監督する造船職人', mood: '沈着で手堅い' },
  { role: 'guild_master', nationality: 'spain', port: 'セビリア', age: '40s', period: 'late_16c', faceAngle: 'front', gender: 'female', setting: '新大陸交易の荷を差配する組合幹部', mood: '明晰で堂々としている' },
  { role: 'mercenary', nationality: 'venice', port: 'ザラ', age: '30s', period: 'mid_16c', faceAngle: 'profile_left', gender: 'male', setting: 'アドリア海沿岸の船団護衛', mood: '細い目つき、無駄がない' },
  { role: 'noble', nationality: 'france', port: 'ボルドー', age: '30s', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'female', setting: 'ワイン交易に出資する地方貴族', mood: '優美で冷静' },
  { role: 'navigator', nationality: 'spain', port: 'サンルーカル', age: '50s', period: 'late_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: '大西洋横断路を知る熟練水先人', mood: '重みのある目' },
  { role: 'merchant', nationality: 'england', port: 'ロンドン', age: '20s', period: 'late_16c', faceAngle: 'front', gender: 'male', setting: '新興会社に出入りする若い商人', mood: '野心を隠した笑み' },
  { role: 'scholar', nationality: 'portugal', port: 'コインブラ', age: '40s', period: 'early_16c', faceAngle: 'three_quarter_right', gender: 'female', setting: '航海術を教える修道院育ちの学者', mood: '静謐で芯がある' },
  { role: 'barmaid', nationality: 'france', port: 'ディエップ', age: 'late teens', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'female', setting: '港の噂を聞き集める若い給仕', mood: '素直だが勘が鋭い' },
  { role: 'officer', nationality: 'ottoman', port: 'アルジェ', age: '30s', period: 'mid_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: '西地中海の護衛任務に就く士官', mood: '端正で厳しい' },
  { role: 'merchant', nationality: 'local', port: 'マラッカ', age: '30s', period: 'late_16c', faceAngle: 'three_quarter_left', gender: 'female', setting: '海峡交易の荷を取りまとめる現地仲買人', mood: '涼しい目、言葉少な' },
  { role: 'navigator', nationality: 'local', port: 'モンバサ', age: '40s', period: 'mid_16c', faceAngle: 'profile_right', gender: 'male', setting: '季節風と沿岸水路を読むスワヒリ海岸の水先人', mood: '落ち着き、遠くを見る目' },
  { role: 'merchant', nationality: 'local', port: 'カリカット', age: '50s', period: 'early_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: '胡椒交易の交渉を担う港の商人', mood: '穏やかだが底が読めない' },
  { role: 'scholar', nationality: 'local', port: 'ゴア', age: '20s', period: 'mid_16c', faceAngle: 'front', gender: 'female', setting: '複数言語の書簡を読める港町の書記', mood: '澄んだ目、知的な緊張' },
  { role: 'officer', nationality: 'portugal', port: 'モザンビーク', age: '40s', period: 'mid_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: 'インド洋航路の補給港を守る駐留士官', mood: '疲労を隠した実務家' },
  { role: 'merchant', nationality: 'portugal', port: 'マカオ', age: '30s', period: 'late_16c', faceAngle: 'three_quarter_right', gender: 'female', setting: '南シナ海交易に関わる若い仲買商', mood: '柔らかい笑み、抜け目ない' },
  { role: 'guild_master', nationality: 'spain', port: 'マニラ', age: '40s', period: 'late_16c', faceAngle: 'front', gender: 'male', setting: '新設港の銀と絹の流れを管理する組合幹部', mood: '几帳面で隙がない' },
  { role: 'navigator', nationality: 'netherlands', port: 'エンクハイゼン', age: '30s', period: 'late_16c', faceAngle: 'profile_left', gender: 'male', setting: '北海とバルト海の浅瀬を知る航海士', mood: '細い目つき、集中している' },
  { role: 'shipwright', nationality: 'england', port: 'ポーツマス', age: '50s', period: 'late_16c', faceAngle: 'three_quarter_right', gender: 'male', setting: '軍港で船体修理を任される熟練船大工', mood: '寡黙で頼れる' },
  { role: 'merchant', nationality: 'france', port: 'ナント', age: '40s', period: 'mid_16c', faceAngle: 'three_quarter_left', gender: 'female', setting: '大西洋沿岸の塩と布を扱う商人', mood: '穏やかで計算が速い' },
  { role: 'officer', nationality: 'venice', port: 'カンディア', age: '30s', period: 'mid_16c', faceAngle: 'front', gender: 'female', setting: '東地中海の拠点で護送船団を補佐する士官', mood: '端正、緊張感がある' },
  { role: 'scholar', nationality: 'ottoman', port: 'スミルナ', age: '40s', period: 'mid_16c', faceAngle: 'three_quarter_right', gender: 'female', setting: '港の税記録と航路情報を扱う学者', mood: '静かな威厳' },
  { role: 'mercenary', nationality: 'ottoman', port: 'チュニス', age: '30s', period: 'late_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: '商船護衛に雇われる地中海の護衛兵', mood: '鋭い視線、無駄がない' },
  { role: 'barmaid', nationality: 'england', port: 'ダートマス', age: '20s', period: 'late_16c', faceAngle: 'three_quarter_right', gender: 'female', setting: '帰港した船乗りから情報を集める港酒場の給仕', mood: '茶目っ気を抑えた明るさ' },
  { role: 'noble', nationality: 'venice', port: 'ラグーザ', age: '30s', period: 'early_16c', faceAngle: 'three_quarter_left', gender: 'male', setting: 'アドリア海交易に出資する都市貴族', mood: '優雅で観察深い' },
  { role: 'shipwright', nationality: 'local', port: 'アレクサンドリア', age: '40s', period: 'mid_16c', faceAngle: 'profile_right', gender: 'male', setting: '地中海と紅海の船を見分ける港の修理職人', mood: '穏やかだが職人気質' },
  { role: 'corsair', nationality: 'england', port: 'プリマス', age: '30s', period: 'late_16c', faceAngle: 'three_quarter_left', viewAngle: 'slightly_low', expression: 'confident', headwear: 'none', facialHair: 'trimmed_moustache', hairColor: 'dark_brown', eyeColor: 'grey', gender: 'male', setting: '大西洋沿岸で私掠に関わる荒れた身なりの船乗り', mood: '挑むような自信、軽い不敵さ' },
  { role: 'corsair', nationality: 'france', port: 'ラ・ロシェル', age: '40s', period: 'late_16c', faceAngle: 'profile_right', viewAngle: 'chin_down_eyes_up', expression: 'wary', headwear: 'cloth_cap', facialHair: 'short_beard', hairColor: 'chestnut', eyeColor: 'hazel', gender: 'male', setting: '沿岸襲撃と密貿易を行き来するフランスの海賊船乗り', mood: '警戒心が強く、抜け目ない' },
  { role: 'corsair', nationality: 'ottoman', port: 'アルジェ', age: '50s', period: 'mid_16c', faceAngle: 'three_quarter_right', viewAngle: 'slightly_high', expression: 'stern', headwear: 'turban', facialHair: 'small_goatee', hairColor: 'black', eyeColor: 'dark_brown', gender: 'male', setting: '西地中海で名を知られるバルバリア海賊の船長格', mood: '静かな威圧感' },
  { role: 'merchant', nationality: 'ottoman', port: 'イスタンブール', age: '30s', period: 'mid_16c', faceAngle: 'three_quarter_left', viewAngle: 'over_shoulder', expression: 'skeptical', headwear: 'turban', facialHair: 'trimmed_moustache', hairColor: 'black', eyeColor: 'amber', gender: 'male', setting: '香料と書簡を運ぶムスリム系の海上商人', mood: '疑い深いが礼を失わない' },
  { role: 'officer', nationality: 'ottoman', port: 'ロードス', age: '40s', period: 'mid_16c', faceAngle: 'front', viewAngle: 'slightly_low', expression: 'stern', headwear: 'turban', facialHair: 'short_beard', hairColor: 'black', eyeColor: 'dark_brown', gender: 'male', setting: '東地中海の軍船を率いるムスリム系士官', mood: '規律と威厳' },
  { role: 'merchant', nationality: 'local', port: 'ホルムズ', age: '50s', period: 'early_16c', faceAngle: 'profile_left', viewAngle: 'eye_level', expression: 'amused', headwear: 'turban', facialHair: 'small_goatee', hairColor: 'grey', eyeColor: 'hazel', gender: 'male', setting: 'ペルシア湾の宝石と馬を扱うムスリム系商人', mood: '老練で余裕がある' },
  { role: 'corsair', nationality: 'spain', port: 'カディス', age: '20s', period: 'mid_16c', faceAngle: 'three_quarter_right', viewAngle: 'slightly_high', expression: 'amused', headwear: 'soft_bonnet', facialHair: 'faint_stubble', hairColor: 'auburn', eyeColor: 'green', gender: 'male', setting: '正規船と海賊稼業の境目を渡る若い船乗り', mood: '笑みを隠した危うさ' },
  { role: 'corsair', nationality: 'venice', port: 'キプロス', age: '30s', period: 'early_16c', faceAngle: 'front', viewAngle: 'chin_down_eyes_up', expression: 'skeptical', headwear: 'flat_cap', facialHair: 'clean_shaven', hairColor: 'dark_blond', eyeColor: 'blue', gender: 'male', setting: '東地中海の通商路で半ば私掠に手を染める船乗り', mood: '冷めた目、軽い皮肉' },
  { role: 'missionary', nationality: 'portugal', port: 'ゴア', age: '40s', period: 'mid_16c', faceAngle: 'three_quarter_left', viewAngle: 'eye_level', expression: 'calm', headwear: 'zucchetto', facialHair: 'clean_shaven', hairColor: 'dark_brown', eyeColor: 'dark_brown', gender: 'male', setting: 'インド洋拠点で通訳と布教を担う宣教師', mood: '静かな説得力、柔らかい目' },
  { role: 'missionary', nationality: 'spain', port: 'マニラ', age: '30s', period: 'late_16c', faceAngle: 'three_quarter_right', viewAngle: 'slightly_high', expression: 'tired', headwear: 'zucchetto', facialHair: 'faint_stubble', hairColor: 'black', eyeColor: 'hazel', gender: 'male', setting: '太平洋航路の書簡を携える宣教師', mood: '疲れを帯びた誠実さ' },
  { role: 'sailor', nationality: 'portugal', port: 'リスボン', age: '20s', period: 'early_16c', faceAngle: 'profile_left', viewAngle: 'over_shoulder', expression: 'amused', headwear: 'cloth_cap', facialHair: 'faint_stubble', hairColor: 'chestnut', eyeColor: 'amber', gender: 'male', setting: '帆綱と荷揚げに慣れた若い水夫', mood: '軽さと油断のなさ' },
  { role: 'sailor', nationality: 'netherlands', port: 'ロッテルダム', age: '40s', period: 'late_16c', faceAngle: 'three_quarter_left', viewAngle: 'chin_down_eyes_up', expression: 'skeptical', headwear: 'flat_cap', facialHair: 'short_beard', hairColor: 'grey', eyeColor: 'blue', gender: 'male', setting: '北海の荒天を知る古参水夫', mood: '口数少なく、目だけが鋭い' },
  { role: 'officer', nationality: 'spain', port: 'カディス', age: '30s', period: 'mid_16c', faceAngle: 'three_quarter_right', viewAngle: 'slightly_low', expression: 'stern', headwear: 'morion', facialHair: 'trimmed_moustache', hairColor: 'dark_brown', eyeColor: 'grey', gender: 'male', setting: '港の守備と船団護衛を兼ねる士官', mood: '硬質な規律' },
  { role: 'mercenary', nationality: 'venice', port: 'カンディア', age: '30s', period: 'mid_16c', faceAngle: 'profile_right', viewAngle: 'eye_level', expression: 'wary', headwear: 'morion', facialHair: 'small_goatee', hairColor: 'black', eyeColor: 'green', gender: 'male', setting: '東地中海の船団に雇われる護衛兵', mood: '静かな警戒心' },
]

const state = {
  candidates: [],
  items: [],
  parsedRows: [],
  search: '',
  recordSearch: '',
  records: [],
  generatedImages: [],
  submittingGeneration: false,
  thread: null,
  job: null,
}

let jobPollTimer = 0

const $ = (id) => document.getElementById(id)

const elements = {
  summary: $('summary'),
  threadStatus: $('threadStatus'),
  jobStatus: $('jobStatus'),
  createImageThreadButton: $('createImageThreadButton'),
  refreshJobButton: $('refreshJobButton'),
  candidateCountInput: $('candidateCountInput'),
  generateCandidatesButton: $('generateCandidatesButton'),
  addCandidateButton: $('addCandidateButton'),
  approveAllCandidatesButton: $('approveAllCandidatesButton'),
  candidates: $('candidates'),
  roleInput: $('roleInput'),
  nationalityInput: $('nationalityInput'),
  portInput: $('portInput'),
  ageInput: $('ageInput'),
  periodInput: $('periodInput'),
  faceAngleInput: $('faceAngleInput'),
  viewAngleInput: $('viewAngleInput'),
  expressionInput: $('expressionInput'),
  headwearInput: $('headwearInput'),
  facialHairInput: $('facialHairInput'),
  hairColorInput: $('hairColorInput'),
  eyeColorInput: $('eyeColorInput'),
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
  recordSummary: $('recordSummary'),
  recordSearchInput: $('recordSearchInput'),
  refreshRecordsButton: $('refreshRecordsButton'),
  records: $('records'),
  imageSummary: $('imageSummary'),
  refreshImagesButton: $('refreshImagesButton'),
  generatedImages: $('generatedImages'),
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

function showToast(message, duration = 1800) {
  elements.toast.textContent = message
  elements.toast.classList.add('show')
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove('show')
  }, duration)
}

function saveWorkspace() {
  localStorage.setItem(workspaceStorageKey, JSON.stringify({
    candidates: state.candidates,
    items: state.items,
  }))
}

function loadWorkspace() {
  try {
    const parsed = JSON.parse(localStorage.getItem(workspaceStorageKey) || '{}')
    state.candidates = Array.isArray(parsed.candidates) ? parsed.candidates.map(normalizeBrief) : []
    state.items = Array.isArray(parsed.items) ? parsed.items.map(normalizeBrief) : []
  } catch {
    state.candidates = []
    state.items = []
  }
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
    viewAngle: valueFor(viewAngles, input.viewAngle, 'random'),
    expression: valueFor(expressions, input.expression, 'random'),
    headwear: valueFor(headwears, input.headwear, 'random'),
    facialHair: valueFor(facialHairs, input.facialHair, 'random'),
    hairColor: valueFor(hairColors, input.hairColor, 'random'),
    eyeColor: valueFor(eyeColors, input.eyeColor, 'random'),
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

function briefKey(brief) {
  return [
    brief.role,
    brief.nationality,
    brief.port,
    brief.age,
    brief.period,
    brief.gender,
    brief.faceAngle,
    brief.viewAngle,
    brief.expression,
    brief.headwear,
    brief.facialHair,
    brief.hairColor,
    brief.eyeColor,
    brief.setting,
  ].join('|')
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

function resolvedOption(brief, key, options) {
  const value = brief[key]
  if (value && value !== 'random') return value
  const choices = options.filter((option) => option[0] !== 'random')
  return choices[hashString(`${brief.id}:${key}`) % choices.length][0]
}

function faceAnglePrompt(brief) {
  const resolvedAngle = resolvedOption(brief, 'faceAngle', faceAngles)

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

function viewAnglePrompt(brief) {
  switch (resolvedOption(brief, 'viewAngle', viewAngles)) {
    case 'eye_level':
      return 'viewpoint: eye-level portrait, natural conversation camera height'
    case 'slightly_high':
      return 'viewpoint: seen slightly from above, head subtly tilted up so the eyes remain strong; no extreme top-down distortion'
    case 'slightly_low':
      return 'viewpoint: seen slightly from below, mild looking-up angle with readable jaw and collar; no heroic low-angle exaggeration'
    case 'chin_down_eyes_up':
      return 'viewpoint: chin slightly lowered with eyes looking up from under the brows, compact intense face angle'
    case 'over_shoulder':
      return 'viewpoint: shoulders angled away while the head turns back toward the viewer, readable face, not a full back view'
    default:
      return 'viewpoint: eye-level portrait, natural conversation camera height'
  }
}

function expressionPrompt(brief) {
  switch (resolvedOption(brief, 'expression', expressions)) {
    case 'calm':
      return 'expression: calm and observant, mouth relaxed, eyes doing most of the character work'
    case 'faint_smile':
      return 'expression: restrained faint smile, not broad or comedic'
    case 'skeptical':
      return 'expression: skeptical side glance, one brow slightly tense, controlled mouth'
    case 'wary':
      return 'expression: wary and alert, eyes narrowed slightly without becoming hostile'
    case 'tired':
      return 'expression: travel-worn tiredness, softened eyelids, no heavy realism or grime'
    case 'confident':
      return 'expression: quiet confidence, composed gaze and subtle lifted mouth corner'
    case 'amused':
      return 'expression: mildly amused, clever eyes, restrained smile'
    case 'stern':
      return 'expression: stern and disciplined, firm mouth, focused eyes'
    default:
      return 'expression: calm and observant, mouth relaxed, eyes doing most of the character work'
  }
}

function allowsTurban(brief) {
  return brief.nationality === 'ottoman'
    || brief.nationality === 'local'
    || /ムスリム|イスラム|ペルシア|紅海|ホルムズ|アレクサンドリア|アルジェ|チュニス|イスタンブール/.test(brief.setting || '')
}

function isMissionaryLike(brief) {
  return brief.role === 'missionary'
    || /宣教師|司祭|修道|イエズス|布教|missionary|jesuit|clergy|priest/i.test(brief.setting || '')
}

function allowsMorion(brief) {
  return ['officer', 'mercenary', 'corsair'].includes(brief.role)
    || /士官|傭兵|護衛|軍|兵|守備|私掠|海賊|戦闘|武装/.test(brief.setting || '')
}

function headwearChoicesFor(brief) {
  const choices = ['none', 'flat_cap', 'soft_bonnet', 'cloth_cap', 'hood_or_coif']
  if (allowsTurban(brief)) choices.push('turban')
  if (allowsMorion(brief)) choices.push('morion')
  if (isMissionaryLike(brief)) choices.push('zucchetto')
  return choices
}

function headwearPrompt(brief) {
  const choices = headwearChoicesFor(brief)
  let resolvedHeadwear = brief.headwear && brief.headwear !== 'random'
    ? brief.headwear
    : choices[hashString(`${brief.id}:headwear`) % choices.length]

  if (resolvedHeadwear === 'turban' && !allowsTurban(brief)) {
    resolvedHeadwear = 'cloth_cap'
  }
  if (resolvedHeadwear === 'zucchetto' && !isMissionaryLike(brief)) {
    resolvedHeadwear = 'soft_bonnet'
  }
  switch (resolvedHeadwear) {
    case 'none':
      return 'headwear variation: no hat, show a distinct hairline and hair silhouette appropriate to the 1500s'
    case 'flat_cap':
      return 'headwear variation: 16th-century flat cap, modest brim, period-correct cloth or wool'
    case 'soft_bonnet':
      return 'headwear variation: soft Renaissance bonnet, slouched cloth crown, not a modern beret'
    case 'cloth_cap':
      return 'headwear variation: simple working cloth cap or sailor wrap, practical and worn'
    case 'hood_or_coif':
      return 'headwear variation: hood, coif, or linen head covering appropriate to class and gender'
    case 'morion':
      return 'headwear variation: plain 16th-century morion helmet for a military or shipboard guard context, modest metal rim, no fantasy armor'
    case 'zucchetto':
      return 'headwear variation: small Catholic missionary zucchetto skullcap, simple dark cloth, restrained and period-appropriate, not a bishop mitre'
    case 'turban':
      return 'headwear variation: 16th-century Ottoman or eastern Mediterranean wrapped turban only if culturally appropriate; otherwise use a wrapped cloth cap'
    default:
      return 'headwear variation: no hat, show a distinct hairline and hair silhouette appropriate to the 1500s'
  }
}

function facialHairPrompt(brief) {
  const isFemale = brief.gender === 'female' || brief.role === 'barmaid'
  if (isFemale) {
    return 'facial hair variation: no facial hair'
  }

  switch (resolvedOption(brief, 'facialHair', facialHairs)) {
    case 'clean_shaven':
      return 'facial hair variation: clean-shaven face, clear jaw and mouth line'
    case 'faint_stubble':
      return 'facial hair variation: faint stubble drawn with sparse fine lines, not a beard-dominant face'
    case 'trimmed_moustache':
      return 'facial hair variation: short trimmed moustache, period-plausible and understated'
    case 'small_goatee':
      return 'facial hair variation: small neat goatee, restrained and not rugged'
    case 'short_beard':
      return 'facial hair variation: short trimmed beard, tidy 16th-century facial hair, not heavy fantasy beard'
    default:
      return 'facial hair variation: clean-shaven face, clear jaw and mouth line'
  }
}

function hairColorPrompt(brief) {
  switch (resolvedOption(brief, 'hairColor', hairColors)) {
    case 'black':
      return 'hair color variation: black hair, drawn with dense fine ink texture'
    case 'dark_brown':
      return 'hair color variation: dark brown hair, muted and natural'
    case 'chestnut':
      return 'hair color variation: chestnut brown hair, subtle warm wash'
    case 'auburn':
      return 'hair color variation: auburn hair, restrained reddish-brown tone'
    case 'dark_blond':
      return 'hair color variation: dark blond hair, desaturated ochre wash'
    case 'grey':
      return 'hair color variation: grey hair, age-appropriate and softly inked'
    case 'white':
      return 'hair color variation: white or pale grey hair, thin ink texture'
    default:
      return 'hair color variation: dark brown hair, muted and natural'
  }
}

function eyeColorPrompt(brief) {
  switch (resolvedOption(brief, 'eyeColor', eyeColors)) {
    case 'dark_brown':
      return 'eye color variation: dark brown eyes with clear inked eyelid lines'
    case 'hazel':
      return 'eye color variation: hazel eyes, subtle warm muted wash'
    case 'amber':
      return 'eye color variation: amber-brown eyes, restrained and not glowing'
    case 'grey':
      return 'eye color variation: grey eyes, cool muted wash'
    case 'blue':
      return 'eye color variation: muted blue eyes, natural and not bright fantasy'
    case 'green':
      return 'eye color variation: muted green eyes, natural and understated'
    default:
      return 'eye color variation: dark brown eyes with clear inked eyelid lines'
  }
}

function compositionVariationPrompt(brief) {
  const variations = [
    'composition variation: prop is partly cropped at the lower left edge, face remains dominant',
    'composition variation: prop is partly cropped at the lower right edge, avoid centered document pose',
    'composition variation: no obvious prop in the foreground; rely on clothing, expression, and silhouette',
    'composition variation: diagonal shoulder line and off-center head placement, UI crop still clean',
    'composition variation: one hand or rolled paper barely enters the lower frame, not covering the face',
  ]
  return variations[hashString(`${brief.id}:composition`) % variations.length]
}

function costumeGuidance(brief) {
  const isFemale = brief.gender === 'female' || brief.role === 'barmaid'
  const isElite = ['noble', 'officer', 'guild_master', 'scholar'].includes(brief.role)
  const isWorkingMaritime = ['navigator', 'sailor', 'shipwright', 'mercenary', 'corsair'].includes(brief.role)
  const isClergy = brief.role === 'missionary'

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
    if (brief.role === 'corsair') {
      guidance.push(
        'for Ottoman or Barbary corsair styling: layered kaftan or sailor robe worn for shipboard use, practical sash, weathered cloth, restrained weapon or rope detail near the lower frame',
        'avoid pirate stereotypes: no Caribbean pirate costume, tricorn, eyepatch, hook, skull emblem, striped shirt, 17th-century buccaneer coat, or flamboyant Golden Age pirate styling',
      )
    }
    return guidance
  }

  if (isFemale) {
    guidance.push(
      'European 16th-century women: linen smock, partlet or modest square neckline, fitted bodice, kirtle or gown, coif, hood, or simple cap according to class',
      'for tavern workers use practical linen/wool clothing and apron-like working layers, not court fantasy costume',
    )
  } else if (isClergy) {
    guidance.push(
      '16th-century Catholic missionary clothing: plain dark cassock or clerical robe over simple linen, small zucchetto or modest cap when used, travel-worn but orderly',
      'avoid modern Roman collar, bishop mitre, cardinal hat, Baroque clerical portrait, jeweled vestments, and theatrical saint imagery',
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

  if (brief.role === 'corsair') {
    guidance.push(
      'for corsair or privateer styling: 16th-century sailor clothing worn loose, open collar, weathered jerkin, practical sash or belt, and asymmetric layers; it must not read as Caribbean pirate costume',
      'avoid pirate stereotypes: no tricorn, eyepatch, hook, skull emblem, striped shirt, 17th-century buccaneer coat, or flamboyant Golden Age pirate styling',
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

function roleIdentityGuidance(brief) {
  const base = [
    'successful prompt pattern: line-art-first 2D hand-drawn head-and-shoulders character portrait, clear profession through 16th-century clothing and one subtle prop, muted wash background, no busy scene',
    'historical cues come from clothing construction, social role, posture, age, and work context; do not add photographic skin, western fantasy toughness, grime, scars, oversized hands, weapons, or muscular silhouette',
  ]

  switch (brief.role) {
    case 'navigator':
      return [
        ...base,
        'role cue: maritime pilot or route reader, shown with a small astrolabe, folded chart edge, or simple corded tool near the lower edge; not a pirate, not a naval hero',
      ]
    case 'sailor':
      return [
        ...base,
        'role cue: working sailor shown through practical shipboard clothing, rope or sailcloth edge near the lower frame, weathered posture, and alert eyes; not a pirate costume and not a heroic officer portrait',
      ]
    case 'barmaid':
      return [
        ...base,
        'role cue: tavern worker shown through practical linen and wool layers, apron-like work layer, and alert social expression; no pin-up styling, no fantasy tavern costume',
      ]
    case 'merchant':
      return [
        ...base,
        'role cue: maritime trader shown through sober quality fabric, account cord, small purse, or folded letter edge; no ostentatious court costume',
      ]
    case 'officer':
      return [
        ...base,
        'role cue: 16th-century officer shown through restrained bearing, fitted doublet, modest cloak, and disciplined expression; not a modern naval uniform, not a musketeer',
      ]
    case 'mercenary':
      return [
        ...base,
        'role cue: hired guard or escort shown through worn but period-correct clothing and one small belt detail; avoid western fantasy rogue, huge shoulders, heavy armor, and theatrical scars',
      ]
    case 'corsair':
      return [
        ...base,
        'role cue: 16th-century corsair or privateer shown through period sailor clothing worn loose or weathered, a small sea-worn token, rope, dagger hilt, or folded letter edge near the lower frame',
        'pirate guardrail: not a Caribbean pirate, not Golden Age piracy, no tricorn hat, no eyepatch, no hook hand, no skull symbols, no striped pirate costume; keep it as 1500s maritime clothing slightly disordered',
      ]
    case 'missionary':
      return [
        ...base,
        'role cue: 16th-century missionary shown through plain clerical travel clothing, small book or folded letter edge, restrained zucchetto or simple cap, and calm persuasive eyes; not a modern priest portrait',
      ]
    case 'guild_master':
      return [
        ...base,
        'role cue: guild authority shown through composed expression, neat clothing, and a small ledger or seal case at the lower edge; no bureaucratic modern suit',
      ]
    case 'shipwright':
      return [
        ...base,
        'role cue: shipwright shown through simple work cap, plain doublet or jerkin, and a small wooden ruler or marking gauge; not a rugged laborer portrait, not rough hands in the foreground',
      ]
    case 'noble':
      return [
        ...base,
        'role cue: noble status shown through restrained fabric quality and posture, not jewelry overload or fantasy court glamour',
      ]
    case 'scholar':
      return [
        ...base,
        'role cue: scholar or chart clerk shown through plain scholarly clothing, focused eyes, and a rolled parchment edge; no readable text, no crowded study background',
      ]
    default:
      return base
  }
}

function genderHandlingGuidance(brief) {
  if (brief.gender === 'male') {
    return [
      'male character handling: adult male with controlled Japanese game-illustration stylization, memorable slightly emphasized eyes, clean facial silhouette, modest jaw and nose, restrained expression, facial hair follows the explicit facial hair variation only',
      'male appeal: make him cooler and more characterful than a realistic portrait through elegant eye shape, clear brows, simplified planes, and subtle attractive distortion; do not make him comedic, chibi, cartoonish, or childlike',
      'male failure mode to avoid: rugged western RPG man, unrequested beard-dominant face, muscular laborer, fantasy rogue, gritty hero, fashion model beauty, photoreal skin, cinematic toughness',
    ]
  }

  if (brief.gender === 'female' || brief.role === 'barmaid') {
    return [
      'female character handling: adult woman with controlled Japanese game-illustration stylization, memorable slightly emphasized eyes, composed expression, historically plausible hair covering or cap when appropriate, and practical clothing cues rather than glamour',
      'female appeal: make her cuter and more characterful than a realistic portrait through elegant eye shape, clean silhouette, simplified planes, and subtle attractive distortion; do not make her comedic, chibi, cartoonish, or childlike',
      'female failure mode to avoid: pin-up styling, fantasy tavern girl, court dress excess, modern makeup, photoreal model face, glossy anime cel shading',
    ]
  }

  return [
    'character handling: adult human face with controlled Japanese game-illustration stylization; keep the design memorable through slightly emphasized eyes, clean silhouette, clothing structure, and one subtle role cue',
  ]
}

function styleGuidance() {
  return [
    `最重要の画風指定: ${coreStylePhrase}`,
    '用途指定: 会話ウィンドウ用の顔グラフィック、ジョブや職業が一目で伝わる日本のゲームキャラクター肖像',
    '画面上の第一印象: 2D手描きの日本のコンソールRPG設定画・会話用顔グラとして見えること',
    '線画優先: 線画が塗りと陰影より強く見える、細く繊細で抑制されたインク線、輪郭線は太くしない',
    '描線密度: 髪・まぶた・鼻筋・唇・襟・布の皺には細い線を多めに入れ、肌の面は塗り込みすぎず余白を残す',
    '陰影: 光源再現ではなく、細いハッチングとクロスハッチングの線の重なりで頬・鼻梁・目元・首・襟を軽く立体化する',
    '塗り: 彩度を落とした淡い水彩、薄い影色を少量重ねる、紙に染み込むような透明感、線画を塗りで潰さない',
    '顔: 日本のゲームイラストとして整理された目鼻立ち、印象に残る目、静かな表情、端正なキャラクターデザイン',
    '目力と誇張: 目はリアルな比率より少しだけ大きく印象的に、瞳とまぶたの線に情報量を置く。鼻・口・顎は整理して、かっこいい/かわいいイラストならではの魅力を出す',
    '誇張の上限: コミカル、デフォルメ強め、ちびキャラ、子供っぽさ、巨大なアニメ目、漫画的な記号顔にはしない',
    'イラスト化: 肌の質感、毛穴、強い立体レンダリング、複雑な反射光、写真のような質感描写は入れない',
    '服飾の描写: 16世紀の衣服構造を細い線で読み取れるように描き、布の質感は淡い水彩と線影で出す',
    '失敗判定: 実在人物の肖像、重い立体レンダー、西洋肖像画、古い銅版画そのもの、洋ゲー風、映画的レンダー、厚塗りコンセプトアートに見える場合は誤り',
  ]
}

function styleProfile() {
  return {
    core: coreStylePhrase,
    targetRead: '2D hand-drawn Japanese console tactical RPG conversation portrait, delicate line art first, faded watercolor shadows',
    successfulPromptPattern: [
      'line-art-first 2D hand-drawn head-and-shoulders portrait',
      'profession shown by 16th-century clothing and one subtle prop',
      'muted wash background without a busy scene',
      'historical cues from clothing, posture, age, and social role',
    ],
    mustHave: [
      'thin restrained ink linework',
      'visible hatching and cross-hatching on face, neck, hair, collar, and costume folds',
      'faded transparent watercolor shadows',
      'varied viewpoint, expression, headwear, facial hair, hair color, eye color, and prop placement across portraits',
      'Japanese game character-design facial simplification',
      'slightly emphasized memorable eyes with elegant eyelid lines',
      'controlled attractive stylization without comedy or chibi proportions',
      'skin left partly as pale paper and light wash rather than fully rendered',
      '16th-century costume details readable through linework',
    ],
    rejectIfReadsAs: [
      'western museum portrait',
      'old master oil painting',
      'literal antique print',
      'highly rendered western RPG portrait',
      'cinematic character render',
      'thick opaque digital painting',
      'rugged western fantasy character',
      'fashion model portrait',
      'cartoon gag face',
      'chibi character',
      'oversized anime eyes',
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
    'original 2D hand-drawn Japanese console tactical RPG face portrait of a 16th-century Renaissance maritime character',
    'must read as line-art-first Japanese game character portrait art and character design, not as a rendered portrait',
    role,
    nationality,
    gender !== '未指定' ? gender : '',
    age !== '未指定' ? age : '',
    brief.setting,
    brief.mood,
    brief.port ? `associated with ${brief.port}` : '',
    'head and shoulders portrait, UI-ready face icon crop',
    faceAnglePrompt(brief),
    viewAnglePrompt(brief),
    expressionPrompt(brief),
    headwearPrompt(brief),
    facialHairPrompt(brief),
    hairColorPrompt(brief),
    eyeColorPrompt(brief),
    compositionVariationPrompt(brief),
    ...costumeGuidance(brief),
    ...roleIdentityGuidance(brief),
    ...genderHandlingGuidance(brief),
    ...styleGuidance(),
    'self-check before final image: if shading, skin texture, lighting, or painted volume dominates the linework, redraw it flatter and more illustrated with delicate Japanese game linework and faded watercolor shadows',
    'self-check for appeal: the face should have memorable eye power and controlled cool or cute illustration distortion, but must not become comedic, chibi, childish, or symbol-like',
    'expressive eyes and simplified facial structure arranged into a memorable game portrait',
    'simple parchment-toned or muted wash background, no dramatic lighting',
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
    'Caribbean pirate costume',
    'buccaneer costume',
    'tricorn hat',
    'eyepatch',
    'hook hand',
    'skull emblem',
    'frock coat',
    'waistcoat',
    'cravat',
    'periwig',
    'cavalier hat',
    'musketeer costume',
    'modern naval uniform',
    'modern clothing',
    'modern clerical collar',
    'bishop mitre',
    'cardinal hat',
    'Baroque clerical portrait',
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
        gender: columns[8],
        viewAngle: columns[9],
        expression: columns[10],
        headwear: columns[11],
        facialHair: columns[12],
        hairColor: columns[13],
        eyeColor: columns[14],
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
    labelFor(viewAngles, brief.viewAngle),
    labelFor(expressions, brief.expression),
    labelFor(headwears, brief.headwear),
    labelFor(facialHairs, brief.facialHair),
    labelFor(hairColors, brief.hairColor),
    labelFor(eyeColors, brief.eyeColor),
    labelFor(genders, brief.gender),
    brief.setting,
    brief.mood,
  ].join(' ').toLowerCase().includes(needle)
}

function generateCandidates({ silent = false } = {}) {
  const requestedCount = Math.max(1, Math.min(candidateSeeds.length, Number(elements.candidateCountInput.value) || candidateSeeds.length))
  const existingKeys = new Set(state.items.map(briefKey))
  const nextCandidates = []

  for (const seed of candidateSeeds) {
    if (nextCandidates.length >= requestedCount) break
    const brief = normalizeBrief(seed)
    const key = briefKey(brief)
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    nextCandidates.push(brief)
  }

  state.candidates = nextCandidates
  saveWorkspace()
  renderCandidates()
  if (!silent) {
    showToast(`${nextCandidates.length}件の候補を作成しました`)
  }
}

function addOneCandidate() {
  const existingKeys = new Set([...state.items, ...state.candidates].map(briefKey))
  const nextSeed = candidateSeeds.find((seed) => !existingKeys.has(briefKey(normalizeBrief(seed))))
  if (!nextSeed) {
    showToast('追加できる未使用候補がありません')
    return
  }
  state.candidates = [...state.candidates, normalizeBrief(nextSeed)]
  saveWorkspace()
  renderCandidates()
  showToast('候補を1件追加しました')
}

function renderCandidates() {
  elements.candidates.replaceChildren()

  if (!state.candidates.length) {
    const empty = document.createElement('div')
    empty.className = 'mini-empty'
    empty.textContent = '候補なし'
    elements.candidates.append(empty)
    return
  }

  for (const candidate of state.candidates) {
    elements.candidates.append(createCandidateCard(candidate))
  }
}

function createCandidateCard(brief) {
  const card = document.createElement('article')
  card.className = 'candidate-card'

  const head = document.createElement('div')
  head.className = 'brief-head'

  const title = document.createElement('h3')
  title.textContent = briefTitle(brief)

  const approveButton = document.createElement('button')
  approveButton.type = 'button'
  approveButton.className = 'primary'
  approveButton.textContent = '承認'
  approveButton.addEventListener('click', () => approveCandidate(brief.id))

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.textContent = '却下'
  removeButton.addEventListener('click', () => {
    state.candidates = state.candidates.filter((item) => item.id !== brief.id)
    saveWorkspace()
    renderCandidates()
  })

  const actions = document.createElement('div')
  actions.className = 'card-actions'
  actions.append(approveButton, removeButton)
  head.append(title, actions)

  const fields = document.createElement('div')
  fields.className = 'candidate-fields'
  fields.append(
    editableSelect(brief, 'role', roles),
    editableSelect(brief, 'nationality', nationalities),
    editableText(brief, 'port', '街'),
    editableSelect(brief, 'age', ages),
    editableSelect(brief, 'period', periods),
    editableSelect(brief, 'faceAngle', faceAngles),
    editableSelect(brief, 'viewAngle', viewAngles),
    editableSelect(brief, 'expression', expressions),
    editableSelect(brief, 'headwear', headwears),
    editableSelect(brief, 'facialHair', facialHairs),
    editableSelect(brief, 'hairColor', hairColors),
    editableSelect(brief, 'eyeColor', eyeColors),
    editableSelect(brief, 'gender', genders),
  )

  const setting = editableTextarea(brief, 'setting', '設定')
  const mood = editableText(brief, 'mood', '表情')
  card.append(head, fields, setting, mood)
  return card
}

function editableSelect(brief, key, options) {
  const label = document.createElement('label')
  label.className = 'field compact-edit'
  const caption = document.createElement('span')
  caption.textContent = {
    role: '役職',
    nationality: '国籍',
    age: '年齢',
    period: '年代',
    faceAngle: '向き',
    viewAngle: '視点',
    expression: '表情',
    headwear: '帽子',
    facialHair: '髭',
    hairColor: '髪色',
    eyeColor: '瞳',
    gender: '性別',
  }[key] || key
  const select = document.createElement('select')
  fillOptions(select, options)
  select.value = brief[key]
  select.addEventListener('change', () => {
    brief[key] = select.value
    saveWorkspace()
  })
  label.append(caption, select)
  return label
}

function editableText(brief, key, captionText) {
  const label = document.createElement('label')
  label.className = 'field compact-edit'
  const caption = document.createElement('span')
  caption.textContent = captionText
  const input = document.createElement('input')
  input.value = brief[key] || ''
  input.autocomplete = 'off'
  input.addEventListener('input', () => {
    brief[key] = input.value.trim()
    saveWorkspace()
  })
  label.append(caption, input)
  return label
}

function editableTextarea(brief, key, captionText) {
  const label = document.createElement('label')
  label.className = 'field compact-edit full-edit'
  const caption = document.createElement('span')
  caption.textContent = captionText
  const textarea = document.createElement('textarea')
  textarea.rows = 2
  textarea.value = brief[key] || ''
  textarea.spellcheck = false
  textarea.addEventListener('input', () => {
    brief[key] = textarea.value.trim()
    saveWorkspace()
  })
  label.append(caption, textarea)
  return label
}

function approveCandidate(id) {
  const candidate = state.candidates.find((item) => item.id === id)
  if (!candidate) return
  state.candidates = state.candidates.filter((item) => item.id !== id)
  addBriefs([candidate])
  saveWorkspace()
  renderCandidates()
}

function approveAllCandidates() {
  if (!state.candidates.length) {
    showToast('承認する候補がありません')
    return
  }
  const candidates = [...state.candidates]
  state.candidates = []
  addBriefs(candidates)
  saveWorkspace()
  renderCandidates()
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
  generateButton.textContent = '送信'
  generateButton.disabled = state.submittingGeneration || isJobRunning()
  generateButton.addEventListener('click', () => requestGeneration([brief]).catch((error) => showToast(error.message)))

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.textContent = '削除'
  removeButton.addEventListener('click', () => {
    state.items = state.items.filter((item) => item.id !== brief.id)
    saveWorkspace()
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
    labelFor(viewAngles, brief.viewAngle),
    labelFor(expressions, brief.expression),
    labelFor(headwears, brief.headwear),
    labelFor(facialHairs, brief.facialHair),
    labelFor(hairColors, brief.hairColor),
    labelFor(eyeColors, brief.eyeColor),
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

function recordStatusLabel(status) {
  switch (status) {
    case 'queued':
      return '待機'
    case 'generating':
      return '生成中'
    case 'generated':
      return '生成済み'
    case 'image_missing':
      return '画像未検出'
    case 'linked':
      return '実装紐づけ済み'
    case 'failed':
      return '失敗'
    default:
      return status || '未送信'
  }
}

function recordHeading(record) {
  return record.displayName
    || record.title
    || [
      labelFor(roles, record.role),
      labelFor(nationalities, record.nationality),
      record.port,
    ].filter(Boolean).join(' / ')
    || record.id
}

function matchesRecordSearch(record) {
  const needle = state.recordSearch.trim().toLowerCase()
  if (!needle) return true
  return [
    record.displayName,
    record.implementationId,
    record.title,
    labelFor(roles, record.role),
    labelFor(nationalities, record.nationality),
    record.port,
    labelFor(ages, record.age),
    labelFor(periods, record.period),
    labelFor(faceAngles, record.faceAngle),
    labelFor(viewAngles, record.viewAngle),
    labelFor(expressions, record.expression),
    labelFor(headwears, record.headwear),
    labelFor(facialHairs, record.facialHair),
    labelFor(hairColors, record.hairColor),
    labelFor(eyeColors, record.eyeColor),
    labelFor(genders, record.gender),
    record.setting,
    record.mood,
    record.notes,
    record.imagePath,
  ].join(' ').toLowerCase().includes(needle)
}

function renderRecords() {
  const filtered = state.records.filter(matchesRecordSearch)
  elements.recordSummary.textContent = `${filtered.length} / ${state.records.length}件`
  elements.records.replaceChildren()

  if (!filtered.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.textContent = '画像専用スレッドへ送信すると、ここに生成履歴と実装用の紐づけ欄が残ります'
    elements.records.append(empty)
    return
  }

  for (const record of filtered) {
    elements.records.append(createRecordCard(record))
  }
}

function createRecordCard(record) {
  const card = document.createElement('article')
  card.className = 'record-card'

  const preview = document.createElement('div')
  preview.className = 'record-preview'
  if (record.imagePath) {
    const image = document.createElement('img')
    image.src = `/api/portrait-image?path=${encodeURIComponent(record.imagePath)}`
    image.alt = recordHeading(record)
    preview.append(image)
  } else {
    preview.textContent = '画像未設定'
  }

  const body = document.createElement('div')
  body.className = 'record-body'

  const head = document.createElement('div')
  head.className = 'brief-head'
  const title = document.createElement('h3')
  title.textContent = recordHeading(record)
  const status = document.createElement('span')
  status.className = `chip status-chip status-${record.status || 'unknown'}`
  status.textContent = recordStatusLabel(record.status)
  head.append(title, status)

  const meta = document.createElement('div')
  meta.className = 'brief-meta'
  for (const value of [
    labelFor(roles, record.role),
    labelFor(nationalities, record.nationality),
    record.port,
    labelFor(ages, record.age),
    labelFor(periods, record.period),
    labelFor(faceAngles, record.faceAngle),
    labelFor(viewAngles, record.viewAngle),
    labelFor(expressions, record.expression),
    labelFor(headwears, record.headwear),
    labelFor(facialHairs, record.facialHair),
    labelFor(hairColors, record.hairColor),
    labelFor(eyeColors, record.eyeColor),
    labelFor(genders, record.gender),
  ].filter(Boolean)) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = value
    meta.append(chip)
  }

  const setting = document.createElement('p')
  setting.className = 'setting'
  setting.textContent = [record.setting, record.mood].filter(Boolean).join(' / ') || '-'

  const fields = document.createElement('div')
  fields.className = 'record-fields'
  fields.append(
    recordTextField(record, 'displayName', '名前'),
    recordTextField(record, 'implementationId', '実装ID'),
    recordTextField(record, 'imagePath', '画像パス', 'wide-field'),
    recordTextareaField(record, 'notes', 'メモ', 'wide-field'),
  )

  const details = document.createElement('details')
  details.className = 'record-details'
  const summary = document.createElement('summary')
  summary.textContent = 'プロンプト'
  const prompt = document.createElement('textarea')
  prompt.className = 'prompt-box'
  prompt.rows = 6
  prompt.readOnly = true
  prompt.value = record.prompt || ''
  details.append(summary, prompt)

  body.append(head, meta, setting, fields, details)
  card.append(preview, body)
  return card
}

function recordTextField(record, key, captionText, extraClass = '') {
  const label = document.createElement('label')
  label.className = `field compact-edit ${extraClass}`.trim()
  const caption = document.createElement('span')
  caption.textContent = captionText
  const input = document.createElement('input')
  input.value = record[key] || ''
  input.autocomplete = 'off'
  input.addEventListener('change', () => {
    updateRecord(record.id, { [key]: input.value }).catch((error) => showToast(error.message))
  })
  label.append(caption, input)
  return label
}

function recordTextareaField(record, key, captionText, extraClass = '') {
  const label = document.createElement('label')
  label.className = `field compact-edit ${extraClass}`.trim()
  const caption = document.createElement('span')
  caption.textContent = captionText
  const textarea = document.createElement('textarea')
  textarea.rows = 2
  textarea.value = record[key] || ''
  textarea.spellcheck = false
  textarea.addEventListener('change', () => {
    updateRecord(record.id, { [key]: textarea.value }).catch((error) => showToast(error.message))
  })
  label.append(caption, textarea)
  return label
}

async function updateRecord(id, patch) {
  const response = await fetch(`/api/portrait-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ patch }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`)
  }
  const index = state.records.findIndex((record) => record.id === id)
  if (index >= 0) {
    state.records[index] = data.record
  }
  renderRecords()
}

function renderGeneratedImages() {
  elements.imageSummary.textContent = `${state.generatedImages.length}件`
  elements.generatedImages.replaceChildren()

  if (!state.generatedImages.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-state compact-empty'
    empty.textContent = '画像なし'
    elements.generatedImages.append(empty)
    return
  }

  for (const image of state.generatedImages) {
    elements.generatedImages.append(createImageTile(image))
  }
}

function createImageTile(image) {
  const tile = document.createElement('article')
  tile.className = 'image-tile'

  const preview = document.createElement('img')
  preview.src = `/api/portrait-image?path=${encodeURIComponent(image.path)}`
  preview.alt = image.name

  const name = document.createElement('div')
  name.className = 'image-name'
  name.textContent = image.name

  const meta = document.createElement('div')
  meta.className = 'image-meta'
  meta.textContent = image.updatedAt ? new Date(image.updatedAt).toLocaleString() : ''

  tile.append(preview, name, meta)
  return tile
}

async function requestGeneration(briefs) {
  if (!briefs.length) {
    showToast('生成対象がありません')
    return
  }

  state.submittingGeneration = true
  elements.generateAllButton.disabled = true
  elements.jobStatus.textContent = `送信中: ${briefTitle(briefs[0]) || '生成対象'}`
  elements.jobStatus.classList.add('is-running')
  renderCards()

  try {
    const response = await fetch('/api/app-server/generate', {
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
    showToast(`${data.count}件を生成開始しました。状況は自動更新されます`, 5000)
    await refreshJobStatus()
    await Promise.allSettled([loadRecords(), loadGeneratedImages()])
    startJobPolling()
  } finally {
    state.submittingGeneration = false
    elements.generateAllButton.disabled = isJobRunning()
    renderCards()
  }
}

function addBriefs(briefs) {
  const existingKeys = new Set(state.items.map(briefKey))
  const nextBriefs = []
  for (const brief of briefs.map(normalizeBrief)) {
    const key = briefKey(brief)
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    nextBriefs.push(brief)
  }
  state.items = [...state.items, ...nextBriefs]
  saveWorkspace()
  renderCards()
  showToast(`${nextBriefs.length}件追加しました`)
}

function addSingle() {
  addBriefs([{
    role: elements.roleInput.value,
    nationality: elements.nationalityInput.value,
    port: elements.portInput.value,
    age: elements.ageInput.value,
    period: elements.periodInput.value,
    faceAngle: elements.faceAngleInput.value,
    viewAngle: elements.viewAngleInput.value,
    expression: elements.expressionInput.value,
    headwear: elements.headwearInput.value,
    facialHair: elements.facialHairInput.value,
    hairColor: elements.hairColorInput.value,
    eyeColor: elements.eyeColorInput.value,
    gender: elements.genderInput.value,
    setting: elements.settingInput.value,
    mood: elements.moodInput.value,
  }])
}

function bindEvents() {
  elements.createImageThreadButton.addEventListener('click', () => {
    createImageThread().catch((error) => showToast(error.message))
  })
  elements.refreshJobButton.addEventListener('click', () => {
    refreshJobStatus().catch((error) => showToast(error.message))
    loadRecords().catch((error) => showToast(error.message))
    loadGeneratedImages().catch((error) => showToast(error.message))
  })
  elements.generateCandidatesButton.addEventListener('click', generateCandidates)
  elements.addCandidateButton.addEventListener('click', addOneCandidate)
  elements.approveAllCandidatesButton.addEventListener('click', approveAllCandidates)
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
    saveWorkspace()
    renderCards()
  })
  elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value
    renderCards()
  })
  elements.recordSearchInput.addEventListener('input', (event) => {
    state.recordSearch = event.target.value
    renderRecords()
  })
  elements.refreshRecordsButton.addEventListener('click', () => {
    loadRecords().catch((error) => showToast(error.message))
  })
  elements.refreshImagesButton.addEventListener('click', () => {
    loadGeneratedImages().catch((error) => showToast(error.message))
  })
}

async function loadImageThread() {
  const response = await fetch('/api/image-thread')
  const data = await response.json()
  state.thread = data
  renderThreadStatus()
}

async function createImageThread() {
  elements.createImageThreadButton.disabled = true
  try {
    const response = await fetch('/api/image-thread', { method: 'POST' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`)
    }
    state.thread = data
    renderThreadStatus()
    showToast('画像専用スレッドを用意しました')
  } finally {
    elements.createImageThreadButton.disabled = false
  }
}

function renderThreadStatus() {
  if (!state.thread?.threadId) {
    elements.threadStatus.textContent = '未接続'
    return
  }
  elements.threadStatus.textContent = `${state.thread.name || '顔グラ量産'} / ${state.thread.threadId}`
}

async function refreshJobStatus() {
  const response = await fetch('/api/app-server/job')
  const data = await response.json()
  state.job = data
  renderJobStatus()
  renderCards()
}

async function loadRecords() {
  const response = await fetch('/api/portrait-records')
  const data = await response.json()
  state.records = Array.isArray(data.records) ? data.records : []
  renderRecords()
}

async function loadGeneratedImages() {
  const response = await fetch('/api/generated-images')
  const data = await response.json()
  state.generatedImages = Array.isArray(data.images) ? data.images : []
  renderGeneratedImages()
}

function renderJobStatus() {
  const job = state.job
  if (!job || job.status === 'idle') {
    elements.jobStatus.textContent = '待機中'
    elements.jobStatus.classList.remove('is-running', 'is-failed')
    elements.generateAllButton.disabled = state.submittingGeneration
    return
  }
  const base = `${jobStatusLabel(job.status)} ${job.completed || 0} / ${job.count || 0}`
  elements.jobStatus.textContent = job.currentTitle
    ? `${base} / ${job.currentTitle}`
    : base
  elements.jobStatus.classList.toggle('is-running', isJobRunning())
  elements.jobStatus.classList.toggle('is-failed', job.status === 'failed')
  elements.generateAllButton.disabled = state.submittingGeneration || isJobRunning()
}

function jobStatusLabel(status) {
  switch (status) {
    case 'running':
      return '生成中'
    case 'completed':
      return '完了'
    case 'failed':
      return '失敗'
    default:
      return status || '待機'
  }
}

function isJobRunning() {
  return state.job?.status === 'running'
}

function startJobPolling() {
  if (jobPollTimer) return
  jobPollTimer = window.setInterval(() => {
    refreshJobStatus()
      .then(() => Promise.allSettled([loadRecords(), loadGeneratedImages()]))
      .then(() => {
        if (!isJobRunning()) {
          stopJobPolling()
        }
      })
      .catch(() => {})
  }, 4000)
}

function stopJobPolling() {
  if (!jobPollTimer) return
  window.clearInterval(jobPollTimer)
  jobPollTimer = 0
}

fillOptions(elements.roleInput, roles)
fillOptions(elements.nationalityInput, nationalities)
fillOptions(elements.ageInput, ages)
fillOptions(elements.periodInput, periods)
fillOptions(elements.faceAngleInput, faceAngles)
fillOptions(elements.viewAngleInput, viewAngles)
fillOptions(elements.expressionInput, expressions)
fillOptions(elements.headwearInput, headwears)
fillOptions(elements.facialHairInput, facialHairs)
fillOptions(elements.hairColorInput, hairColors)
fillOptions(elements.eyeColorInput, eyeColors)
fillOptions(elements.genderInput, genders)
elements.candidateCountInput.max = String(candidateSeeds.length)
elements.candidateCountInput.value = String(candidateSeeds.length)
elements.roleInput.value = 'navigator'
elements.nationalityInput.value = 'portugal'
elements.periodInput.value = 'strict_16c'
elements.faceAngleInput.value = 'random'
elements.viewAngleInput.value = 'random'
elements.expressionInput.value = 'random'
elements.headwearInput.value = 'random'
elements.facialHairInput.value = 'random'
elements.hairColorInput.value = 'random'
elements.eyeColorInput.value = 'random'
elements.rowsInput.placeholder = '役職,国籍,街,年齢,設定,表情・雰囲気,服飾年代,顔向き,性別,視点,表情,帽子,髭,髪色,瞳'
elements.rowsInput.value = defaultRows
loadWorkspace()
if (!state.candidates.length && !state.items.length) {
  generateCandidates({ silent: true })
}
bindEvents()
renderRowPreview()
renderCandidates()
renderCards()
renderRecords()
renderGeneratedImages()
loadImageThread().catch(() => {})
refreshJobStatus().then(() => {
  if (isJobRunning()) startJobPolling()
}).catch(() => {})
loadRecords().catch(() => {})
loadGeneratedImages().catch(() => {})
