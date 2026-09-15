import { createSubmission, uploadSubmissionImageAsync } from '../../data/submissions'

Page({
  data: {
    title: '',
    author: '',
    intro: '',
    contact: '',
    image: '',
    imagePreview: '',
    uploading: false,
    submitting: false
  },

  goBack() {
    wx.navigateBack()
  },

  onTitleInput(e: WechatMiniprogram.Input) { this.setData({ title: e.detail.value }) },
  onAuthorInput(e: WechatMiniprogram.Input) { this.setData({ author: e.detail.value }) },
  onIntroInput(e: WechatMiniprogram.Input) { this.setData({ intro: e.detail.value }) },
  onContactInput(e: WechatMiniprogram.Input) { this.setData({ contact: e.detail.value }) },

  chooseImage() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const file = res.tempFiles[0]
        that.setData({ imagePreview: file.tempFilePath })
      }
    })
  },

  removeImage() {
    this.setData({ imagePreview: '', image: '' })
  },

  async submit() {
    const d = this.data
    if (!d.title.trim()) {
      wx.showToast({ title: '请填写作品名称', icon: 'none' })
      return
    }
    if (!d.author.trim()) {
      wx.showToast({ title: '请填写作者', icon: 'none' })
      return
    }
    if (!d.imagePreview) {
      wx.showToast({ title: '请选择作品图像', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    try {
      // 上传图片
      let imageUrl = ''
      if (d.imagePreview) {
        imageUrl = await uploadSubmissionImageAsync(d.imagePreview)
      }
      await createSubmission({
        title: d.title.trim(),
        author: d.author.trim(),
        intro: d.intro.trim(),
        image: imageUrl,
        contact: d.contact.trim()
      })
      wx.hideLoading()
      wx.showToast({ title: '投稿成功，待审核', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '提交失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})