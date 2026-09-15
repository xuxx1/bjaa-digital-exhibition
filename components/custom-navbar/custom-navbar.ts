Component({
  properties: {
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    theme: { type: String, value: 'light' },
    back: { type: Boolean, value: true },
    rightType: { type: String, value: 'logo' },
    liked: { type: Boolean, value: false },
    borderBottom: { type: Boolean, value: false },
    centerTitle: { type: Boolean, value: false },
    rightText: { type: String, value: '' }
  },

  methods: {
    onBack() {
      wx.navigateBack({
        fail() { wx.switchTab({ url: '/pages/exhibitions/exhibitions' }) }
      })
    },

    onFavoriteTap() {
      this.triggerEvent('favoritetap')
    },

    onRightTap() {
      this.triggerEvent('righttap')
    }
  }
})
