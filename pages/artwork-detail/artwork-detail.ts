import { findArtworkAsync, Artwork } from '../../data/artworks'
import { isFavorite, toggleFavorite, onFavoriteChange } from '../../data/favorites'

Page({
  data: {
    artwork: null as Artwork | null,
    liked: false
  },

  _unlisten: null as (() => void) | null,

  async onLoad(options: Record<string, string | undefined>) {
    const artwork = await findArtworkAsync(options.id || '')
    if (!artwork) {
      wx.showToast({ title: '未找到该作品', icon: 'none' })
      return
    }
    this.setData({ artwork, liked: isFavorite(artwork.id) })
    this._unlisten = onFavoriteChange((type, id, liked) => {
      if (type === 'artwork' && this.data.artwork && this.data.artwork.id === id) {
        this.setData({ liked })
      }
    })
  },

  onUnload() {
    if (this._unlisten) { this._unlisten(); this._unlisten = null }
  },

  goBack() {
    wx.navigateBack()
  },

  toggleLike() {
    if (!this.data.artwork) return
    const liked = toggleFavorite(this.data.artwork.id)
    this.setData({ liked })
    wx.showToast({ title: liked ? '已加入收藏' : '已取消收藏', icon: 'none' })
  }
})
