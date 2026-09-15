import { fetchPrograms, type ProgramDTO, resolveImagePaths } from './api'

// ============ 类型定义 ============

export interface OfficialProgram {
  id: string
  kind: '讲座预约' | '讲座回顾' | '活动预约' | '活动回顾'
  title: string
  image: string
  publishDate: string
  time?: string
  location?: string
  speaker?: string
  audience?: string
  summary: string
  sourceUrl: string
  statusText: string
  reservable: boolean
  ended?: boolean
  bookingDates?: Array<{ day: string; week: string; month: string; raw?: string }>
  bookingTimes?: string[]
  bookingQuota?: number
  liked?: boolean
}

// ============ 异步数据获取 ============

let _programsCache: OfficialProgram[] | null = null

export async function getAllProgramsAsync(): Promise<OfficialProgram[]> {
  if (_programsCache) return _programsCache
  try {
    const list = await fetchPrograms()
    _programsCache = list.map(mapProgram)
  } catch (_e) {
    _programsCache = getLocalPrograms()
  }
  resolveImagePaths(_programsCache)
  return _programsCache
}

function mapProgram(dto: ProgramDTO): OfficialProgram {
  return {
    id: dto.id,
    kind: dto.kind as OfficialProgram['kind'],
    title: dto.title,
    image: dto.image,
    publishDate: dto.publish_date || '',
    time: dto.time || undefined,
    location: dto.location || undefined,
    speaker: dto.speaker || undefined,
    audience: dto.audience || undefined,
    summary: dto.summary,
    sourceUrl: dto.source_url || '',
    statusText: dto.status_text || '',
    reservable: !!dto.reservable,
    ended: !!dto.ended || undefined,
    bookingDates: Array.isArray(dto.booking_dates) ? dto.booking_dates : undefined,
    bookingTimes: Array.isArray(dto.booking_times) ? dto.booking_times : undefined,
    bookingQuota: dto.booking_quota || 5,
    liked: false
  }
}

export async function findOfficialProgramAsync(id: string): Promise<OfficialProgram | undefined> {
  const list = await getAllProgramsAsync()
  return list.find(item => item.id === id)
}

/** @deprecated 展览预告已迁移到 exhibitions 模块，请直接使用 getExhibitionPreviews() */
export async function getExhibitionPreviewsAsync(): Promise<OfficialProgram[]> {
  // 展览预告不在 program kind 内，返回空数组
  return []
}

export async function getLectureReservationsAsync(): Promise<OfficialProgram[]> {
  const list = await getAllProgramsAsync()
  return list.filter(p => p.kind === '讲座预约')
}

export async function getLectureReviewsAsync(): Promise<OfficialProgram[]> {
  const list = await getAllProgramsAsync()
  return list.filter(p => p.kind === '讲座回顾')
}

export async function getActivityReviewsAsync(): Promise<OfficialProgram[]> {
  const list = await getAllProgramsAsync()
  return list.filter(p => p.kind === '活动回顾')
}

export async function getActivityReservationsAsync(): Promise<OfficialProgram[]> {
  const list = await getAllProgramsAsync()
  // “活动预约”只展示当前仍可报名的项目；已结束内容归入“活动回顾”。
  return list.filter(p => p.kind === '活动预约' && p.reservable && !p.ended)
}

// ============ 本地 fallback ============

