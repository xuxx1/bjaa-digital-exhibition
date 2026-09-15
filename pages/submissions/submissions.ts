import { getSubmissionsAsync, Submission } from '../../data/submissions'

Page({
  data: {
    submissions: [] as Submission[],
    loading: true
  },

  async onLoad() {
    try {
      const list = await getSubmissionsAsync()
      this.setData({ submissions: list, loading: false })
    } catch (_e) {
      this.setData({ loading: false })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  goSubmit() {
    wx.navigateTo({ url: '/pages/submission-submit/submission-submit' })
  },

  previewImage(e: WechatMiniprogram.BaseEvent) {
    const url = String(e.currentTarget.dataset.url)
    if (!url) return
    wx.previewImage({ urls: [url], current: url })
  },

  onPullDownRefresh() {
    this.setData({ loading: true })
    getSubmissionsAsync().then(list => {
      this.setData({ submissions: list, loading: false })
      wx.stopPullDownRefresh()
    })
  }
})