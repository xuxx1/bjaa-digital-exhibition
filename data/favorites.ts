/**
 * 收藏状态统一管理
 * - 内存缓存 + Storage 持久化
 * - 变更时通过 listener 回调通知所有注册页面
 * - 页面无需在 onShow 中重新读取 Storage
 */

type FavoriteType = 'artwork' | 'exhibition' | 'program'
type Listener = (type: FavoriteType, id: string, liked: boolean) => void

const ARTWORK_KEY = 'bfaa_favorite_artwork_ids'
const EXHIBITION_KEY = 'bfaa_favorite_exhibition_ids'
const PROGRAM_KEY = 'bfaa_favorite_program_ids'

// 内存缓存
let _artworkIds: string[] | null = null
let _exhibitionIds: string[] | null = null
let _programIds: string[] | null = null
const listeners: Listener[] = []

function readIds(key: string): string[] {
  try {
    const value = wx.getStorageSync<string[]>(key)
    return Array.isArray(value) ? value : []
  } catch (_e) {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  wx.setStorageSync(key, ids)
}

// ===== 公共 API =====

export function getFavoriteIds(): string[] {
  if (_artworkIds === null) {
    _artworkIds = readIds(ARTWORK_KEY)
  }
  return _artworkIds
}

export function getFavoriteExhibitionIds(): string[] {
  if (_exhibitionIds === null) {
    _exhibitionIds = readIds(EXHIBITION_KEY)
  }
  return _exhibitionIds
}

export function isFavorite(id: string): boolean {
  return getFavoriteIds().includes(id)
}

export function isFavoriteExhibition(id: string): boolean {
  return getFavoriteExhibitionIds().includes(id)
}

export function getFavoriteProgramIds(): string[] {
  if (_programIds === null) {
    _programIds = readIds(PROGRAM_KEY)
  }
  return _programIds
}

export function isFavoriteProgram(id: string): boolean {
  return getFavoriteProgramIds().includes(id)
}

export function toggleFavorite(id: string): boolean {
  const ids = getFavoriteIds()
  const liked = !ids.includes(id)
  _artworkIds = liked ? [...ids, id] : ids.filter(i => i !== id)
  writeIds(ARTWORK_KEY, _artworkIds)
  emit('artwork', id, liked)
  return liked
}

export function toggleFavoriteExhibition(id: string): boolean {
  const ids = getFavoriteExhibitionIds()
  const liked = !ids.includes(id)
  _exhibitionIds = liked ? [...ids, id] : ids.filter(i => i !== id)
  writeIds(EXHIBITION_KEY, _exhibitionIds)
  emit('exhibition', id, liked)
  return liked
}

export function toggleFavoriteProgram(id: string): boolean {
  const ids = getFavoriteProgramIds()
  const liked = !ids.includes(id)
  _programIds = liked ? [...ids, id] : ids.filter(i => i !== id)
  writeIds(PROGRAM_KEY, _programIds)
  emit('program', id, liked)
  return liked
}

// ===== 事件通知 =====

function emit(type: FavoriteType, id: string, liked: boolean) {
  for (const fn of listeners) {
    try { fn(type, id, liked) } catch (_e) { /* ignore */ }
  }
}

/** 注册收藏变更监听，返回取消注册函数 */
export function onFavoriteChange(listener: Listener): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}
