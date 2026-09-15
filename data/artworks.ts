import { fetchArtworks, type ArtworkDTO, resolveImagePaths } from './api'

// ============ 类型定义 ============

export interface Artwork {
  id: string
  title: string
  artist: string
  category: '齐白石' | '中国画'
  size: string
  image: string
  birth: string
  identity: string
  intro: string
  artist_intro?: string
  work_intro?: string
  liked?: boolean
}

// ============ 异步数据获取 ============

let _artworksCache: Artwork[] | null = null

export async function getArtworksAsync(): Promise<Artwork[]> {
  if (_artworksCache) return _artworksCache
  try {
    const list = await fetchArtworks()
    _artworksCache = list.map(mapArtwork)
  } catch (_e) {
    _artworksCache = getLocalArtworks()
  }
  resolveImagePaths(_artworksCache)
  return _artworksCache
}

function mapArtwork(dto: ArtworkDTO): Artwork {
  return {
    id: dto.id,
    title: dto.title,
    artist: dto.artist,
    category: dto.category as '齐白石' | '中国画',
    size: dto.size,
    image: dto.image,
    birth: dto.birth || '',
    identity: dto.identity || '',
    intro: dto.intro || '',
    artist_intro: dto.artist_intro || '',
    work_intro: dto.work_intro || '',
    liked: false
  }
}

export async function findArtworkAsync(id: string): Promise<Artwork | undefined> {
  const list = await getArtworksAsync()
  return list.find(a => a.id === id)
}

// ============ 本地 fallback ============

interface ArtistInfo {
  birth: string
  identity: string
  intro: string
}

