/**
 * 后端 API 封装
 * 所有请求通过此模块统一处理
 */

// 后端 API 地址。本地开发填 http://<局域网IP>:3000/api/public（手机真机需用电脑局域网 IP）；
// 部署正式 HTTPS 后端后改为线上地址，例如：https://api.example.com/api/public
const BASE_URL = 'http://192.168.124.10:3000/api/public'

/** 后端服务器 origin，供图片路径拼接（从 BASE_URL 自动推导） */
export const SERVER_ORIGIN = BASE_URL.replace(/\/api\/public\/?$/, '')

/**
 * 将 /assets/... 代码包绝对路径转为 ../../assets/... 相对路径。
 *
 * 小程序渲染层会将 <image src="/assets/..."> 中的 /assets/... 解析为
 * 当前页面相对路径（如 /pages/exhibitions/assets/...），导致 500 错误。
 * 而 ../../assets/... 相对于 pages/xxx/xxx 目录正好指回根目录的 assets/，
 * 渲染层和 Canvas 均可正确加载。
 *
 * 已是 ../../assets/、wxfile:// 或 http(s):// 的路径直接返回，不做转换。
 */
export function resolveImagePath(src: string): string {
  if (!src || src.startsWith('wxfile://') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('../../assets/')) {
    return src
  }
  if (src.startsWith('/assets/')) {
    return '../..' + src
  }
  return src
}

/** 全局图片路径缓存，避免重复调用 */
const _imageCache: Record<string, string> = {}

/** 解析单个图片路径（同步，带缓存） */
export function resolveCachedImagePath(src: string): string {
  if (!src || src.startsWith('wxfile://') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('../../assets/')) return src
  if (_imageCache[src]) return _imageCache[src]
  const resolved = resolveImagePath(src)
  _imageCache[src] = resolved
  return resolved
}

/** 批量解析图片路径，直接修改数组内对象的 image 字段（同步，无副作用） */
export function resolveImagePaths(items: Array<{ image: string }>): void {
  for (let i = 0; i < items.length; i++) {
    const src = items[i].image
    if (!src || src.startsWith('wxfile://') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('../../assets/')) continue
    if (_imageCache[src]) {
      items[i].image = _imageCache[src]
    } else {
      items[i].image = resolveImagePath(src)
      _imageCache[src] = items[i].image
    }
  }
}

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
}

function request<T = any>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!BASE_URL) {
      reject(new Error('API 未配置，使用小程序本地数据'))
      return
    }
    const fullUrl = `${BASE_URL}${options.url}`
    console.log('[api]', options.method || 'GET', fullUrl, options.data || '')
    wx.request({
      url: fullUrl,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json'
      },
      success(res) {
        console.log('[api] response', res.statusCode, res.data)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
        } else {
          // 透传后端 error 信息（如敏感词拦截提示）
          const data = res.data as any
          const msg = (data && (data.error || data.message)) || `请求失败（${res.statusCode}）`
          reject(new Error(msg))
        }
      },
      fail(err) {
        console.error('[api] fail', err.errMsg)
        reject(new Error(`Network Error: ${err.errMsg}`))
      }
    })
  })
}

// ============ 展览 ============

export interface ExhibitionDTO {
  id: string
  type: string
  title: string
  image: string
  time: string
  location: string
  organizer: string
  intro: string
  status_text: string
  reservable: boolean
  ended: boolean
  booking_dates: any[]
  booking_times: string[]
  booking_quota: number
  artworks: ExhibitionArtworkDTO[]
}

export interface ExhibitionArtworkDTO {
  id: string
  title: string
  artist: string
  size: string
  material: string
  year: string
  image: string
}

export function fetchExhibitions(): Promise<ExhibitionDTO[]> {
  return request<ExhibitionDTO[]>({ url: '/exhibitions' })
}

// ============ 藏品 ============

export interface ArtworkDTO {
  id: string
  title: string
  artist: string
  category: string
  size: string
  image: string
  birth: string
  identity: string
  intro: string
  artist_intro?: string
  work_intro?: string
}

export function fetchArtworks(): Promise<ArtworkDTO[]> {
  return request<ArtworkDTO[]>({ url: '/artworks' })
}

// ============ 讲座/活动 ============

export interface ProgramDTO {
  id: string
  kind: string
  title: string
  image: string
  publish_date: string
  time: string | null
  location: string | null
  speaker: string | null
  audience: string | null
  summary: string
  source_url: string
  status_text: string
  reservable: number
  ended: number
  booking_dates: any[] // API 已解析为数组
  booking_times: string[] // API 已解析为数组
  booking_quota: number
}

export function fetchPrograms(): Promise<ProgramDTO[]> {
  return request<ProgramDTO[]>({ url: '/programs' })
}

// ============ 新闻 ============

export interface NewsDTO {
  id: string
  title: string
  date: string
  type: string
  summary: string
  image: string
  content: string[] // API 已解析为数组
}

export function fetchNews(): Promise<NewsDTO[]> {
  return request<NewsDTO[]>({ url: '/news' })
}

// ============ 线上微课 / 艺术小讲堂 ============

