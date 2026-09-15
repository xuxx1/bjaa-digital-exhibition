import { fetchNews, type NewsDTO, resolveImagePaths } from './api'

// ============ 类型定义 ============

export interface NewsItem {
  id: string
  title: string
  date: string
  type: string
  summary: string
  image: string
  content: string[]
}

// ============ 异步数据获取 ============

let _newsCache: NewsItem[] | null = null

export async function getNewsItemsAsync(): Promise<NewsItem[]> {
  if (_newsCache) return _newsCache
  try {
    const list = await fetchNews()
    _newsCache = list.map(mapNews)
  } catch (_e) {
    _newsCache = getLocalNews()
  }
  resolveImagePaths(_newsCache)
  return _newsCache
}

function mapNews(dto: NewsDTO): NewsItem {
  const content = Array.isArray(dto.content) ? dto.content : (typeof dto.content === 'string' ? [dto.content] : [])
  return {
    id: dto.id,
    title: dto.title,
    date: dto.date || '',
    type: dto.type || '',
    summary: dto.summary || '',
    image: dto.image || '',
    content
  }
}

export async function findNewsAsync(id: string): Promise<NewsItem | undefined> {
  const list = await getNewsItemsAsync()
  return list.find(item => item.id === id)
}

// ============ 本地 fallback ============

const LOCAL_NEWS: NewsItem[] = [
  {
    id: 'news-0',
    title: '童心作笔，草间问虫——"未来白石美育艺术季·童心童语"展览开展',
    date: '2026-07-24', type: '展览动态',
    summary: '以经典为桥梁，为青少年搭建感知美、表达美、创造美的广阔平台。',
    image: '/assets/news/news-0.jpg',
    content: [
      '2026年7月23日，"未来白石美育艺术季·童心童语"展览如约而至。本次展览由北京画院与中国宋庆龄青少年科技文化交流中心联合主办，北京市学生金帆书画院秘书处协办。',
      '此次展览与北京画院年度特展"问虫——齐白石的草间对话"同期举办。当成年人的目光向下俯身、贴近地面、凝视微小，孩子们的目光则向上仰望、平视、触摸、想象，两种目光在展厅中形成跨越时空的对话。',
      '展览以多条线索呈现孩子们眼中的草间世界，通过绘画、综合材料、装置与多元媒介，重新发现那些容易被忽略的微小生命与自然奇迹。'
    ]
  },
  {
    id: 'news-1',
    title: '喜讯｜我馆策展项目入选文化和旅游部2026年全国美术馆青年策展项目扶持计划',
    date: '2026-07-15', type: '画院新闻',
    summary: '北京画院美术馆策展项目成功入选全国美术馆青年策展项目扶持计划。',
    image: '/assets/news/news-1.jpg',
    content: [
      '近日，文化和旅游部公布2026年全国美术馆青年策展项目扶持计划入选名单，北京画院美术馆策展项目成功入选。',
      '该计划旨在鼓励青年策展人立足中华优秀传统文化与当代艺术实践，持续提升美术馆的策展研究能力和公共文化服务水平。',
      '北京画院将继续推动学术研究、馆藏活化与公共教育之间的深入连接，为观众带来更具文化厚度与当代视野的展览。'
    ]
  },
  {
    id: 'news-2',
    title: '北京画院2026年度定向招聘退役大学生士兵拟录用人员公示',
    date: '2026-07-15', type: '公示公告',
    summary: '北京画院发布2026年度定向招聘拟录用人员公示。',
    image: '',
    content: [
      '根据2026年度北京市事业单位面向退役大学生士兵定向招聘相关工作安排，北京画院现对拟录用人员进行公示。',
      '公示期间如有异议，请通过书面、电话或来访等方式如实反映情况，并提供真实姓名、联系电话及地址。'
    ]
  },
  {
    id: 'news-3',
    title: '北京画院美术馆和齐白石旧居纪念馆恢复开放通知',
    date: '2026-07-12', type: '开放通知',
    summary: '暴雨红色预警解除，北京画院美术馆和齐白石旧居纪念馆恢复开放。',
    image: '',
    content: [
      '根据气象部门预报，全市分区暴雨红色预警已经解除，北京画院美术馆和齐白石旧居纪念馆即刻起恢复开放。',
      '请观众根据开放时间合理安排出行，参观过程中注意安全，并关注北京画院后续通知。'
    ]
  },
  {
    id: 'news-4',
    title: '临时闭馆通知',
    date: '2026-07-10', type: '开放通知',
    summary: '受汛期天气影响，北京画院美术馆和齐白石旧居纪念馆临时闭馆。',
    image: '',
    content: [
      '根据气象部门发布的汛期预警信息，为确保观众安全，北京画院美术馆和齐白石旧居纪念馆于2026年7月10日9:00起采取临时闭馆措施。',
      '恢复开放时间将根据汛情另行通知。请观众及时关注天气预报和北京画院发布的最新信息，合理安排出行。'
    ]
  }
]

function getLocalNews(): NewsItem[] {
  if (!_newsCache) {
    _newsCache = LOCAL_NEWS
  }
  return _newsCache!
}

// ============ 同步兼容导出 ============

/** @deprecated 使用 getNewsItemsAsync() */
export function getNewsItems(): NewsItem[] {
  return getLocalNews()
}

/** @deprecated 使用 findNewsAsync() */
export function findNews(id: string): NewsItem | undefined {
  return getLocalNews().find(item => item.id === id)
}

/** @deprecated 使用 getNewsItemsAsync() */
export const NEWS_ITEMS: NewsItem[] = LOCAL_NEWS
