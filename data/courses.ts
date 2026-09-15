import { fetchCourses, type CourseDTO, resolveCachedImagePath } from './api'

// ============ 类型定义 ============

export interface Course {
  id: string
  title: string
  type: '短视频' | '图文专栏'
  category: string
  cover: string
  duration: string
  summary: string
  content: string[]
  video_url: string
}

// ============ 异步数据获取 ============

let _courseCache: Course[] | null = null

export async function getCoursesAsync(): Promise<Course[]> {
  if (_courseCache) return _courseCache
  try {
    const list = await fetchCourses()
    _courseCache = list.map(mapCourse)
  } catch (_e) {
    _courseCache = getLocalCourses()
  }
  _courseCache.forEach(c => {
    if (c.cover) c.cover = resolveCachedImagePath(c.cover)
  })
  return _courseCache
}

function mapCourse(dto: CourseDTO): Course {
  const content = Array.isArray(dto.content) ? dto.content : (typeof dto.content === 'string' ? [dto.content] : [])
  return {
    id: dto.id,
    title: dto.title,
    type: (dto.type === '短视频' ? '短视频' : '图文专栏'),
    category: dto.category || '国画基础知识',
    cover: dto.cover || '',
    duration: dto.duration || '',
    summary: dto.summary || '',
    content,
    video_url: dto.video_url || ''
  }
}

// ============ 本地 fallback（空栏目，后台可随时上新） ============

let _localCourses: Course[] | null = null

function getLocalCourses(): Course[] {
  if (!_localCourses) {
    _localCourses = [
      {
        id: 'course-welcome',
        title: '栏目建设中，敬请期待',
        type: '图文专栏',
        category: '国画基础知识',
        cover: '',
        duration: '',
        summary: '线上微课与艺术小讲堂即将上线，敬请关注。',
        content: ['本栏目正在筹备中，我们将陆续上线国画基础知识与齐白石艺术科普内容。'],
        video_url: ''
      }
    ]
  }
  return _localCourses
}

// ============ 同步兼容导出 ============

/** @deprecated 使用 getCoursesAsync() */
export function getCourses(): Course[] {
  return getLocalCourses()
}