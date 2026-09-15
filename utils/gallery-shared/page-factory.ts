import { GalleryGroup, VirtualArtwork, VirtualScene } from './types'

const normalizeHeading = (heading: number) => {
  let value = heading
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}

// 根据当前视角计算热点的屏幕位置百分比
function computeHotspotScreenPos(
  ath: number, atv: number,
  currentHeading: number, currentPitch: number,
  fov: number, aspect: number
): { left: number; top: number; visible: boolean } {
  const DEG = Math.PI / 180
  const dH = normalizeHeading(ath - currentHeading)
  const dV = atv - currentPitch

  const hFov = fov * aspect
  const halfHFov = hFov / 2
  const halfVFov = fov / 2

  const margin = 20
  if (Math.abs(dH) > halfHFov + margin || Math.abs(dV) > halfVFov + margin) {
    return { left: 0, top: 0, visible: false }
  }

  const left = 50 + (dH / halfHFov) * 50
  const top = 50 - (dV / halfVFov) * 50

  return { left, top, visible: true }
}

// 批量计算热点/锚点的初始屏幕位置
function computeInitialPositions(
  items: { ath: number; atv: number }[],
  heading: number, pitch: number,
  fov: number, aspect: number
): { screenLeft: number; screenTop: number; screenVisible: boolean }[] {
  return items.map(item => {
    const pos = computeHotspotScreenPos(item.ath, item.atv, heading, pitch, fov, aspect)
    return { screenLeft: pos.left, screenTop: pos.top, screenVisible: pos.visible }
  })
}

const DEFAULT_FOV = 75
const DEFAULT_CANVAS_HEIGHT = 330

function getScreenAspect(): number {
  try {
    const winInfo = wx.getWindowInfo()
    return winInfo.windowWidth / DEFAULT_CANVAS_HEIGHT
  } catch (_) {
    return 1
  }
}

