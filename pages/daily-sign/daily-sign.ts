import { getArtworksAsync } from '../../data/artworks'
import { getImageSaveErrorText, isAlbumPermissionError, resolveImageToLocalPath, saveImageToAlbum } from '../../utils/image-save'

function normalizePackageImage(src: string): string {
  if (!src) return ''
  // 渲染层会将 /assets/... 解析为当前页面相对路径，必须转为 ../../assets/...
  if (src.startsWith('/assets/')) return '../..' + src
  return src
}

Page({
  data: {
    paintingTitle: '',
    paintingArtist: '',
    paintingBirth: '',
    paintingIntro: '',
    paintingCategory: '',
    paintingImage: '',
    imageResolving: true,
    imageLoadError: false,
    dateDay: '',
    dateMonthYear: '',
    dateWeekday: '',
    canvasReady: false,
    canvasHeight: 1600
  },

  _paintingImage: '',
  _drawParams: null as any,
  _posterTempPath: '',
  _pageReady: false,
  _drawing: false,
  _drawRetryCount: 0,
  _saveWhenReady: false,
  _previewCandidates: [] as string[],
  _previewCandidateIndex: 0,

  async onLoad(options: any) {
    const id = decodeURIComponent(options.id || '')
    let title = decodeURIComponent(options.title || '')
    let artist = decodeURIComponent(options.artist || '')
    let image = normalizePackageImage(decodeURIComponent(options.image || ''))
    let intro = decodeURIComponent(options.intro || '')
    let birth = decodeURIComponent(options.birth || '')
    let category = decodeURIComponent(options.category || '')

    // 真机不再依赖跳转 URL 中的图片路径，优先按作品 ID 重新读取本地数据。
    if (id) {
      try {
        const artwork = (await getArtworksAsync()).find(item => item.id === id)
        if (artwork) {
          title = artwork.title || title
          artist = artwork.artist || artist
          image = normalizePackageImage(artwork.image || image)
          intro = artwork.work_intro || artwork.intro || intro
          birth = artwork.birth || birth
          category = artwork.category || category
        }
      } catch (_e) { /* 使用页面参数作为后备 */ }
    }
    const now = new Date()
    const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
    const weekdays = ['日','一','二','三','四','五','六']

    this.setData({
      paintingTitle: title,
      paintingArtist: artist,
      paintingBirth: birth,
      paintingIntro: intro,
      paintingCategory: category,
      paintingImage: '',
      imageResolving: true,
      imageLoadError: false,
      dateDay: String(now.getDate()),
      dateMonthYear: `${months[now.getMonth()]} ${now.getFullYear()}`,
      dateWeekday: `星期${weekdays[now.getDay()]}`
    })

    // 同时取得原图尺寸，用于按作品比例动态计算海报高度。
    if (image) {
      let drawableImage = image
      try {
        drawableImage = await resolveImageToLocalPath(image)
      } catch (error) {
        this._previewCandidates = [image]
        this._previewCandidateIndex = 0
        this._paintingImage = image
        this.setData({ paintingImage: image, imageResolving: false, imageLoadError: false })
        wx.showModal({ title: '图片下载失败', content: getImageSaveErrorText(error), showCancel: false })
        return
      }
      wx.getImageInfo({
        src: drawableImage,
        success: (res) => {
          this._previewCandidates = Array.from(new Set([res.path, drawableImage].filter(Boolean)))
          this._previewCandidateIndex = 0
          this._paintingImage = res.path
          this._drawParams = { imageUrl: res.path, title, artist, birth, category, intro }
          const canvasHeight = this.calculateCanvasHeight(res.width, res.height, title, !!category, intro)
          this.setData({
            paintingImage: res.path,
            imageResolving: false,
            imageLoadError: false,
            canvasHeight
          }, () => {
            this.tryDrawDailySign()
          })
        },
        fail: () => {
          this._previewCandidates = [drawableImage].filter(Boolean)
          this._previewCandidateIndex = 0
          this._paintingImage = drawableImage
          this._drawParams = { imageUrl: drawableImage, title, artist, birth, category, intro }
          this.setData({
            paintingImage: this._previewCandidates[0] || '',
            imageResolving: false,
            imageLoadError: !this._previewCandidates.length
          })
          this.tryDrawDailySign()
        }
      })
    } else {
      this._paintingImage = image
      this._drawParams = { imageUrl: image, title, artist, birth, category, intro }
      this.setData({ imageResolving: false, imageLoadError: true })
      this.tryDrawDailySign()
    }

    this.setData({ title: title || '每日一画' })
  },

  onReady() {
    this._pageReady = true
    this.tryDrawDailySign()
  },

  tryDrawDailySign() {
    if (!this._pageReady || !this._drawParams || this._drawing) return
    wx.nextTick(() => {
      if (!this._drawing) this.drawDailySign()
    })
  },

  calculateCanvasHeight(imageWidth: number, imageHeight: number, title: string, hasCategory: boolean, intro: string): number {
    const windowWidth = wx.getSystemInfoSync().windowWidth || 375
    const canvasWidthPx = windowWidth * 630 / 750
    const imageWidthPx = canvasWidthPx - 48
    const imageHeightPx = imageWidth > 0 ? imageWidthPx * imageHeight / imageWidth : 360
    const titleLines = Math.max(1, Math.ceil((title || '').length / 13))
    const introLines = intro ? Math.min(3, Math.max(1, Math.ceil(intro.length / 22))) : 0
    const contentHeightPx = 139 + imageHeightPx + titleLines * 28 + 8 + 20
      + (hasCategory ? 16 : 0) + introLines * 18 + 44
    return Math.max(700, Math.ceil(contentHeightPx * 750 / windowWidth))
  },

  onPreviewImageError() {
    const nextIndex = this._previewCandidateIndex + 1
    if (nextIndex < this._previewCandidates.length) {
      this._previewCandidateIndex = nextIndex
      this.setData({
        paintingImage: this._previewCandidates[nextIndex],
        imageLoadError: false
      })
      return
    }
    this.setData({ imageResolving: false, imageLoadError: true })
    wx.showToast({ title: '作品图片加载失败', icon: 'none' })
  },

  // 固定画布一次性绘制，避免修改 Canvas 高度后清空已绘制图片。
  drawDailySign() {
    if (!this._drawParams || this._drawing) return
    this._drawing = true
    const { imageUrl, title, artist, birth, category, intro } = this._drawParams

    const query = wx.createSelectorQuery()
    query.select('#dailySignCanvas').fields({ node: true, size: true }).exec((res: any) => {
      if (!res || !res[0] || !res[0].node || !res[0].width || !res[0].height) {
        this._drawing = false
        if (this._drawRetryCount < 3) {
          this._drawRetryCount += 1
          setTimeout(() => this.tryDrawDailySign(), 250)
        } else {
          this._saveWhenReady = false
          wx.showToast({ title: '海报画布初始化失败', icon: 'none' })
        }
        return
      }
      this._drawRetryCount = 0
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const cw = res[0].width
      const ch = res[0].height
      // 真机 DPR 可能达到 3～4；同时限制长边像素，避免手机 Canvas 超限。
      const deviceDpr = wx.getSystemInfoSync().pixelRatio || 1
      const dpr = Math.max(0.5, Math.min(deviceDpr, 2, 3800 / Math.max(ch, 1)))
      canvas.width = cw * dpr
      canvas.height = ch * dpr
      ctx.scale(dpr, dpr)

      // 固定间距（逻辑像素）
      const PAD = 24
      const GAP_SECTION = 19
      const GAP_LINE = 8

      // ---- 背景 ----
      ctx.fillStyle = '#F8F4EB'
      ctx.fillRect(0, 0, cw, ch)

      // ---- 日期区 ----
      const now = new Date()
      const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
      const weekdays = ['日','一','二','三','四','五','六']

      let y = PAD + 41

      // 日期大数字
      ctx.fillStyle = '#9A3D2F'
      ctx.font = 'bold 48px Georgia, serif'
      ctx.textAlign = 'left'
      const dayText = String(now.getDate())
      ctx.fillText(dayText, PAD, y)
      const dateCopyX = PAD + ctx.measureText(dayText).width + 10

      // 月份、年份和星期与前端一样排列在日期数字右侧
      ctx.fillStyle = '#1D201D'
      ctx.font = '14px sans-serif'
      ctx.fillText(`${months[now.getMonth()]} ${now.getFullYear()}`, dateCopyX, y - 17)

      ctx.fillStyle = '#8A877F'
      ctx.font = '12px sans-serif'
      ctx.fillText(`星期${weekdays[now.getDay()]}`, dateCopyX, y + 4)

      y += 22

      // 装饰线
      ctx.strokeStyle = '#9A3D2F'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD, y)
      ctx.lineTo(cw - PAD, y)
      ctx.stroke()
      y += GAP_SECTION

      // ---- 绘制文字区 ----
      const finish = () => {
        // 标题
        ctx.fillStyle = '#1D201D'
        ctx.font = 'bold 20px "Songti SC", serif'
        ctx.textAlign = 'left'
        const titleLines = this.wrapText(ctx, title, cw - PAD * 2)
        const titleLineH = 28
        titleLines.forEach((line: string, i: number) => {
          ctx.fillText(line, PAD, y + i * titleLineH)
        })
        y += titleLines.length * titleLineH + GAP_LINE

        // 作者
        ctx.fillStyle = '#9A3D2F'
        ctx.font = '13px sans-serif'
        const authorLine = birth ? `${artist} · ${birth}` : artist
        ctx.fillText(authorLine, PAD, y)
        y += 20

        // 分类
        if (category) {
          ctx.fillStyle = '#8A877F'
          ctx.font = '11px sans-serif'
          ctx.fillText(category, PAD, y)
          y += 16
        }

        // 简介（最多3行）
        if (intro) {
          ctx.fillStyle = '#6C6B64'
          ctx.font = '12px "Songti SC", serif'
          const introLines = this.wrapText(ctx, intro, cw - PAD * 2)
          const maxLines = 3
          const introLineH = 18
          introLines.slice(0, maxLines).forEach((line: string, i: number) => {
            ctx.fillText(line, PAD, y + i * introLineH)
          })
          if (introLines.length > maxLines) {
            const lastLine = introLines[maxLines - 1]
            ctx.fillText(lastLine.slice(0, -1) + '…', PAD, y + (maxLines - 1) * introLineH)
          }
          y += Math.min(introLines.length, maxLines) * introLineH
        }

        // ---- 底部品牌（紧跟内容）----
        y += 14
        ctx.strokeStyle = 'rgba(29,32,29,0.12)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(PAD, y)
        ctx.lineTo(cw - PAD, y)
        ctx.stroke()

        ctx.fillStyle = '#9A3D2F'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('北京画院美术馆', PAD, y + 16)

        ctx.fillStyle = '#B5B2AA'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(`每日一画 · ${now.getFullYear()}`, cw - PAD, y + 16)

        // 品牌文字底部 + 一点底边距
        y += 30

        this.createPosterPreview(canvas)
      }

      if (imageUrl) {
        const img = canvas.createImage()
        img.onload = () => {
          const imgW = cw - PAD * 2
          // 按原图宽高比完整显示，不裁剪
          const imgH = imgW * (img.height / img.width)

          // 保存图顺序与前端一致：日期区下方绘制作品，作品名称随后绘制。
          ctx.drawImage(img, PAD, y, imgW, imgH)

          y += imgH + 21
          finish()
        }
        img.onerror = () => {
          this._drawing = false
          this._saveWhenReady = false
          this.setData({ canvasReady: false })
          wx.showToast({ title: '作品图片载入失败，请重试', icon: 'none' })
        }
        img.src = imageUrl
      } else {
        finish()
      }
    })
  },

  createPosterPreview(canvas: any) {
    wx.canvasToTempFilePath({
      canvas,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        this._posterTempPath = res.tempFilePath
        this._drawing = false
        this.setData({ canvasReady: true }, () => {
          if (this._saveWhenReady) {
            this._saveWhenReady = false
            this.performSaveToAlbum()
          }
        })
      },
      fail: () => {
        this._drawing = false
        this._saveWhenReady = false
        this.setData({ canvasReady: false })
        wx.showToast({ title: '日签生成失败，请重试', icon: 'none' })
      }
    })
  },

  wrapText(ctx: any, text: string, maxWidth: number): string[] {
    if (!text) return []
    const lines: string[] = []
    let current = ''
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '\n') {
        lines.push(current)
        current = ''
        continue
      }
      const test = current + ch
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current)
        current = ch
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  },

  roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  },

  saveToAlbum() {
    if (!this.data.canvasReady || !this._posterTempPath) {
      this._saveWhenReady = true
      wx.showToast({ title: '正在生成海报', icon: 'loading', duration: 1500 })
      this.tryDrawDailySign()
      return
    }
    this.performSaveToAlbum()
  },

  async performSaveToAlbum() {
    try {
      await saveImageToAlbum(this._posterTempPath)
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      if (isAlbumPermissionError(error)) {
        wx.showModal({
          title: '需要相册权限',
          content: '请允许保存图片到相册，然后重新点击保存。',
          confirmText: '去设置',
          success: (result) => { if (result.confirm) wx.openSetting({}) }
        })
        return
      }
      wx.showModal({ title: '保存失败', content: getImageSaveErrorText(error), showCancel: false })
    }
  },

  onShareAppMessage() {
    return {
      title: `每日一画 · ${this.data.paintingTitle}`,
      path: `/pages/daily-sign/daily-sign?id=&title=${encodeURIComponent(this.data.paintingTitle)}&artist=${encodeURIComponent(this.data.paintingArtist)}&image=${encodeURIComponent(this._paintingImage)}&intro=${encodeURIComponent(this.data.paintingIntro)}&birth=${encodeURIComponent(this.data.paintingBirth)}&category=`,
      imageUrl: this._paintingImage || ''
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
