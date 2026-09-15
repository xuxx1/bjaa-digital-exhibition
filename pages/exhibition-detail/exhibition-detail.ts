import { findExhibition, Exhibition } from '../../data/exhibitions'
import { isFavoriteExhibition, toggleFavoriteExhibition, onFavoriteChange } from '../../data/favorites'

Page({
  data: {
    exhibition: null as Exhibition | null,
    liked: false,
    fromHistory: false,
    diaryText: '',
    diaryPhotos: [] as string[],
    diaryEditing: false,
    addingPhoto: false
  },

  _exhibitionId: '',
  _unlisten: null as (() => void) | null,

  async onLoad(options: Record<string, string | undefined>) {
    const exhibition = await findExhibition(options.id || '')
    if (!exhibition) {
      wx.showToast({ title: '未找到该展览', icon: 'none' })
      return
    }
    this._exhibitionId = exhibition.id
    const fromHistory = options.from === 'history'
    this.setData({
      exhibition,
      liked: isFavoriteExhibition(exhibition.id),
      fromHistory
    })
    if (fromHistory) {
      this.loadDiary()
    }
    this._unlisten = onFavoriteChange((type, id, liked) => {
      if (type === 'exhibition' && id === this._exhibitionId) {
        this.setData({ liked })
      }
    })
  },

  onUnload() {
    if (this._unlisten) { this._unlisten(); this._unlisten = null }
  },

  loadDiary() {
    const key = `bfaa_diary_${this._exhibitionId}`
    const saved = wx.getStorageSync(key)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        this.setData({
          diaryText: data.text || '',
          diaryPhotos: data.photos || []
        })
      } catch (_e) {
        this.setData({ diaryText: '', diaryPhotos: [] })
      }
    }
  },

  saveDiary() {
    const key = `bfaa_diary_${this._exhibitionId}`
    const data = JSON.stringify({
      text: this.data.diaryText,
      photos: this.data.diaryPhotos
    })
    wx.setStorageSync(key, data)
  },

  onDiaryInput(e: WechatMiniprogram.TextareaInput) {
    this.setData({ diaryText: e.detail.value })
  },

  startDiaryEdit() {
    this.setData({ diaryEditing: true })
  },

  finishDiaryEdit() {
    this.setData({ diaryEditing: false })
    this.saveDiary()
    if (this.data.diaryText.trim() || this.data.diaryPhotos.length) {
      wx.showToast({ title: '日记已保存', icon: 'none' })
    }
  },

  addDiaryPhoto() {
    const remaining = 3 - this.data.diaryPhotos.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多添加3张照片', icon: 'none' })
      return
    }
    if (this.data.addingPhoto) return
    this.setData({ addingPhoto: true })
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const newPhotos = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          diaryPhotos: [...this.data.diaryPhotos, ...newPhotos].slice(0, 3)
        })
        this.saveDiary()
      },
      complete: () => {
        this.setData({ addingPhoto: false })
      }
    })
  },

  removeDiaryPhoto(e: WechatMiniprogram.BaseEvent) {
    const index = e.currentTarget.dataset.index as number
    const photos = [...this.data.diaryPhotos]
    photos.splice(index, 1)
    this.setData({ diaryPhotos: photos })
    this.saveDiary()
  },

  previewDiaryPhoto(e: WechatMiniprogram.BaseEvent) {
    const index = e.currentTarget.dataset.index as number
    wx.previewImage({
      current: this.data.diaryPhotos[index],
      urls: this.data.diaryPhotos
    })
  },

  goBack() {
    wx.navigateBack()
  },

  previewImage() {
    if (!this.data.exhibition) return
    wx.previewImage({
      current: this.data.exhibition.image,
      urls: [this.data.exhibition.image]
    })
  },

  previewArtwork(e: WechatMiniprogram.BaseEvent) {
    const artworks = this.data.exhibition ? (this.data.exhibition.artworks || []) : []
    const artwork = artworks.find(item => item.id === e.currentTarget.dataset.id)
    if (!artwork) return
    wx.previewImage({ current: artwork.image, urls: artworks.map(item => item.image) })
  },

  toggleLike() {
    if (!this.data.exhibition || this.data.exhibition.type !== '展览回顾') return
    const liked = toggleFavoriteExhibition(this.data.exhibition.id)
    this.setData({ liked })
    wx.showToast({ title: liked ? '已收藏展览' : '已取消收藏', icon: 'none' })
  }
})
