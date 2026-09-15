Page({
  data: {
    phone: '',
    code: '',
    agreed: false,
    codeText: '获取验证码',
    counting: false,
    loggedIn: false,
    memberName: '观众',
    maskedPhone: '',
    visitHistory: [
      { id: 'review-1', title: '真言可贵——周思聪的变法之路', date: '2026.06.18', venue: '北京画院美术馆', image: '../../assets/exhibitions/review-1.jpg' },
      { id: 'review-3', title: '已有丹青约——蒋采苹作品展', date: '2026.05.03', venue: '北京画院美术馆', image: '../../assets/exhibitions/review-3.jpg' }
    ]
  },

  onShow() {
    const loggedIn = Boolean(wx.getStorageSync('bfaa_logged_in'))
    const maskedPhone = wx.getStorageSync('bfaa_account_label') || this.data.maskedPhone
    this.setData({ loggedIn, maskedPhone })
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ phone: e.detail.value })
  },

  onCodeInput(e: WechatMiniprogram.Input) {
    this.setData({ code: e.detail.value })
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  getCode() {
    if (this.data.counting) return
    if (!/^1\d{10}$/.test(this.data.phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    this.setData({ counting: true, codeText: '60s' })
    let seconds = 60
    const timer = setInterval(() => {
      seconds -= 1
      if (seconds <= 0) {
        clearInterval(timer)
        this.setData({ counting: false, codeText: '重新获取' })
      } else {
        this.setData({ codeText: `${seconds}s` })
      }
    }, 1000)
  },

  login() {
    if (!/^1\d{10}$/.test(this.data.phone) || this.data.code.length < 4) {
      wx.showToast({ title: '请填写完整登录信息', icon: 'none' })
      return
    }
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意服务协议', icon: 'none' })
      return
    }
    this.setData({
      loggedIn: true,
      maskedPhone: `${this.data.phone.slice(0, 3)}****${this.data.phone.slice(-4)}`
    })
    wx.setStorageSync('bfaa_logged_in', true)
    wx.setStorageSync('bfaa_account_label', `${this.data.phone.slice(0, 3)}****${this.data.phone.slice(-4)}`)
    wx.showToast({ title: '登录成功', icon: 'success' })
    this.continuePendingBooking()
  },

  wechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意服务协议', icon: 'none' })
      return
    }
    this.setData({ loggedIn: true, maskedPhone: '微信授权账户' })
    wx.setStorageSync('bfaa_logged_in', true)
    wx.setStorageSync('bfaa_account_label', '微信授权账户')
    wx.showToast({ title: '微信登录成功', icon: 'success' })
    this.continuePendingBooking()
  },

  continuePendingBooking() {
    const pendingUrl = String(wx.getStorageSync('bfaa_pending_booking') || '')
    if (!pendingUrl) return
    wx.removeStorageSync('bfaa_pending_booking')
    setTimeout(() => wx.navigateTo({ url: pendingUrl }), 500)
  },

  openBooking() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: '请先登录后再预约', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/booking/booking' })
  },

  openFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  },

  openNews() {
    wx.navigateTo({ url: '/pages/news/news' })
  },

  openFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' })
  },

  openVisitedExhibition(e: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/exhibition-detail/exhibition-detail?id=${e.currentTarget.dataset.id}&from=history` })
  },

  logout() {
    wx.removeStorageSync('bfaa_logged_in')
    wx.removeStorageSync('bfaa_account_label')
    this.setData({ loggedIn: false, code: '', maskedPhone: '' })
  }
})