export interface CourseDTO {
  id: string
  title: string
  type: string
  category: string
  cover: string
  duration: string
  summary: string
  content: string[] // API 已解析为数组
  video_url: string
}

export function fetchCourses(): Promise<CourseDTO[]> {
  return request<CourseDTO[]>({ url: '/courses' })
}

// ============ 公告 ============

export interface AnnouncementDTO {
  id: string
  title: string
  content: string
  urgent: boolean
  popup: boolean
}

/** 获取已发布公告列表（紧急公告置顶） */
export function fetchAnnouncements(): Promise<AnnouncementDTO[]> {
  return request<AnnouncementDTO[]>({ url: '/announcements' })
}

// ============ 线上征集活动 ============

export interface SubmissionDTO {
  id: string
  title: string
  author: string
  intro: string
  image: string
  created_at: string
}

export function fetchSubmissions(): Promise<SubmissionDTO[]> {
  return request<SubmissionDTO[]>({ url: '/submissions' })
}

/** 提交投稿（作者/作品名称/简介/联系方式） */
export function submitSubmission(data: {
  title: string
  author: string
  intro: string
  image: string
  contact: string
}): Promise<{ ok: boolean; id: string }> {
  return request({ url: '/submissions', method: 'POST', data })
}

/** 上传投稿图片（公开接口，无需认证） */
export function uploadSubmissionImage(filePath: string): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    if (!BASE_URL) { reject(new Error('API 未配置')); return }
    const uploadUrl = SERVER_ORIGIN + '/api/public/upload'
    wx.uploadFile({
      url: uploadUrl,
      filePath,
      name: 'file',
      success(res) {
        try {
          const data = JSON.parse(res.data)
          if (res.statusCode >= 200 && res.statusCode < 300 && data.url) {
            resolve(data)
          } else {
            reject(new Error(data.error || '上传失败'))
          }
        } catch (_e) {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '上传失败'))
    })
  })
}

// ============ 用户反馈 ============

export interface FeedbackDTO {
  id: string
  category: string
  content: string
  contact: string
  status: string
  reply: string
  replied_at: string
  created_at: string
}

/** 提交用户反馈（分类：建议 / 问题 / 活动想法 / 其他） */
export function submitFeedback(data: {
  category: string
  content: string
  contact: string
}): Promise<{ ok: boolean; id: string }> {
  return request({ url: '/feedback', method: 'POST', data })
}

/** 查询我的反馈（按联系方式匹配，含回复内容） */
export function fetchMyFeedback(contact: string): Promise<FeedbackDTO[]> {
  return request<FeedbackDTO[]>({ url: `/feedback/mine?contact=${encodeURIComponent(contact)}` })
}

// ============ 预约 ============

export function submitBooking(data: {
  program_id: string
  program_kind: string
  program_title: string
  contact_name: string
  contact_phone: string
  booking_date: string
  booking_time: string
  visitors: number
  visitors_info?: Array<{ name: string; phone: string }>
}): Promise<any> {
  return request({ url: '/bookings', method: 'POST', data })
}

/** 查询指定展览/活动的已确认预约人数 */
export function fetchConfirmedCount(programId: string): Promise<{ count: number }> {
  return request<{ count: number }>({ url: `/bookings/confirmed-count?program_id=${encodeURIComponent(programId)}` })
}

/** 查询指定项目在指定日期的已确认预约人数 */
export function fetchDateConfirmedCount(programId: string, date: string): Promise<{ count: number }> {
  return request<{ count: number }>({ url: `/bookings/date-confirmed-count?program_id=${encodeURIComponent(programId)}&date=${encodeURIComponent(date)}` })
}

/** 批量查询多个项目今日已确认预约人数，返回 { [program_id]: count } */
export function fetchTodayConfirmedByProgram(ids: string[]): Promise<Record<string, number>> {
  return request<Record<string, number>>({ url: `/bookings/today-confirmed-by-program?ids=${encodeURIComponent(ids.join(','))}` })
}

/** 批量查询指定项目在多个日期的已确认预约人数，返回 { [YYYY-MM-DD]: count } */
export function fetchDateConfirmedByProgram(programId: string, dates: string[]): Promise<Record<string, number>> {
  return request<Record<string, number>>({ url: `/bookings/date-confirmed-by-program?program_id=${encodeURIComponent(programId)}&dates=${encodeURIComponent(dates.join(','))}` })
}

// ============ 数字展厅 ============

export interface DigitalGalleryDTO {
  id: string
  title: string
  url: string
  cover: string
  description: string
  sort_order: number
  created_at: string
}

/** 获取已上线数字展厅列表 */
export function fetchDigitalGalleries(): Promise<DigitalGalleryDTO[]> {
  return request<DigitalGalleryDTO[]>({ url: '/digital-galleries' })
}

// ============ 每日一画 ============

export interface DailyPaintingDTO {
  id: string
  title: string
  artist: string
  image: string
  intro: string
  work_intro: string
  birth: string
  category: string
}

/** 获取每日一画列表（基于日期种子确定性选取） */
export function fetchDailyPaintings(count: number = 5): Promise<DailyPaintingDTO[]> {
  return request<DailyPaintingDTO[]>({ url: `/daily-paintings?count=${count}` })
}
