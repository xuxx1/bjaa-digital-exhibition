import { submitFeedback, fetchMyFeedback } from './api'

// ============ 类型定义 ============

export interface Feedback {
  id: string
  category: string
  content: string
  contact: string
  status: string
  reply: string
  replied_at: string
  created_at: string
}

// ============ 提交反馈 ============

/** 提交用户反馈 */
export async function createFeedback(data: {
  category: string
  content: string
  contact: string
}): Promise<void> {
  await submitFeedback(data)
}

// ============ 查询我的反馈 ============

/** 按联系方式查询我的历史反馈（含后端回复） */
export function getMyFeedback(contact: string): Promise<Feedback[]> {
  return fetchMyFeedback(contact)
}