const LOCAL_PROGRAMS: OfficialProgram[] = [
  {
    id: 'lecture-5081', kind: '讲座预约', title: '可惜无声——齐白石的草虫画研究',
    image: '/assets/programs/lecture-5081.jpg', publishDate: '2026.07.28',
    time: '2026年7月31日 9:30—11:30', location: '北京画院美术馆5层报告厅',
    speaker: '吕晓',
    summary: '从艺术源流、精神解读与书画辨伪三个方向，梳理齐白石工虫花卉的创作与鉴定逻辑。',
    sourceUrl: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=171&news=5081',
    statusText: '本期已结束', reservable: false, ended: true
  },
  {
    id: 'lecture-review-5082', kind: '讲座回顾', title: '写意画的文脉',
    image: '/assets/programs/review-5082.jpg', publishDate: '2026.07.29',
    speaker: '邵彦',
    summary: '通过大量作品实例梳理工笔、写意两支的发展脉络，分析从小写意到大写意的飞跃及其哲学、美学理念。',
    sourceUrl: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=171&news=5082',
    statusText: '查看回顾', reservable: false
  },
  {
    id: 'lecture-review-5041', kind: '讲座回顾', title: '立身误坠皮毛类——再谈齐白石与吴昌硕的恩怨',
    image: '/assets/programs/review-5041.jpg', publishDate: '2026.07.08',
    speaker: '吕晓',
    summary: '从日记、诗歌与绘画对比回到历史原境，解读齐白石如何把相关讥评转化为艺术革新的动力。',
    sourceUrl: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=171&news=5041',
    statusText: '查看回顾', reservable: false
  },
  {
    id: 'activity-5085', kind: '活动预约', title: '好饿的毛毛虫——皮影小剧场工作坊',
    image: '/assets/programs/activity-5085.jpg', publishDate: '2026.07.27',
    time: '2026年7月30日 9:30—11:30', location: '北京画院美术馆三层展厅门口集合',
    audience: '7—12岁儿童，每位儿童限一位家长陪同',
    summary: '结合"问虫——齐白石的草间对话"展览，在光影剧场中创作属于自己的小虫皮影故事。',
    sourceUrl: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5085',
    statusText: '报名已结束', reservable: false, ended: true
  },
  {
    id: 'activity-5084', kind: '活动预约', title: '与虫翩翩——创舞体验工作坊',
    image: '/assets/programs/activity-5084.jpg', publishDate: '2026.07.26',
    time: '2026年7月29日 9:30—11:30', location: '北京画院美术馆',
    audience: '7—12岁儿童，每位儿童限一位家长陪同',
    summary: '从齐白石笔下的草虫出发，以身体动作、想象与舞蹈感受自然节奏。',
    sourceUrl: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5084',
    statusText: '报名已结束', reservable: false, ended: true
  },
  {
    id: 'activity-review-5085', kind: '活动回顾', title: '好饿的毛毛虫——皮影小剧场工作坊回顾',
    image: '/assets/programs/activity-5085.jpg', publishDate: '2026.08.01',
    summary: '小朋友们用皮影讲述了自己的草虫故事，在光影中感受传统艺术的魅力。',
    sourceUrl: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5085',
    statusText: '查看回顾', reservable: false
  },
  {
    id: 'activity-review-5084', kind: '活动回顾', title: '与虫翩翩——创舞体验工作坊回顾',
    image: '/assets/programs/activity-5084.jpg', publishDate: '2026.07.30',
    summary: '孩子们在展厅中化身草虫，用肢体语言与齐白石笔下的自然生命展开对话。',
    sourceUrl: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5084',
    statusText: '查看回顾', reservable: false
  }
]

function getLocalPrograms(): OfficialProgram[] {
  if (!_programsCache) {
    _programsCache = LOCAL_PROGRAMS
  }
  return _programsCache!
}

// ============ 同步兼容导出 ============

/** @deprecated 使用 getLectureReservationsAsync() */
export const LECTURE_RESERVATIONS: OfficialProgram[] = LOCAL_PROGRAMS.filter(p => p.kind === '讲座预约')

/** @deprecated 使用 getLectureReviewsAsync() */
export const LECTURE_REVIEWS: OfficialProgram[] = LOCAL_PROGRAMS.filter(p => p.kind === '讲座回顾')

/** @deprecated 使用 getActivityReservationsAsync() */
export const ACTIVITY_RESERVATIONS: OfficialProgram[] = LOCAL_PROGRAMS.filter(
  p => p.kind === '活动预约' && p.reservable && !p.ended
)

/** @deprecated 使用 getAllProgramsAsync() */
export const ALL_OFFICIAL_PROGRAMS: OfficialProgram[] = LOCAL_PROGRAMS

/** @deprecated 使用 getAllProgramsAsync() */
export function getAllPrograms(): OfficialProgram[] {
  return getLocalPrograms()
}

/** @deprecated 使用 findOfficialProgramAsync() */
export function findOfficialProgram(id: string): OfficialProgram | undefined {
  return getLocalPrograms().find(item => item.id === id)
}
