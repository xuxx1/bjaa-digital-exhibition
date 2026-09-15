import { findNewsAsync, NewsItem } from '../../data/news'

Page({
  data: {
    news: null as NewsItem | null
  },

  async onLoad(options: Record<string, string | undefined>) {
    const news = await findNewsAsync(options.id || '')
    if (!news) {
      wx.showToast({ title: '未找到该新闻', icon: 'none' })
      return
    }
    this.setData({ news })
  },

  goBack() {
    wx.navigateBack()
  },

  previewImage() {
    if (!this.data.news || !this.data.news.image) return
    wx.previewImage({ current: this.data.news.image, urls: [this.data.news.image] })
  }
})
