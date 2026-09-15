/**
 * 在线全景展厅（web-view 页面）
 * 从页面参数获取外部全景 URL，加载后由 web-view 渲染。
 * 导航栏采用系统默认（返回键在左上角）。
 */
Page({
  data: {
    url: ''
  },

  onLoad(options: any) {
    const fallback = 'https://quanjing.artron.net/scene/MUhM9H7t5KtV3oMvCse93zLsZbP8uicR/20260626-zykg/tour.html'
    const url = options.url ? decodeURIComponent(options.url) : fallback
    this.setData({ url })
  },

  onMessage(e: any) {
    // web-view 内页 postMessage 回调（预留）
    console.log('[web-gallery] message', e)
  }
})