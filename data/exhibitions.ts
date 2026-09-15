import { fetchExhibitions, type ExhibitionDTO, resolveImagePaths } from './api'

// ============ 类型定义 ============

export interface Exhibition {
  id: string
  type: '当前展览' | '展览预告' | '展览回顾'
  title: string
  image: string
  time: string
  location: string
  organizer: string
  intro: string
  liked?: boolean
  artworks?: ExhibitionArtwork[]
  statusText?: string
  reservable?: boolean
  ended?: boolean
  bookingDates?: Array<{ day: string; week: string; month: string; raw?: string }>
  bookingTimes?: string[]
  bookingQuota?: number
}

export interface ExhibitionArtwork {
  id: string
  title: string
  artist: string
  size: string
  material: string
  year: string
  image: string
}

// ============ 异步数据获取 ============

let _exhibitionsCache: Exhibition[] | null = null

export async function getExhibitions(): Promise<Exhibition[]> {
  if (_exhibitionsCache) return _exhibitionsCache
  try {
    const list = await fetchExhibitions()
    _exhibitionsCache = list.map(mapExhibition)
  } catch (_e) {
    // fallback 到本地数据
    _exhibitionsCache = getLocalExhibitions()
  }
  // 解析所有图片路径（真机需将 /assets/... 转为 wxfile://）
  const allImages: Array<{ image: string }> = []
  _exhibitionsCache.forEach(e => {
    allImages.push(e)
    if (e.artworks) e.artworks.forEach(a => allImages.push(a))
  })
  resolveImagePaths(allImages)
  return _exhibitionsCache
}

function mapExhibition(dto: ExhibitionDTO): Exhibition {
  return {
    id: dto.id,
    type: dto.type as Exhibition['type'],
    title: dto.title,
    image: dto.image,
    time: dto.time || '',
    location: dto.location || '',
    organizer: dto.organizer || '',
    intro: dto.intro || '',
    liked: false,
    statusText: dto.status_text || undefined,
    reservable: dto.reservable || undefined,
    ended: dto.ended || undefined,
    bookingDates: Array.isArray(dto.booking_dates) ? dto.booking_dates : undefined,
    bookingTimes: Array.isArray(dto.booking_times) && dto.booking_times.length ? dto.booking_times : undefined,
    bookingQuota: dto.booking_quota || 5,
    artworks: (dto.artworks || []).map(a => ({
      id: a.id,
      title: a.title,
      artist: a.artist,
      size: a.size,
      material: a.material,
      year: a.year,
      image: a.image
    }))
  }
}

export async function getCurrentExhibition(): Promise<Exhibition> {
  const list = await getExhibitions()
  return list.find(e => e.type === '当前展览') || list[0]
}

/** 获取所有当前展览（可能多条） */
export async function getCurrentExhibitions(): Promise<Exhibition[]> {
  const list = await getExhibitions()
  return list.filter(e => e.type === '当前展览')
}

export async function getExhibitionReviews(): Promise<Exhibition[]> {
  const list = await getExhibitions()
  return list.filter(e => e.type === '展览回顾')
}

export async function getExhibitionPreviews(): Promise<Exhibition[]> {
  const list = await getExhibitions()
  return list.filter(e => e.type === '展览预告')
}

export async function findExhibition(id: string): Promise<Exhibition | undefined> {
  const list = await getExhibitions()
  return list.find(e => e.id === id)
}

// ============ 本地 fallback ============

