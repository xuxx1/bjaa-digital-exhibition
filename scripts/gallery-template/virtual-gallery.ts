import { GALLERY_GROUP, VirtualArtwork, VirtualScene } from '../../data/gallery'

let boundaryAdjusting = false

const windowWidth = wx.getSystemInfoSync().windowWidth || 375
const panoramaWidth = windowWidth * 3
const panoramaViewportHeight = windowWidth * 0.88
const panoramaHeight = panoramaWidth / 2
const panoramaTop = (panoramaViewportHeight - panoramaHeight) / 2

const normalizeHeading = (heading: number) => {
  let value = heading
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}

const sceneViewData = (scene: VirtualScene, requestedHeading?: number) => {
  const heading = normalizeHeading(typeof requestedHeading === 'number' ? requestedHeading : scene.initialHlookat)
  const headingRatio = (heading + 180) / 360
  const panoramaScrollLeft = panoramaWidth + headingRatio * panoramaWidth - windowWidth / 2
  const panoramaArtworks = scene.artworks.map(item => ({
    ...item,
    leftPercent: (normalizeHeading(item.ath) + 180) / 360 * 100,
    topPx: panoramaTop + (item.atv + 90) / 180 * panoramaHeight
  }))
  return { viewHeading: heading, panoramaScrollLeft, panoramaArtworks }
}

const initialScene = GALLERY_GROUP.scenes[0] as VirtualScene

Page({
  data: {
    exhibition: GALLERY_GROUP.exhibition,
    group: GALLERY_GROUP,
    currentScene: initialScene,
    currentSceneIndex: 0,
    panoramaCopies: [0, 1, 2],
    windowWidth,
    panoramaWidth,
    panoramaHeight,
    panoramaTop,
    panoramaViewportHeight,
    panoramaStripWidth: panoramaWidth * 3,
    ...sceneViewData(initialScene),
    selectedArtwork: null as VirtualArtwork | null,
    showSceneDirectory: false,
    panoramaLoading: true,
    panoramaError: false
  },

  onLoad(options: Record<string, string>) {
    const requestedIndex = options.scene
      ? GALLERY_GROUP.scenes.findIndex(item => item.id === options.scene)
      : -1
    const index = requestedIndex >= 0
      ? requestedIndex
      : (options.edge === 'last' ? GALLERY_GROUP.scenes.length - 1 : 0)
    const currentScene = GALLERY_GROUP.scenes[index]
    const requestedHeading = options.heading === undefined ? undefined : Number(options.heading)
    this.setData({ currentScene, currentSceneIndex: index, ...sceneViewData(currentScene, requestedHeading) })
  },

  onPanoramaLoaded() {
    if (!this.data.panoramaLoading) return
    this.setData({ panoramaLoading: false, panoramaError: false })
    this.preloadNextGroup()
  },

  onPanoramaError() {
    this.setData({ panoramaLoading: false, panoramaError: true })
  },

  onPanoramaScroll(event: WechatMiniprogram.CustomEvent) {
    if (boundaryAdjusting) return
    const scrollLeft = Number((event.detail as any).scrollLeft)
    let corrected = scrollLeft
    if (scrollLeft < panoramaWidth * 0.5) corrected = scrollLeft + panoramaWidth
    if (scrollLeft > panoramaWidth * 1.75) corrected = scrollLeft - panoramaWidth
    if (corrected === scrollLeft) return
    boundaryAdjusting = true
    this.setData({ panoramaScrollLeft: corrected })
    setTimeout(() => { boundaryAdjusting = false }, 30)
  },

  selectScene(event: WechatMiniprogram.BaseEvent) {
    this.setScene(Number(event.currentTarget.dataset.index))
  },

  previousScene() {
    if (this.data.currentSceneIndex > 0) {
      this.setScene(this.data.currentSceneIndex - 1)
      return
    }
    if (GALLERY_GROUP.previousUrl) wx.redirectTo({ url: `${GALLERY_GROUP.previousUrl}?edge=last` })
  },

  nextScene() {
    if (this.data.currentSceneIndex < GALLERY_GROUP.scenes.length - 1) {
      this.setScene(this.data.currentSceneIndex + 1)
      return
    }
    if (GALLERY_GROUP.nextUrl) wx.redirectTo({ url: GALLERY_GROUP.nextUrl })
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
    if (packageName === GALLERY_GROUP.packageName) {
      const index = GALLERY_GROUP.scenes.findIndex(item => item.id === sceneId)
      this.setData({ showSceneDirectory: false })
      this.setScene(index)
      return
    }
    const target = GALLERY_GROUP.allScenes.find(item => item.id === sceneId)
    if (target) wx.redirectTo({ url: target.url })
  },

  preloadNextGroup() {
    if (!GALLERY_GROUP.nextPackageName) return
    const loadSubpackage = (wx as any).loadSubpackage
    if (typeof loadSubpackage !== 'function') return
    loadSubpackage.call(wx, {
      name: GALLERY_GROUP.nextPackageName,
      success() {},
      fail() {}
    })
  },

  setScene(index: number, requestedHeading?: number) {
    const currentScene = GALLERY_GROUP.scenes[index]
    if (!currentScene || currentScene.id === this.data.currentScene.id) return
    const nextData = {
      currentScene,
      currentSceneIndex: index,
      ...sceneViewData(currentScene, requestedHeading),
      selectedArtwork: null,
      panoramaLoading: true,
      panoramaError: false
    }
    this.setData(nextData)
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
})