const ARTIST_INFO: Record<string, ArtistInfo> = {
  '齐白石': { birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。他早年学习民间艺术，后转向文人写意绘画，在传统笔墨基础上融入生活观察，形成了质朴清新、生动传神的艺术风格。' },
  '徐悲鸿': { birth: '1895—1953', identity: '中国现代美术教育家、画家，中国现代美术的重要奠基者之一', intro: '徐悲鸿是中国现代美术发展的重要推动者。他主张融合中国传统绘画与西方写实技法，强调造型基础和现实主义精神。' },
  '李可染': { birth: '1907—1989', identity: '中国现代著名山水画家、美术教育家', intro: '李可染是中国现代山水画的重要代表人物。他强调深入自然写生，通过积墨技法强化山水空间和光影效果。' },
  '黄宾虹': { birth: '1865—1955', identity: '中国近现代山水画大师、美术史论家、金石学家', intro: '黄宾虹是中国近现代山水画的重要代表人物之一。他深入研究中国历代绘画传统，强调笔墨精神。' },
  '张大千': { birth: '1899—1983', identity: '中国近现代著名画家、中国画大师', intro: '张大千是20世纪中国画坛的重要艺术家之一。他广泛学习中国历代绘画传统，并深入研究敦煌壁画艺术。' },
  '周思聪': { birth: '1939—1996', identity: '中国现代著名人物画家、中国美术家协会会员', intro: '周思聪是中国现代人物画的重要代表人物之一。她继承现实主义人物画传统，同时不断探索水墨表现的新方式。' },
  '王雪涛': { birth: '1903—1982', identity: '中国近现代著名花鸟画家、美术教育家', intro: '王雪涛是20世纪中国花鸟画的重要画家。他继承传统花鸟画精髓，同时吸收西方绘画观察方法。' },
  '蒋兆和': { birth: '1904—1986', identity: '中国现代著名人物画家、美术教育家', intro: '蒋兆和是中国现代人物画的重要奠基者之一。他将西方素描造型方法与中国水墨传统相结合。' },
  '叶浅予': { birth: '1907—1995', identity: '中国现代著名画家、漫画家、美术教育家', intro: '叶浅予是中国现代人物画和漫画艺术的重要代表人物。他以敏锐的观察力和简练生动的线条表现人物形象。' }
}

const LOCAL_WORKS: Array<Pick<Artwork, 'id' | 'title' | 'artist' | 'category' | 'size' | 'image'>> = [
  { id: 'qi-40', title: '十二属图', artist: '齐白石', category: '齐白石', size: '68.5 × 36 cm', image: '/assets/artworks/qi-40.jpg' },
  { id: 'qi-50', title: '壶酒盘蟹', artist: '齐白石', category: '齐白石', size: '68.5 × 33.5 cm', image: '/assets/artworks/qi-50.jpg' },
  { id: 'qi-60', title: '借山图卷', artist: '齐白石', category: '齐白石', size: '30 × 48 cm', image: '/assets/artworks/qi-60.jpg' },
  { id: 'qi-90', title: '钟馗搔背图', artist: '齐白石', category: '齐白石', size: '89 × 47 cm', image: '/assets/artworks/qi-90.jpg' },
  { id: 'qi-110', title: '草虫册页之七', artist: '齐白石', category: '齐白石', size: '尺寸未载', image: '/assets/artworks/qi-110.jpg' },
  { id: 'qi-120', title: '草间鹌鹑', artist: '齐白石', category: '齐白石', size: '30 × 39 cm', image: '/assets/artworks/qi-120.jpg' },
  { id: 'qi-130', title: '樱桃', artist: '齐白石', category: '齐白石', size: '100 × 33.5 cm', image: '/assets/artworks/qi-130.jpg' },
  { id: 'qi-150', title: '虾', artist: '齐白石', category: '齐白石', size: '134 × 33 cm', image: '/assets/artworks/qi-150.jpg' },
  { id: 'cn-xbh', title: '马', artist: '徐悲鸿', category: '中国画', size: '149.5 × 81 cm', image: '/assets/artworks/cn-xbh.jpg' },
  { id: 'cn-lkr', title: '暮归图', artist: '李可染', category: '中国画', size: '69 × 45.5 cm', image: '/assets/artworks/cn-lkr.jpg' },
  { id: 'cn-hbh', title: '山水（宋）', artist: '黄宾虹', category: '中国画', size: '77 × 32.5 cm', image: '/assets/artworks/cn-hbh.jpg' },
  { id: 'cn-zdq', title: '山水（石溪）', artist: '张大千', category: '中国画', size: '110 × 48.5 cm', image: '/assets/artworks/cn-zdq.jpg' },
  { id: 'cn-zsc', title: '荷（三）', artist: '周思聪', category: '中国画', size: '50.5 × 55 cm', image: '/assets/artworks/cn-zsc.jpg' },
  { id: 'cn-wxt', title: '松雉', artist: '王雪涛', category: '中国画', size: '96.5 × 56 cm', image: '/assets/artworks/cn-wxt.jpg' },
  { id: 'cn-jzh', title: '向毛主席汇报', artist: '蒋兆和', category: '中国画', size: '102 × 142 cm', image: '/assets/artworks/cn-jzh.jpg' },
  { id: 'cn-yqy', title: '寂乡之舞', artist: '叶浅予', category: '中国画', size: '67 × 46.5 cm', image: '/assets/artworks/cn-yqy.jpg' }
]

function getLocalArtworks(): Artwork[] {
  if (!_artworksCache) {
    _artworksCache = LOCAL_WORKS.map(work => ({
      ...work,
      ...ARTIST_INFO[work.artist],
      liked: false
    }))
  }
  return _artworksCache!
}

// ============ 同步兼容导出 ============

/** @deprecated 使用 getArtworksAsync() 异步获取 */
export function getArtworks(): Artwork[] {
  return getLocalArtworks()
}

/** @deprecated 使用 findArtworkAsync() 异步获取 */
export function findArtwork(id: string): Artwork | undefined {
  return getLocalArtworks().find(a => a.id === id)
}

/** @deprecated 使用 getArtworksAsync() 异步获取 */
export const ARTWORKS: Artwork[] = LOCAL_WORKS.map(work => ({
  ...work,
  ...ARTIST_INFO[work.artist],
  liked: false
}))