export function createGalleryPageOptions(group: GalleryGroup) {
  const initialScene = group.scenes[0] as VirtualScene
  const initialHeading = normalizeHeading(initialScene.initialHlookat)
  const initialPitch = -initialScene.initialVlookat * (180 / Math.PI)
  const initialAspect = getScreenAspect()

  const initialArtworkPos = computeInitialPositions(initialScene.artworks, initialHeading, initialPitch, DEFAULT_FOV, initialAspect)
  const initialAnchorPos = computeInitialPositions(initialScene.navigationAnchors || [], initialHeading, initialPitch, DEFAULT_FOV, initialAspect)

  return {
    data: {
      exhibition: group.exhibition,
      group,
      currentScene: initialScene,
      currentSceneIndex: 0,
      panoramaSrc: initialScene.panorama,
      viewHeading: initialHeading,
      viewPitch: initialPitch,
      panoramaArtworks: initialScene.artworks.map((item, i) => ({
        ...item,
        screenLeft: initialArtworkPos[i].screenLeft,
        screenTop: initialArtworkPos[i].screenTop,
        screenVisible: initialArtworkPos[i].screenVisible
      })),
      // 导航锚点（从当前场景的 navigationAnchors 转换）
      navAnchors: (initialScene.navigationAnchors || []).map((anchor, i) => ({
        ...anchor,
        screenLeft: initialAnchorPos[i].screenLeft,
        screenTop: initialAnchorPos[i].screenTop,
        screenVisible: initialAnchorPos[i].screenVisible
      })),
      selectedArtwork: null as VirtualArtwork | null,
      showSceneDirectory: false,
      panoramaLoading: true,
      panoramaError: false,
      sceneTransitioning: false
    },

    _viewer: null as any,

    onLoad(options: Record<string, string>) {
      const requestedIndex = options.scene
        ? group.scenes.findIndex(item => item.id === options.scene)
        : -1
      const index = requestedIndex >= 0
        ? requestedIndex
        : (options.edge === 'last' ? group.scenes.length - 1 : 0)
      const requestedHeading = options.heading === undefined ? undefined : Number(options.heading)
      this.setSceneImmediate(index, requestedHeading)
    },

    onReady() {
      // 获取 panorama-viewer 组件实例，设置预加载
      this._viewer = this.selectComponent('.panorama-viewer') || this.selectComponent('#panoramaViewer')
      this._preloadAdjacentScenes()
    },

    onPanoramaLoaded() {
      if (!this.data.panoramaLoading) return
      this.setData({ panoramaLoading: false, panoramaError: false })
      this._preloadAdjacentScenes()
    },

    onPanoramaError() {
      this.setData({ panoramaLoading: false, panoramaError: true })
    },

    onViewChange(e: WechatMiniprogram.CustomEvent) {
      const { heading, pitch } = e.detail
      const winInfo = wx.getWindowInfo()
      const aspect = winInfo.windowWidth / 330

      const updates: Record<string, any> = {}

      // 更新作品热点
      const artworks = this.data.panoramaArtworks
      for (let i = 0; i < artworks.length; i++) {
        const item = artworks[i]
        const pos = computeHotspotScreenPos(item.ath, item.atv, heading, pitch, 75, aspect)
        if (item.screenVisible !== pos.visible || item.screenLeft !== pos.left || item.screenTop !== pos.top) {
          updates[`panoramaArtworks[${i}].screenLeft`] = pos.left
          updates[`panoramaArtworks[${i}].screenTop`] = pos.top
          updates[`panoramaArtworks[${i}].screenVisible`] = pos.visible
        }
      }

      // 更新导航锚点
      const navAnchors = this.data.navAnchors
      for (let i = 0; i < navAnchors.length; i++) {
        const anchor = navAnchors[i]
        const pos = computeHotspotScreenPos(anchor.ath, anchor.atv, heading, pitch, 75, aspect)
        if (anchor.screenVisible !== pos.visible || anchor.screenLeft !== pos.left || anchor.screenTop !== pos.top) {
          updates[`navAnchors[${i}].screenLeft`] = pos.left
          updates[`navAnchors[${i}].screenTop`] = pos.top
          updates[`navAnchors[${i}].screenVisible`] = pos.visible
        }
      }

      if (Object.keys(updates).length > 0) {
        this.setData(updates)
      }
    },

    // 点击导航锚点 → 平滑过渡到目标场景
    onNavAnchorTap(event: WechatMiniprogram.BaseEvent) {
      const targetId = String(event.currentTarget.dataset.targetId)
      const anchorAth = Number(event.currentTarget.dataset.ath)
      const anchorAtv = Number(event.currentTarget.dataset.atv)

      // 查找目标场景在当前分组中的索引
      const targetIndex = group.scenes.findIndex(s => s.id === targetId)
      if (targetIndex < 0) {
        // 目标场景不在当前分组，需要跨页跳转
        const allScene = group.allScenes.find(s => s.id === targetId)
        if (allScene) {
          // 先转向锚点方向
          if (this._viewer) {
            this._viewer.animateToHeading(anchorAth, -anchorAtv)
          }
          // 短暂延迟后跳转
          setTimeout(() => {
            wx.redirectTo({ url: allScene.url })
          }, 600)
        }
        return
      }

      // 同组场景，执行平滑过渡
      this._smoothTransitionTo(targetIndex, anchorAth, anchorAtv)
    },

    // 平滑过渡到相邻场景
    _smoothTransitionTo(targetIndex: number, anchorAth: number, anchorAtv: number) {
      if (this.data.sceneTransitioning) return

      const targetScene = group.scenes[targetIndex]
      if (!targetScene || targetScene.id === this.data.currentScene.id) return

      this.setData({ sceneTransitioning: true })

      // 步骤1：先转向锚点方向（"走过去"的方向）
      const turnHeading = normalizeHeading(anchorAth)
      const turnPitch = Math.max(-85, Math.min(85, -anchorAtv))

      if (this._viewer) {
        this._viewer.animateToHeading(turnHeading, turnPitch)
      }

      // 步骤2：转向完成后，切换场景
      setTimeout(() => {
        const newHeading = normalizeHeading(targetScene.initialHlookat)
        const newPitch = -targetScene.initialVlookat * (180 / Math.PI)
        const aspect = getScreenAspect()

        const artworkPos = computeInitialPositions(targetScene.artworks, newHeading, newPitch, DEFAULT_FOV, aspect)
        const anchorPos = computeInitialPositions(targetScene.navigationAnchors || [], newHeading, newPitch, DEFAULT_FOV, aspect)

        this.setData({
          currentScene: targetScene,
          currentSceneIndex: targetIndex,
          panoramaSrc: targetScene.panorama,
          viewHeading: newHeading,
          viewPitch: newPitch,
          panoramaArtworks: targetScene.artworks.map((item, i) => ({
            ...item,
            screenLeft: artworkPos[i].screenLeft,
            screenTop: artworkPos[i].screenTop,
            screenVisible: artworkPos[i].screenVisible
          })),
          navAnchors: (targetScene.navigationAnchors || []).map((anchor, i) => ({
            ...anchor,
            screenLeft: anchorPos[i].screenLeft,
            screenTop: anchorPos[i].screenTop,
            screenVisible: anchorPos[i].screenVisible
          })),
          selectedArtwork: null,
          panoramaLoading: true,
          panoramaError: false
        })

        // 延迟解除过渡锁定
        setTimeout(() => {
          this.setData({ sceneTransitioning: false })
          this._preloadAdjacentScenes()
        }, 700)
      }, 500)
    },

    // 预加载相邻场景的全景图
    _preloadAdjacentScenes() {
      if (!this._viewer) return
      const currentIndex = this.data.currentSceneIndex
      const sources: string[] = []

      // 预加载前后 1-2 个场景
      for (let offset = -1; offset <= 2; offset++) {
        const idx = currentIndex + offset
        if (idx >= 0 && idx < group.scenes.length) {
          sources.push(group.scenes[idx].panorama)
        }
      }

      this._viewer.preloadScenes(sources)
    },

    selectScene(event: WechatMiniprogram.BaseEvent) {
      const targetIndex = Number(event.currentTarget.dataset.index)
      if (targetIndex === this.data.currentSceneIndex) return
      this._smoothTransitionTo(targetIndex, this.data.currentScene.initialHlookat, 0)
    },

    previousScene() {
      if (this.data.sceneTransitioning) return
      if (this.data.currentSceneIndex > 0) {
        this._smoothTransitionTo(this.data.currentSceneIndex - 1, this.data.currentScene.initialHlookat, 0)
        return
      }
      if (group.previousUrl) wx.redirectTo({ url: `${group.previousUrl}?edge=last` })
    },

    nextScene() {
      if (this.data.sceneTransitioning) return
      if (this.data.currentSceneIndex < group.scenes.length - 1) {
        this._smoothTransitionTo(this.data.currentSceneIndex + 1, this.data.currentScene.initialHlookat, 0)
        return
      }
      if (group.nextUrl) wx.redirectTo({ url: group.nextUrl })
    },

    openSceneDirectory() {
      this.setData({ showSceneDirectory: true })
    },

    closeSceneDirectory() {
      this.setData({ showSceneDirectory: false })
    },

    selectGlobalScene(event: WechatMiniprogram.BaseEvent) {
      const packageName = String(event.currentTarget.dataset.package)
      const sceneId = String(event.currentTarget.dataset.id)
      if (packageName === group.packageName) {
        const index = group.scenes.findIndex(item => item.id === sceneId)
        this.setData({ showSceneDirectory: false })
        if (index >= 0) this._smoothTransitionTo(index, this.data.currentScene.initialHlookat, 0)
        return
      }
      const target = group.allScenes.find(item => item.id === sceneId)
      if (target) wx.redirectTo({ url: target.url })
    },

    // 首次加载场景（无过渡动画）
    setSceneImmediate(index: number, requestedHeading?: number) {
      const currentScene = group.scenes[index]
      if (!currentScene) return
      const heading = normalizeHeading(
        typeof requestedHeading === 'number' ? requestedHeading : currentScene.initialHlookat
      )
      const pitch = -currentScene.initialVlookat * (180 / Math.PI)
      const aspect = getScreenAspect()

      const artworkPos = computeInitialPositions(currentScene.artworks, heading, pitch, DEFAULT_FOV, aspect)
      const anchorPos = computeInitialPositions(currentScene.navigationAnchors || [], heading, pitch, DEFAULT_FOV, aspect)

      this.setData({
        currentScene,
        currentSceneIndex: index,
        panoramaSrc: currentScene.panorama,
        viewHeading: heading,
        viewPitch: pitch,
        panoramaArtworks: currentScene.artworks.map((item, i) => ({
          ...item,
          screenLeft: artworkPos[i].screenLeft,
          screenTop: artworkPos[i].screenTop,
          screenVisible: artworkPos[i].screenVisible
        })),
        navAnchors: (currentScene.navigationAnchors || []).map((anchor, i) => ({
          ...anchor,
          screenLeft: anchorPos[i].screenLeft,
          screenTop: anchorPos[i].screenTop,
          screenVisible: anchorPos[i].screenVisible
        })),
        selectedArtwork: null,
        panoramaLoading: true,
        panoramaError: false
      })
    },

    // 保留旧方法名用于兼容
    setScene(index: number, requestedHeading?: number) {
      this.setSceneImmediate(index, requestedHeading)
    },

    openArtwork(event: WechatMiniprogram.BaseEvent) {
      const detail = (event as WechatMiniprogram.CustomEvent).detail as any
      const id = String((detail && detail.id) || event.currentTarget.dataset.id || '')
      const selectedArtwork = this.data.currentScene.artworks.find(item => item.id === id) || null
      this.setData({ selectedArtwork })
    },

    closeArtwork() {
      this.setData({ selectedArtwork: null })
    },

    previewArtwork() {
      if (!this.data.selectedArtwork || !this.data.selectedArtwork.images.length) return
      wx.previewImage({ current: this.data.selectedArtwork.images[0], urls: this.data.selectedArtwork.images })
    },

    goBack() {
      wx.navigateBack()
    },

    preventTap() {}
  }
}
