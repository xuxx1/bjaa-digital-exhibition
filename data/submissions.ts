import { fetchSubmissions, submitSubmission, uploadSubmissionImage, type SubmissionDTO, resolveImagePaths } from './api'

// ============ 类型定义 ============

export interface Submission {
  id: string
  title: string
  author: string
  intro: string
  image: string
  created_at: string
}

// ============ 异步数据获取 ============

let _submissionCache: Submission[] | null = null

export async function getSubmissionsAsync(): Promise<Submission[]> {
  if (_submissionCache) return _submissionCache
  try {
    const list = await fetchSubmissions()
    _submissionCache = list.map(mapSubmission)
  } catch (_e) {
    _submissionCache = getLocalSubmissions()
  }
  resolveImagePaths(_submissionCache)
  return _submissionCache
}

function mapSubmission(dto: SubmissionDTO): Submission {
  return {
    id: dto.id,
    title: dto.title,
    author: dto.author,
    intro: dto.intro || '',
    image: dto.image || '',
    created_at: dto.created_at || ''
  }
}

/** 提交投稿 */
export async function createSubmission(data: {
  title: string
  author: string
  intro: string
  image: string
  contact: string
}): Promise<void> {
  await submitSubmission(data)
  // 清缓存，下次拉取可看到最新投稿
  _submissionCache = null
}

/** 上传投稿图片，返回可用的图片路径 */
export async function uploadSubmissionImageAsync(filePath: string): Promise<string> {
  const res = await uploadSubmissionImage(filePath)
  return res.url
}

// ============ 本地 fallback（空板块，后台可随时审核上架） ============

let _localSubmissions: Submission[] | null = null

function getLocalSubmissions(): Submission[] {
  if (!_localSubmissions) {
    _localSubmissions = [
      {
        id: 'sub-welcome',
        title: '征集进行中，期待你的作品',
        author: '北京画院',
        intro: '线上大众书画投稿已开启，欢迎以画笔记录生活之美。',
        image: '',
        created_at: ''
      }
    ]
  }
  return _localSubmissions
}

// ============ 同步兼容导出 ============

/** @deprecated 使用 getSubmissionsAsync() */
export function getSubmissions(): Submission[] {
  return getLocalSubmissions()
}