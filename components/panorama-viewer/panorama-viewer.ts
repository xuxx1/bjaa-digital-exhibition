/**
 * panorama-viewer — Canvas 2D 全景查看器（平面模式）
 *
 * 打开即平面：从等距柱状全景图上按 heading/pitch/fov 切出一个矩形窗口，
 * 直接放大铺满画布，不做任何球面/柱面数学变形，画面平直无弯曲。
 * 水平方向按全景图左右接缝循环（可无缝绕一圈 = 360°），
 * 垂直方向在图片上下范围内平移。支持触摸拖动 + 惯性。
 */

const DEG = Math.PI / 180

Component({
  properties: {
    src: { type: String, value: '' },
    heading: { type: Number, value: 0 },
    pitch: { type: Number, value: 0 },
    fov: { type: Number, value: 75 }
  },

  data: {},

  lifetimes: {
    attached() {
      this._canvas = null
      this._ctx = null
      this._img = null
      this._imgReady = false
      this._heading = 0        // 水平视角（度），0~360
      this._pitch = 0          // 垂直视角（度），-85~85
      this._fov = 75           // 水平视场角（度）
      this._cssW = 0           // canvas 逻辑宽(px)
      this._cssH = 0
      this._canW = 0           // canvas 物理宽
      this._canH = 0
      this._touching = false
      this._lastX = 0
      this._lastY = 0
      this._velH = 0
      this._velP = 0
      this._rafId = null
      this._pending = false
      this._src = ''
    },

    ready() {
      this._initCanvas()
    },

    detached() {
      if (this._rafId && this._canvas) {
        this._canvas.cancelAnimationFrame(this._rafId)
        this._rafId = null
      }
    }
  },

  observers: {
    'src'(newSrc: string) {
      if (!newSrc) return
      this._src = newSrc
      if (this._canvas) {
        this._loadImage(newSrc)
      }
    }
  },

  methods: {
    // ============ Canvas 初始化 ============

    _initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#panoCanvas')
        .fields({ node: true, size: true })
        .exec((res: any[]) => {
          if (!res || !res[0] || !res[0].node) {
            console.error('[panorama-viewer] canvas node not found')
            return
          }
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio || 2

          const cssW = res[0].width
          const cssH = res[0].height
          canvas.width = cssW * dpr
          canvas.height = cssH * dpr

          this._canvas = canvas
          this._ctx = ctx
          this._cssW = cssW
          this._cssH = cssH
          this._canW = canvas.width
          this._canH = canvas.height

          if (this._src) {
            this._loadImage(this._src)
          }
        })
    },

    _loadImage(src: string) {
      this._imgReady = false
      const img = this._canvas.createImage()
      img.onload = () => {
        this._img = img
        this._imgReady = true
        this._render()
        this.triggerEvent('loaded')
      }
      img.onerror = () => {
        this.triggerEvent('error')
      }
      img.src = src
    },

    // ============ 触摸 ============

    onTouchStart(e: any) {
      if (!e.touches || !e.touches.length) return
      this._touching = true
      this._lastX = e.touches[0].x
      this._lastY = e.touches[0].y
      this._velH = 0
      this._velP = 0
    },

    onTouchMove(e: any) {
      if (!this._touching || !e.touches || !e.touches.length) return
      const x = e.touches[0].x
      const y = e.touches[0].y
      const dx = x - this._lastX
      const dy = y - this._lastY

      // 灵敏度：屏幕宽 → 每像素角度
      if (this._cssW > 0) {
        const hPerPx = this._fov / this._cssW
        const vPerPx = (this._fov * (this._cssH / this._cssW)) / this._cssH

        this._heading = this._normHeading(this._heading - dx * hPerPx)
        this._pitch = Math.max(-85, Math.min(85, this._pitch + dy * vPerPx))

        this._velH = -dx * hPerPx
        this._velP = dy * vPerPx

        this._lastX = x
        this._lastY = y
        this._requestRender()
      }
    },

    onTouchEnd() {
      this._touching = false
      this._startInertia()
    },

    // ============ 惯性 ============

    _startInertia() {
      if (this._rafId && this._canvas) {
        this._canvas.cancelAnimationFrame(this._rafId)
        this._rafId = null
      }
      const step = () => {
        if (this._touching) return
        this._velH *= 0.92
        this._velP *= 0.92
        if (Math.abs(this._velH) < 0.005 && Math.abs(this._velP) < 0.005) return
        this._heading = this._normHeading(this._heading + this._velH)
        this._pitch = Math.max(-85, Math.min(85, this._pitch + this._velP))
        this._render()
        this._rafId = this._canvas.requestAnimationFrame(step)
      }
      if (Math.abs(this._velH) > 0.005 || Math.abs(this._velP) > 0.005) {
        this._rafId = this._canvas.requestAnimationFrame(step)
      }
    },

    // ============ 渲染（平面窗口） ============

    _requestRender() {
      if (this._pending) return
      this._pending = true
      if (this._canvas) {
        this._canvas.requestAnimationFrame(() => {
          this._pending = false
          this._render()
        })
      }
    },

    _render() {
      if (!this._ctx || !this._imgReady || !this._img || this._canW <= 0) return
      const ctx = this._ctx
      const img = this._img
      const iw = img.width
      const ih = img.height
      const cw = this._canW
      const ch = this._canH

      ctx.clearRect(0, 0, cw, ch)

      // 源窗口尺寸（图片像素）
      const sw = Math.max(1, (this._fov / 360) * iw)  // 水平窗口宽
      const sh = sw * (ch / cw)                           // 垂直窗口高（等比）

      // 窗口中心（水平环绕）
      const cx = (((this._heading / 360) * iw) % iw + iw) % iw
      // 窗口中心（垂直，clamp 到图片范围）
      const centerY = (0.5 - this._pitch / 180) * ih
      const cy = Math.max(sh / 2, Math.min(ih - sh / 2, centerY))

      const sx0 = cx - sw / 2
      const sy0 = cy - sh / 2

      // 放大绘制到整屏（水平可环绕）
      this._drawWrapped(img, sx0, sy0, sw, sh, 0, 0, cw, ch)
    },

    /**
     * 绘制源窗口到目标，处理水平环绕（跨图左/右边界自动分割拼接）
     */
    _drawWrapped(img: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
      const iw = img.width
      if (sw <= 0) return

      const scaleX = dw / sw
      const scaleY = dh / sh

      const seg = (segSx: number, segSw: number, segDx: number) => {
        const w = segSw * scaleX
        this._ctx.drawImage(img, segSx, sy, segSw, sh, dx + segDx, dy, w, dh)
      }

      if (sx >= 0 && sx + sw <= iw) {
        // 不跨界
        seg(sx, sw, 0)
      } else {
        let remaining = sw
        let currentDx = 0
        let currentSx = sx
        // 最多拆两段（从当前 sx 向左图尾部，再从头接剩余）
        let pass = 0
        while (remaining > 0 && pass < 2) {
          pass++
          if (currentSx < 0) {
            // 从右边界补
            const chunk = Math.min(remaining, -currentSx)
            const segSx = iw + currentSx
            seg(segSx, chunk, currentDx)
            currentDx += chunk * scaleX
            remaining -= chunk
            currentSx = 0
          } else if (currentSx + remaining <= iw) {
            seg(currentSx, remaining, currentDx)
            remaining = 0
          } else {
            // 超右边界
            const chunk = iw - currentSx
            seg(currentSx, chunk, currentDx)
            currentDx += chunk * scaleX
            remaining -= chunk
            currentSx = 0
          }
        }
      }
    },

    // ============ 工具 ============

    _normHeading(h: number): number {
      let v = h
      while (v > 180) v -= 360
      while (v < -180) v += 360
      return v
    },

    // ============ 外部接口 ============

    animateToHeading(heading: number, pitch: number) {
      this._heading = heading
      this._pitch = Math.max(-85, Math.min(85, pitch))
      this._velH = 0
      this._velP = 0
      this._render()
    },

    preloadScenes(sources: string[]) {
      sources.forEach(src => {
        if (src) wx.getImageInfo({ src, fail: () => {} })
      })
    },

    getHeading(): number {
      return this._heading || 0
    },

    getPitch(): number {
      return this._pitch || 0
    }
  }
})