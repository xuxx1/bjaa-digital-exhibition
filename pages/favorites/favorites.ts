import { getArtworksAsync, Artwork } from '../../data/artworks'
import { getExhibitions, Exhibition } from '../../data/exhibitions'
import { getAllProgramsAsync, OfficialProgram } from '../../data/official-programs'
import {
  getFavoriteIds,
  getFavoriteExhibitionIds,
  getFavoriteProgramIds,
  toggleFavorite,
  toggleFavoriteExhibition,
  toggleFavoriteProgram,
  onFavoriteChange
} from '../../data/favorites'

Page({
  data: {
    activeType: 'artwork' as 'artwork' | 'exhibition' | 'program',
    favorites: [] as Artwork[],
    favoriteExhibitions: [] as Exhibition[],
    favoritePrograms: [] as OfficialProgram[]
  },

  _unlisten: null as (() => void) | null,

  async onLoad() {
    await this.loadFavorites()
    this._unlisten = onFavoriteChange(() => {
      this.loadFavorites()
    })
  },

  onUnload() {
    if (this._unlisten) { this._unlisten(); this._unlisten = null }
  },

  async loadFavorites() {
    const [allArtworks, allExhibitions, allPrograms] = await Promise.all([
      getArtworksAsync(),
      getExhibitions(),
      getAllProgramsAsync()
    ])
    const artworkIds = getFavoriteIds()
    const exhibitionIds = getFavoriteExhibitionIds()
    const programIds = getFavoriteProgramIds()
    this.setData({
      favorites: artworkIds
        .map(id => allArtworks.find(item => item.id === id))
        .filter((item): item is Artwork => Boolean(item))
        .map(item => ({ ...item, liked: true })),
      favoriteExhibitions: exhibitionIds
        .map(id => allExhibitions.find(item => item.id === id))
        .filter((item): item is Exhibition => Boolean(item))
        .map(item => ({ ...item, liked: true })),
      favoritePrograms: programIds
        .map(id => allPrograms.find(item => item.id === id))
        .filter((item): item is OfficialProgram => Boolean(item))
        .map(item => ({ ...item, liked: true }))
    })
  },

  chooseType(e: WechatMiniprogram.BaseEvent) {
    this.setData({ activeType: e.currentTarget.dataset.type })
  },

  goBack() {
    wx.navigateBack()
  },

  openArtwork(e: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/artwork-detail/artwork-detail?id=${e.currentTarget.dataset.id}` })
  },

  removeFavorite(e: WechatMiniprogram.BaseEvent) {
    toggleFavorite(String(e.currentTarget.dataset.id))
    this.loadFavorites()
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  },

  previewExhibition(e: WechatMiniprogram.BaseEvent) {
    const exhibition = this.data.favoriteExhibitions.find(item => item.id === e.currentTarget.dataset.id)
    if (!exhibition) return
    wx.previewImage({
      current: exhibition.image,
      urls: this.data.favoriteExhibitions.map(item => item.image)
    })
  },

  removeExhibitionFavorite(e: WechatMiniprogram.BaseEvent) {
    toggleFavoriteExhibition(String(e.currentTarget.dataset.id))
    this.loadFavorites()
    wx.showToast({ title: '已取消展览收藏', icon: 'none' })
  },

  previewProgramImage(e: WechatMiniprogram.BaseEvent) {
    const program = this.data.favoritePrograms.find(item => item.id === e.currentTarget.dataset.id)
    if (!program) return
    wx.previewImage({
      current: program.image,
      urls: this.data.favoritePrograms.map(item => item.image)
    })
  },

  removeProgramFavorite(e: WechatMiniprogram.BaseEvent) {
    toggleFavoriteProgram(String(e.currentTarget.dataset.id))
    this.loadFavorites()
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  },

  discoverArtworks() {
    wx.switchTab({ url: '/pages/collections/collections' })
  },

  discoverExhibitions() {
    wx.switchTab({ url: '/pages/exhibitions/exhibitions' })
  },

  discoverPrograms() {
    wx.switchTab({ url: '/pages/exhibitions/exhibitions' })
  }
})