const LOCAL_EXHIBITIONS: Exhibition[] = [
  {
    id: 'current-0', type: '当前展览', title: '问虫——齐白石的草间对话',
    image: '/assets/exhibitions/current-0.jpg', time: '2026年03月20日 至 2026年10月11日',
    location: '北京画院美术馆三、四层展厅', organizer: '中央美术学院、山东工艺美术学院、北京画院',
    intro: '从齐白石笔下的草虫世界出发，观看艺术家如何以细微观察、质朴笔墨与蓬勃生命力，在方寸纸面中展开一场跨越时间的草间对话。',
    reservable: true,
    bookingQuota: 10,
    artworks: []
  },
  {
    id: 'preview-5095', type: '展览预告', title: '灿然天地——关广志艺术展',
    image: '/assets/programs/preview-5095.jpg', time: '2026年8月7日起',
    location: '北京画院美术馆', organizer: '',
    intro: '北京画院"二十世纪中国美术大家研究系列"第69个项目，汇集关广志水彩、铜版画精品70余件。',
    statusText: '即将开展', reservable: true,
    bookingDates: [],
    bookingTimes: [],
    artworks: []
  },
  {
    id: 'review-0', type: '展览回顾', title: '未来白石美育艺术季·童心童语',
    image: '/assets/exhibitions/review-0.jpg', time: '2026年07月23日 至 2026年08月02日',
    location: '', organizer: '',
    intro: '此次展览与北京画院年度特展"问虫——齐白石的草间对话"同期举办。在主展中，白石老人以一位伏身草间数十年的田野考察家现身，而"童心童语"选择了另一条路径：当成年人的目光向下俯身、贴近地面、凝视微小，孩子们的目光则向上仰望、平视、触摸、想象。两种目光在展厅中形成一种微妙的对位——同是草间世界，却因观看者的不同而迥异。',
    artworks: []
  },
  {
    id: 'review-1', type: '展览回顾', title: '真言可贵——周思聪的变法之路',
    image: '/assets/exhibitions/review-1.jpg', time: '2026年06月19日 至 2026年07月19日',
    location: '', organizer: '中国美术家协会、中国美术馆、中央美术学院、中国女画家协会、北京美术家协会、北京画院',
    intro: '本次展览由中国美术家协会、中国美术馆、中央美术学院、中国女画家协会、北京美术家协会、北京画院共同主办，作为北京画院"二十世纪中国美术大家系列展"的重要篇章，展览呈现周思聪在艺术道路上的持续探索与变革。',
    artworks: [
      { id: 'review-1-0', title: '蒋兆和先生肖像', artist: '周思聪', size: '60 × 107 cm', material: '纸本设色', year: '1962', image: '/assets/exhibition-artworks/review-1-0.jpg' },
      { id: 'review-1-1', title: '清晨', artist: '周思聪', size: '80 × 119 cm', material: '绢本设色', year: '1963', image: '/assets/exhibition-artworks/review-1-1.jpg' },
      { id: 'review-1-2', title: '长白青松', artist: '周思聪', size: '112 × 95 cm', material: '纸本设色', year: '1973', image: '/assets/exhibition-artworks/review-1-2.jpg' }
    ]
  },
  {
    id: 'review-2', type: '展览回顾', title: '京西揽胜——"三山五园"主题创作展',
    image: '/assets/exhibitions/review-2.jpg', time: '2026年05月29日 至 2026年06月14日',
    location: '北京画院美术馆一、二层', organizer: '北京画院',
    intro: '北京文化艺术基金2025年度资助，北京画院主办的"京西揽胜——\u2018三山五园\u2019主题创作展"于2026年5月29日在北京画院美术馆一、二层正式启幕。',
    artworks: [
      { id: 'review-2-0', title: '翠峦春晓万寿山', artist: '庄小雷、郭宝君、牛朝、买鸿钧 等', size: '145 × 360 cm', material: '纸本设色', year: '2024', image: '/assets/exhibition-artworks/review-2-0.jpg' },
      { id: 'review-2-1', title: '春风和煦玉泉山', artist: '庄小雷、郭宝君、牛朝、买鸿钧 等', size: '145 × 360 cm', material: '纸本设色', year: '2024', image: '/assets/exhibition-artworks/review-2-1.jpg' },
      { id: 'review-2-2', title: '翠湖湿地印象', artist: '徐卫国', size: '137 × 68 cm', material: '纸本设色', year: '2024', image: '/assets/exhibition-artworks/review-2-2.jpg' }
    ]
  },
  {
    id: 'review-3', type: '展览回顾', title: '已有丹青约——蒋采苹作品展',
    image: '/assets/exhibitions/review-3.jpg', time: '2026年04月30日 至 2026年05月24日',
    location: '北京画院美术馆', organizer: '中央美术学院、中国工笔画学会、中国女画家协会、北京画院',
    intro: '为缅怀中国当代工笔重彩画艺术大家蒋采苹先生，本次展览汇集蒋先生跨越半个多世纪的工笔重彩、创作手稿、写生佳作等，尽显工笔重彩之华。',
    artworks: [
      { id: 'review-3-0', title: '三月三之夜（二联画）', artist: '蒋采苹', size: '180 × 180 cm', material: '工笔重彩', year: '1988', image: '/assets/exhibition-artworks/review-3-0.jpg' },
      { id: 'review-3-1', title: '金秋', artist: '蒋采苹', size: '170 × 97 cm', material: '工笔重彩', year: '1994', image: '/assets/exhibition-artworks/review-3-1.jpg' },
      { id: 'review-3-2', title: '雾中苗女', artist: '蒋采苹', size: '170 × 97 cm', material: '工笔重彩', year: '2012', image: '/assets/exhibition-artworks/review-3-2.jpg' }
    ]
  },
  {
    id: 'review-4', type: '展览回顾', title: '我代山川而言——亚明写生作品展',
    image: '/assets/exhibitions/review-4.jpg', time: '2026年03月27日 至 2026年04月26日',
    location: '北京画院美术馆', organizer: '',
    intro: '此次展览以写生为主题，展出60余件亚明先生在1960年至2000年间绘制于不同国家和地区的山川风情画作。',
    artworks: [
      { id: 'review-4-0', title: '夜航', artist: '亚明', size: '28 × 34 cm', material: '纸本设色', year: '年代未载', image: '/assets/exhibition-artworks/review-4-0.jpg' },
      { id: 'review-4-1', title: '夜航（铅笔稿）', artist: '亚明', size: '17 × 23 cm', material: '纸本铅笔', year: '年代未载', image: '/assets/exhibition-artworks/review-4-1.jpg' },
      { id: 'review-4-2', title: '西人岛有此一景', artist: '亚明', size: '66.5 × 44.5 cm', material: '纸本设色', year: '1983', image: '/assets/exhibition-artworks/review-4-2.jpg' }
    ]
  }
]

function getLocalExhibitions(): Exhibition[] {
  if (!_exhibitionsCache) {
    _exhibitionsCache = LOCAL_EXHIBITIONS
  }
  return _exhibitionsCache!
}

// ============ 同步兼容导出（deprecated，仅供渐进迁移） ============

/** @deprecated 使用 getExhibitions() 异步获取 */
export const EXHIBITION_REVIEWS: Exhibition[] = LOCAL_EXHIBITIONS.filter(e => e.type === '展览回顾')

/** @deprecated 使用 getExhibitionPreviews() 异步获取 */
export const EXHIBITION_PREVIEWS: Exhibition[] = LOCAL_EXHIBITIONS.filter(e => e.type === '展览预告')

/** @deprecated 使用 getCurrentExhibition() 异步获取 */
export const CURRENT_EXHIBITION: Exhibition = LOCAL_EXHIBITIONS[0]
