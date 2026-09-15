import { getNewsItemsAsync, NewsItem } from '../../data/news'

Page({
  data: {
    featured: null as NewsItem | null,
    news: [] as NewsItem[]
  },

  async onLoad() {
    const items = await getNewsItemsAsync()
    this.setData({
      featured: items[0] || null,
      news: items.slice(1)
    })
  },

  goBack() {
    wx.navigateBack()
  },

  openNews(e: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/news-detail/news-detail?id=${e.currentTarget.dataset.id}` })
  }
})
