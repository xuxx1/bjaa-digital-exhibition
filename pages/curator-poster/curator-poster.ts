import { getImageSaveErrorText, isAlbumPermissionError, saveImageToAlbum } from '../../utils/image-save'

/**
 * 策展海报页 — 自由排版画布
 * movable-view 实现作品图拖拽+缩放，Canvas 2D 生成最终海报
 */

const FONT_MAP: Record<string, string> = {
  songti: '"Songti SC", serif',
  kaiti: 'KaiTi, "Kaiti SC", serif',
  fangsong: 'FangSong, "STFangsong", serif',
  heiti: '"PingFang SC", "Microsoft YaHei", sans-serif'
}

const STICKER_MAP: Record<string, string> = {
  seal: '▣', bamboo: '⌇', moon: '☾', mountain: '⛰',
  crane: '🦢', plum: '✿', cloud: '☁', wave: '≈'
}

const SIGN_MAP: Record<string, string> = { seal: '▣', line: '—', brush: '✎' }

/** 预览直接使用代码包路径，避免 wxfile 临时路径在页面跳转后失效。 */
function normalizePackageImage(src: string): string {
  if (!src) return ''
  if (src.startsWith('/assets/')) return `../..${src}`
  return src
}

Page({
  data: {
    // 画布
    canvasWidth: 345,
    canvasHeight: 1800,
    isDark: false,
    // 内容
    theme: '',
    prologue: '',
    artworks: [] as Array<{ id: string; title: string; artist: string; image: string; x: number; y: number; w: number; h: number; scale: number }>,
    stickers: [] as string[],
    bgColor: '#F2EFE8',
    fontStyle: 'songti',
    curatorName: '',
    signStyle: 'seal',
    signPrefix: '▣',
    activeIndex: -1,
    // 选项
    fontOptions: [
      { value: 'songti', label: '宋体', family: '"Songti SC", serif' },
      { value: 'kaiti', label: '楷体', family: 'KaiTi, "Kaiti SC", serif' },
      { value: 'fangsong', label: '仿宋', family: 'FangSong, "STFangsong", serif' },
      { value: 'heiti', label: '黑体', family: '"PingFang SC", "Microsoft YaHei", sans-serif' }
    ],
    fontFamilyMap: {} as Record<string, string>,
    stickerOptions: [
      { value: 'seal', label: '印章', icon: '▣', selected: false },
      { value: 'bamboo', label: '竹', icon: '⌇', selected: false },
      { value: 'moon', label: '月', icon: '☾', selected: false },
      { value: 'mountain', label: '山', icon: '⛰', selected: false },
      { value: 'crane', label: '鹤', icon: '🦢', selected: false },
      { value: 'plum', label: '梅', icon: '✿', selected: false },
      { value: 'cloud', label: '云', icon: '☁', selected: false },
      { value: 'wave', label: '浪', icon: '≈', selected: false }
    ],
    stickerIcons: {} as Record<string, string>,
    bgColorOptions: [
      { value: '#F2EFE8', label: '米色' },
      { value: '#FFFDF8', label: '纸白' },
      { value: '#F5EDE0', label: '古纸' },
      { value: '#E8E4D9', label: '绢色' },
      { value: '#1D201D', label: '墨黑' }
    ],
    signStyleOptions: [
      { value: 'seal', label: '印章式', sample: '▣ 名 策' },
      { value: 'line', label: '横线式', sample: '— 名 策' },
      { value: 'brush', label: '手写式', sample: '✎ 名 策' }
    ],
    // 面板
    showFontPanel: false,
    showStickerPanel: false,
    showBgPanel: false,
    showSignPanel: false,
    saving: false
  },

  onLoad() {
    const data = wx.getStorageSync('curator_poster_data')
    if (!data || !data.artworks || data.artworks.length === 0) {
      wx.showToast({ title: '缺少策展数据', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    // 构建映射
    const fontFamilyMap: Record<string, string> = {}
    const stickerIcons: Record<string, string> = {}
    this.data.fontOptions.forEach(f => { fontFamilyMap[f.value] = f.family })
    this.data.stickerOptions.forEach(s => { stickerIcons[s.value] = s.icon })
    const selectedStickers = data.stickers || []
    const stickerOptions = this.data.stickerOptions.map(s => ({
      ...s,
      selected: selectedStickers.includes(s.value)
    }))

    // movable-view 的 x/y 单位是 px，因此画布、卡片和坐标全部统一使用 px。
    const systemInfo = wx.getSystemInfoSync()
    const windowWidth = systemInfo.windowWidth || 375
    const canvasWidth = Math.max(280, windowWidth - 30)
    const gap = 12
    const baseW = (canvasWidth - gap * 3) / 2
    const baseH = baseW * 0.75
    const contentTop = 170
    const rowHeight = baseH + 42

    const rawArtworks = data.artworks.map((a: any, i: number) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      return {
        id: a.id, title: a.title, artist: a.artist,
        image: normalizePackageImage(a.image),
        x: gap + col * (baseW + gap),
        y: contentTop + row * rowHeight,
        w: baseW, h: baseH, scale: 1
      }
    })

    const isDark = data.bgColor === '#1D201D'
    const canvasHeight = Math.max(700, contentTop + Math.ceil(rawArtworks.length / 2) * rowHeight + 90)

    this.setData({
      theme: data.theme || '',
      prologue: data.prologue || '',
      artworks: rawArtworks,
      stickers: selectedStickers,
      stickerOptions,
      bgColor: data.bgColor || '#F2EFE8',
      fontStyle: data.fontStyle || 'songti',
      curatorName: data.curatorName || '',
      signStyle: data.signStyle || 'seal',
      signPrefix: SIGN_MAP[data.signStyle] || '▣',
      isDark,
      canvasWidth,
      canvasHeight,
      fontFamilyMap,
      stickerIcons
    })
  },

  // ===== 作品拖拽/缩放 =====
  onArtworkMove(e: WechatMiniprogram.TouchEvent) {
    const idx = e.currentTarget.dataset.index as number
    const source = e.detail.source
    if (source === 'touch') {
      this.setData({
        [`artworks[${idx}].x`]: e.detail.x,
        [`artworks[${idx}].y`]: e.detail.y
      })
    }
  },

  onArtworkScale(e: WechatMiniprogram.TouchEvent) {
    const idx = e.currentTarget.dataset.index as number
    this.setData({
      [`artworks[${idx}].scale`]: e.detail.scale,
      activeIndex: idx
    })
  },

  onArtworkTap(e: WechatMiniprogram.TouchEvent) {
    this.setData({ activeIndex: e.currentTarget.dataset.index as number })
  },

  // ===== 面板 =====
  closePanel() {
    this.setData({ showFontPanel: false, showStickerPanel: false, showBgPanel: false, showSignPanel: false })
  },

  openFontPanel() {
    this.setData({ showFontPanel: true, showStickerPanel: false, showBgPanel: false, showSignPanel: false })
  },

  openStickerPanel() {
    this.setData({ showFontPanel: false, showStickerPanel: true, showBgPanel: false, showSignPanel: false })
  },

  openBgPanel() {
    this.setData({ showFontPanel: false, showStickerPanel: false, showBgPanel: true, showSignPanel: false })
  },

  openSignPanel() {
    this.setData({ showFontPanel: false, showStickerPanel: false, showBgPanel: false, showSignPanel: true })
  },

  pickFont(e: WechatMiniprogram.BaseEvent) {
    const value = String(e.currentTarget.dataset.value)
    this.setData({ fontStyle: value })
  },

  hasSticker(value: string): boolean {
    return this.data.stickers.includes(value)
  },

  toggleSticker(e: WechatMiniprogram.BaseEvent) {
    const value = String(e.currentTarget.dataset.value)
    const stickers = [...this.data.stickers]
    const idx = stickers.indexOf(value)
    if (idx >= 0) { stickers.splice(idx, 1) }
    else {
      if (stickers.length >= 3) { wx.showToast({ title: '最多3个贴纸', icon: 'none' }); return }
      stickers.push(value)
    }
    this.setData({
      stickers,
      stickerOptions: this.data.stickerOptions.map(item => ({
        ...item,
        selected: stickers.includes(item.value)
      }))
    })
  },

  pickBgColor(e: WechatMiniprogram.BaseEvent) {
    const value = String(e.currentTarget.dataset.value)
    this.setData({ bgColor: value, isDark: value === '#1D201D' })
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ curatorName: e.detail.value })
  },

  pickSignStyle(e: WechatMiniprogram.BaseEvent) {
    const value = String(e.currentTarget.dataset.value)
    this.setData({ signStyle: value, signPrefix: SIGN_MAP[value] || '▣' })
  },

  // ===== 保存海报 =====
  async savePoster() {
    if (this.data.saving) return
    this.setData({ saving: true })

    const W = 690
    const DPR = 2
    const data = this.data
    const layoutScale = W / data.canvasWidth
    const exportHeight = Math.ceil(data.canvasHeight * layoutScale)

    // 预先将图片转为本地临时路径（Canvas 2D 在真机上不支持代码包路径）
    const imageMap: Record<string, string> = {}
    for (let i = 0; i < data.artworks.length; i++) {
      const art = data.artworks[i]
      if (imageMap[art.image]) continue
      try {
        const info = await new Promise<WechatMiniprogram.GetImageInfoSuccessCallbackResult>((resolve, reject) => {
          wx.getImageInfo({
            src: art.image,
            success: resolve,
            fail: reject
          })
        })
        imageMap[art.image] = info.path
      } catch (_e) {
        imageMap[art.image] = art.image
      }
    }

    wx.createSelectorQuery().select('#posterCanvas').fields({ node: true }).exec((res) => {
      if (!res[0] || !res[0].node) { this.setData({ saving: false }); return }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')

      canvas.width = W * DPR
      canvas.height = exportHeight * DPR
      ctx.scale(DPR, DPR)

      const isDark = data.isDark
      const textColor = isDark ? '#F8F3E9' : '#1D201D'
      const subColor = isDark ? 'rgba(248,243,233,.6)' : '#6C6B64'

      // 背景
      ctx.fillStyle = data.bgColor
      ctx.fillRect(0, 0, W, exportHeight)

      let y = 36

      // 顶部标签
      ctx.font = '12px sans-serif'
      ctx.fillStyle = isDark ? 'rgba(248,243,233,.4)' : '#9A978F'
      ctx.textAlign = 'left'
      ctx.fillText('CURATE YOUR EXHIBITION', 32, y + 12)
      y += 30

      // 贴纸
      if (data.stickers.length > 0) {
        const stickerStr = data.stickers.map(s => STICKER_MAP[s] || s).join('  ')
        ctx.font = '28px sans-serif'
        ctx.fillStyle = isDark ? 'rgba(248,243,233,.35)' : 'rgba(154,61,47,.3)'
        ctx.textAlign = 'right'
        ctx.fillText(stickerStr, W - 32, 48)
        ctx.textAlign = 'left'
      }

      // 主题
      const titleFont = FONT_MAP[data.fontStyle] || FONT_MAP.songti
      ctx.font = 'bold 36px ' + titleFont
      ctx.fillStyle = textColor
      ctx.fillText(data.theme || '未命名展览', 32, y + 36)
      y += 50

      // 分割线
      ctx.strokeStyle = isDark ? 'rgba(248,243,233,.15)' : 'rgba(29,32,29,.1)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(W - 32, y); ctx.stroke()
      y += 16

      // 展言
      if (data.prologue) {
        ctx.font = '14px "Songti SC", serif'
        ctx.fillStyle = subColor
        const lines = this._wrapText(ctx, data.prologue, W - 64)
        lines.forEach((line: string, i: number) => { ctx.fillText(line, 32, y + 16 + i * 22) })
        y += lines.length * 22 + 16
      }

      // 作品图 — 逐个加载并绘制
      const loadAndDraw = async () => {
        for (let i = 0; i < data.artworks.length; i++) {
          const art = data.artworks[i]
          const scale = art.scale || 1
          const drawW = art.w * scale * layoutScale
          const drawH = art.h * scale * layoutScale
          const drawX = art.x * layoutScale
          const drawY = art.y * layoutScale
          try {
            const img = canvas.createImage()
            img.src = imageMap[art.image] || art.image
            await new Promise<void>((resolve) => {
              img.onload = () => { ctx.drawImage(img, drawX, drawY, drawW, drawH); resolve() }
              img.onerror = () => resolve()
            })
            // 作品标签
            ctx.font = '12px "Songti SC", serif'
            ctx.fillStyle = isDark ? 'rgba(248,243,233,.6)' : '#85827A'
            ctx.fillText(art.title + ' — ' + art.artist, drawX, drawY + drawH + 16)
          } catch (_e) { /* skip */ }
        }

        // 署名
        const signY = exportHeight - 60
        ctx.strokeStyle = isDark ? 'rgba(248,243,233,.12)' : 'rgba(29,32,29,.08)'
        ctx.beginPath(); ctx.moveTo(32, signY); ctx.lineTo(W - 32, signY); ctx.stroke()
        ctx.font = '14px "Songti SC", serif'
        ctx.fillStyle = isDark ? 'rgba(248,243,233,.5)' : '#85827A'
        ctx.fillText((SIGN_MAP[data.signStyle] || '▣') + ' ' + (data.curatorName || '匿名') + ' 策', 32, signY + 24)
        ctx.font = '10px sans-serif'
        ctx.fillStyle = isDark ? 'rgba(248,243,233,.25)' : '#B5B1A8'
        ctx.textAlign = 'right'
        ctx.fillText('北京画院 · 画展一隅', W - 32, signY + 24)

        // 导出保存
        wx.canvasToTempFilePath({
          canvas,
          quality: 1,
          fileType: 'png',
          success: async (temp) => {
            try {
              await saveImageToAlbum(temp.tempFilePath)
              wx.showToast({ title: '已保存到相册', icon: 'success' })
            } catch (error) {
              if (isAlbumPermissionError(error)) {
                wx.showModal({
                  title: '需要相册权限',
                  content: '请允许保存图片到相册，然后重新点击保存。',
                  confirmText: '去设置',
                  success: (result) => { if (result.confirm) wx.openSetting({}) }
                })
              } else {
                wx.showModal({ title: '保存失败', content: getImageSaveErrorText(error), showCancel: false })
              }
            } finally {
              this.setData({ saving: false })
            }
          },
          fail: () => {
            wx.showToast({ title: '导出失败', icon: 'none' })
            this.setData({ saving: false })
          }
        })
      }

      loadAndDraw()
    })
  },

  _wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const lines: string[] = []
    let line = ''
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '\n') { lines.push(line); line = ''; continue }
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = ch
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  },

  onShareAppMessage() {
    return {
      title: `${this.data.theme || '画展一隅'} — ${this.data.curatorName || ''}策`,
      path: '/pages/collections/collections'
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
