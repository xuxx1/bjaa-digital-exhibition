import { getArtworksAsync, Artwork } from '../../data/artworks'
import { getFavoriteIds, toggleFavorite, onFavoriteChange } from '../../data/favorites'

Page({
  data: {
    activeCategory: '齐白石' as '齐白石' | '中国画',
    categories: [
      { name: '齐白石', caption: '大师专题' },
      { name: '中国画', caption: '近现代馆藏' }
    ],
    artworks: [] as Artwork[],
    visibleArtworks: [] as Artwork[],
    searchKeyword: '',
    searchResults: [] as Artwork[]
  },

  _unlisten: null as (() => void) | null,

  async onLoad() {
    await this.loadArtworks()
    this._unlisten = onFavoriteChange((type, id, liked) => {
      if (type !== 'artwork') return
      const artworks = this.data.artworks.map(item => item.id === id ? { ...item, liked } : item)
      const searchResults = this.data.searchResults.map(item => item.id === id ? { ...item, liked } : item)
      this.setData({
        artworks,
        visibleArtworks: artworks.filter(item => item.category === this.data.activeCategory),
        searchResults
      })
    })
  },

  async loadArtworks() {
    const list = await getArtworksAsync()
    const favoriteIds = getFavoriteIds()
    const artworks = list.map(item => ({ ...item, liked: favoriteIds.includes(item.id) }))
    this.setData({
      artworks,
      visibleArtworks: artworks.filter(item => item.category === this.data.activeCategory)
    })
  },

  onUnload() {
    if (this._unlisten) { this._unlisten(); this._unlisten = null }
  },

  chooseCategory(e: WechatMiniprogram.BaseEvent) {
    const category = e.currentTarget.dataset.category as '齐白石' | '中国画'
    this.setData({
      activeCategory: category,
      visibleArtworks: this.data.artworks.filter(item => item.category === category)
    })
  },

  toggleLike(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const liked = toggleFavorite(id)
    const artworks = this.data.artworks.map(item => item.id === id ? { ...item, liked } : item)
    const searchResults = this.data.searchResults.map(item => item.id === id ? { ...item, liked } : item)
    this.setData({
      artworks,
      visibleArtworks: artworks.filter(item => item.category === this.data.activeCategory),
      searchResults
    })
  },

  openArtwork(e: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/artwork-detail/artwork-detail?id=${e.currentTarget.dataset.id}` })
  },

  openCurator() {
    wx.navigateTo({ url: '/pages/curator-edit/curator-edit' })
  },

  openCourses() {
    wx.navigateTo({ url: '/pages/courses/courses' })
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value.trim()
    this.setData({ searchKeyword: keyword })
    this.performSearch(keyword)
  },

  tapHintTag(e: WechatMiniprogram.BaseEvent) {
    const tag = String(e.currentTarget.dataset.tag)
    this.setData({ searchKeyword: tag })
    this.performSearch(tag)
  },

  clearKeyword() {
    this.setData({ searchKeyword: '', searchResults: [] })
  },

  performSearch(keyword: string) {
    if (!keyword) {
      this.setData({ searchResults: [] })
      return
    }
    const kw = keyword.toLowerCase()
    const results = this.data.artworks.filter(item =>
      item.title.toLowerCase().includes(kw) ||
      item.artist.toLowerCase().includes(kw)
    )
    this.setData({ searchResults: results })
  }
})
