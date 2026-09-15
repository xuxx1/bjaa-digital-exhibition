import { getArtworksAsync, type Artwork } from '../../data/artworks'

type SelectableArtwork = Artwork & { selected: boolean }

function normalizePackageImage(src: string): string {
  if (src.startsWith('/assets/')) return `../..${src}`
  return src
}

Page({
  data: {
    step: 1,
    allArtworks: [] as SelectableArtwork[],
    selectedArtworks: [] as Artwork[],
    theme: '',
    prologue: ''
  },

  async onLoad() {
    const list = await getArtworksAsync()
    this.setData({
      allArtworks: list.map(item => ({
        ...item,
        image: normalizePackageImage(item.image),
        selected: false
      }))
    })
  },

  togglePick(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const artwork = this.data.allArtworks.find(a => a.id === id)
    if (!artwork) return

    let selected = [...this.data.selectedArtworks]
    const idx = selected.findIndex(a => a.id === id)
    if (idx >= 0) {
      selected.splice(idx, 1)
    } else {
      if (selected.length >= 10) {
        wx.showToast({ title: '最多选择10件作品', icon: 'none' })
        return
      }
      selected.push(artwork)
    }
    const selectedIds = selected.map(item => item.id)
    const allArtworks = this.data.allArtworks.map(item => ({
      ...item,
      selected: selectedIds.includes(item.id)
    }))
    this.setData({ selectedArtworks: selected, allArtworks })
  },

  onThemeInput(e: WechatMiniprogram.Input) {
    this.setData({ theme: e.detail.value })
  },

  onPrologueInput(e: WechatMiniprogram.Input) {
    this.setData({ prologue: e.detail.value })
  },

  prevStep() {
    if (this.data.step > 1) this.setData({ step: this.data.step - 1 })
  },

  nextStep() {
    if (this.data.step === 1 && this.data.selectedArtworks.length < 5) {
      wx.showToast({ title: '请至少选择5件作品', icon: 'none' })
      return
    }
    if (this.data.step === 2) {
      this.enterPoster()
      return
    }
    if (this.data.step < 2) this.setData({ step: this.data.step + 1 })
  },

  enterPoster() {
    const data = {
      artworks: this.data.selectedArtworks.map(a => ({ id: a.id, title: a.title, artist: a.artist, image: a.image })),
      theme: this.data.theme || '未命名展览',
      prologue: this.data.prologue
    }
    wx.setStorageSync('curator_poster_data', data)
    wx.navigateTo({ url: '/pages/curator-poster/curator-poster' })
  },

  goBack() {
    wx.navigateBack()
  }
})
