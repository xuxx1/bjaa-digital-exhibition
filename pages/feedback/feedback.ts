import { createFeedback, getMyFeedback, Feedback } from '../../data/feedback'

Page({
  data: {
    category: '建议',
    categories: ['建议', '问题', '活动想法', '其他'],
    content: '',
    contact: '',
    submitting: false,
    myFeedback: [] as Feedback[],
    loadingMine: false
  },

  goBack() {
    wx.navigateBack()
  },

  selectCategory(e: WechatMiniprogram.BaseEvent) {
    this.setData({ category: String(e.currentTarget.dataset.category) })
  },

  onContentInput(e: WechatMiniprogram.Input) {
    this.setData({ content: e.detail.value })
  },

  onContactInput(e: WechatMiniprogram.Input) {
    this.setData({ contact: e.detail.value })
  },

  submit() {
    const d = this.data
    if (!d.content.trim()) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    if (d.content.trim().length < 5) {
      wx.showToast({ title: '内容太短，多说一点吧', icon: 'none' })
      return
    }
    if (d.submitting) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    createFeedback({
      category: d.category,
      content: d.content.trim(),
      contact: d.contact.trim()
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '反馈已提交，感谢您！', icon: 'success' })
      this.setData({ content: '', submitting: false })
      // 提交成功后刷新我的反馈
      if (d.contact.trim()) {
        this.loadMyFeedback()
      }
    }).catch((e: any) => {
      wx.hideLoading()
      wx.showToast({ title: e.message || '提交失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    })
  },

  // 查看我的反馈
  onCheckMine() {
    const contact = this.data.contact.trim()
    if (!contact) {
      wx.showToast({ title: '请先填写联系方式', icon: 'none' })
      return
    }
    this.loadMyFeedback()
  },

  loadMyFeedback() {
    const contact = this.data.contact.trim()
    if (!contact) return
    this.setData({ loadingMine: true })
    getMyFeedback(contact).then((list) => {
      // 把中文状态映射为 ASCII 类名，供 WXSS 使用
      const statusMap: Record<string, string> = {
        '待处理': 'pending',
        '已处理': 'done',
        '已忽略': 'ignored'
      }
      const mapped = list.map(function (item) {
        return Object.assign({}, item, { statusClass: statusMap[item.status] || 'pending' })
      })
      this.setData({ myFeedback: mapped as any, loadingMine: false })
    }).catch(() => {
      this.setData({ loadingMine: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    })
  }
})
