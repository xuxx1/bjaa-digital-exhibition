import { getCurrentExhibitions, getExhibitionReviews, getExhibitionPreviews, Exhibition } from '../../data/exhibitions'
import { getLectureReservationsAsync, getLectureReviewsAsync, getActivityReservationsAsync, getActivityReviewsAsync, OfficialProgram } from '../../data/official-programs'
import { getFavoriteExhibitionIds, toggleFavoriteExhibition, toggleFavoriteProgram, getFavoriteProgramIds, onFavoriteChange } from '../../data/favorites'
import { fetchTodayConfirmedByProgram, fetchDailyPaintings, fetchAnnouncements, fetchDigitalGalleries, AnnouncementDTO, DailyPaintingDTO, DigitalGalleryDTO } from '../../data/api'
import { getArtworksAsync } from '../../data/artworks'

Page({
  data: {
    currentExhibitions: [] as Exhibition[],
    currentExhibitionIndex: 0,
    reviews: [] as Exhibition[],
    pagedReviews: [] as any[],
    reviewPage: 1,
    reviewPageSize: 3,
    totalReviewPages: 1,
    selectedExhibition: null as Exhibition | null,
    selectedProgram: null as OfficialProgram | null,
    todayBookings: 0,
    exhibitionPreviews: [] as Exhibition[],
    lectureReservations: [] as OfficialProgram[],
    lectureReviews: [] as OfficialProgram[],
    activityReservations: [] as OfficialProgram[],
    activityReviews: [] as OfficialProgram[],
    hasUpcomingLecture: false,
    hasUpcomingActivity: false,
    // 搜索相关
    searchActive: false,
    searchKeyword: '',
    searchTab: 'exhibition' as 'exhibition' | 'lecture' | 'activity',
    searchResultsExhibition: [] as Exhibition[],
    searchResultsLecture: [] as OfficialProgram[],
    searchResultsActivity: [] as OfficialProgram[],
    // 每日一画
    dailyPaintings: [] as DailyPaintingDTO[],
    todayDate: '',
    // 公告
    announcements: [] as AnnouncementDTO[],
    announcementIndex: 0,
    popupAnnouncement: null as AnnouncementDTO | null,
    // 数字展厅
    digitalGalleries: [] as DigitalGalleryDTO[],
    digitalGalleryIndex: 0,
    // 快捷入口滚动目标
    scrollTarget: ''
  },

  _unlisten: null as (() => void) | null,

  async onLoad() {
    // 设置今日日期
    const now = new Date()
    const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
    this.setData({ todayDate: `${now.getFullYear()}年${months[now.getMonth()]}${now.getDate()}日` })
    await this.loadData()
    this.loadDailyPaintings()
    this.loadAnnouncements()
    this.loadDigitalGalleries()
    this.syncReviewFavorites()
    this.syncProgramFavorites()
    this._unlisten = onFavoriteChange((type, id, liked) => {
      if (type === 'exhibition') {
        const reviews = this.data.reviews.map(item => item.id === id ? { ...item, liked } : item)
        const selectedExhibition = this.data.selectedExhibition && this.data.selectedExhibition.id === id
          ? { ...this.data.selectedExhibition, liked }
          : this.data.selectedExhibition
        const start = (this.data.reviewPage - 1) * this.data.reviewPageSize
        const pagedReviews = reviews
          .slice(start, start + this.data.reviewPageSize)
          .map((item, index) => ({ ...item, displayIndex: `0${start + index + 1}` }))
        this.setData({ reviews, pagedReviews, selectedExhibition })
      } else if (type === 'program') {
        const update = (list: OfficialProgram[]) => list.map(item => item.id === id ? { ...item, liked } : item)
        const selectedProgram = this.data.selectedProgram && this.data.selectedProgram.id === id
          ? { ...this.data.selectedProgram, liked }
          : this.data.selectedProgram
        this.setData({
          lectureReservations: update(this.data.lectureReservations),
          lectureReviews: update(this.data.lectureReviews),
          activityReservations: update(this.data.activityReservations),
          activityReviews: update(this.data.activityReviews),
          selectedProgram
        })
      }
    })
  },

  async loadData() {
    try {
      const [currents, reviews, previews, lectureRes, lectureRev, activityRes, activityRev] = await Promise.all([
        getCurrentExhibitions(),
        getExhibitionReviews(),
        getExhibitionPreviews(),
        getLectureReservationsAsync(),
        getLectureReviewsAsync(),
        getActivityReservationsAsync(),
        getActivityReviewsAsync()
      ])
      const totalReviewPages = Math.ceil(reviews.length / 3)
      this.setData({
        currentExhibitions: currents,
        currentExhibitionIndex: 0,
        reviews,
        totalReviewPages,
        exhibitionPreviews: previews,
        lectureReservations: lectureRes.map(item => ({ ...item, liked: false })),
        lectureReviews: lectureRev.slice(0, 2).map(item => ({ ...item, liked: false })),
        activityReservations: activityRes.map(item => ({ ...item, liked: false })),
        activityReviews: activityRev.slice(0, 2).map(item => ({ ...item, liked: false })),
        hasUpcomingLecture: lectureRes.some(item => item.reservable),
        hasUpcomingActivity: activityRes.some(item => item.reservable)
      })
      // 批量查询所有可预约项目的今日已确认人数
      const reservableIds: string[] = []
      currents.forEach(c => { if (c.reservable) reservableIds.push(c.id) })
      previews.forEach(p => { if (p.reservable) reservableIds.push(p.id) })
      lectureRes.forEach(p => { if (p.reservable) reservableIds.push(p.id) })
      activityRes.forEach(p => { if (p.reservable) reservableIds.push(p.id) })
      if (reservableIds.length > 0) {
        try {
          const countMap = await fetchTodayConfirmedByProgram(reservableIds)
          if (currents.length > 0) {
            const cur = currents[this.data.currentExhibitionIndex] || currents[0]
            if (cur && cur.reservable) {
              this.setData({ todayBookings: countMap[cur.id] || 0 })
            }
          }
          previews.forEach((p, i) => {
            if (p.reservable && countMap[p.id] !== undefined) {
              this.setData({ [`exhibitionPreviews[${i}].todayBookings`]: countMap[p.id] || 0 })
            }
          })
          lectureRes.forEach((p, i) => {
            if (p.reservable && countMap[p.id] !== undefined) {
              this.setData({ [`lectureReservations[${i}].todayBookings`]: countMap[p.id] || 0 })
            }
          })
          activityRes.forEach((p, i) => {
            if (p.reservable && countMap[p.id] !== undefined) {
              this.setData({ [`activityReservations[${i}].todayBookings`]: countMap[p.id] || 0 })
            }
          })
        } catch (_e) {
          // 获取失败则保持0
        }
      }
    } catch (_e) {
      // fallback: 同步导出已由 data 模块处理
    }
  },

  onUnload() {
    if (this._unlisten) { this._unlisten(); this._unlisten = null }
  },

  syncReviewFavorites() {
    const favoriteIds = getFavoriteExhibitionIds()
    const reviews = this.data.reviews.map(item => ({ ...item, liked: favoriteIds.includes(item.id) }))
    const start = (this.data.reviewPage - 1) * this.data.reviewPageSize
    const pagedReviews = reviews
      .slice(start, start + this.data.reviewPageSize)
      .map((item, index) => ({ ...item, displayIndex: `0${start + index + 1}` }))
    this.setData({ reviews, pagedReviews })
  },

  syncProgramFavorites() {
    const programIds = getFavoriteProgramIds()
    const mark = (list: OfficialProgram[]) => list.map(item => ({ ...item, liked: programIds.includes(item.id) }))
    this.setData({
      lectureReservations: mark(this.data.lectureReservations),
      lectureReviews: mark(this.data.lectureReviews),
      activityReservations: mark(this.data.activityReservations),
      activityReviews: mark(this.data.activityReviews)
    })
  },

  toggleProgramFavorite(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const liked = toggleFavoriteProgram(id)
    const update = (list: OfficialProgram[]) => list.map(item => item.id === id ? { ...item, liked } : item)
    const selectedProgram = this.data.selectedProgram && this.data.selectedProgram.id === id
      ? { ...this.data.selectedProgram, liked }
      : this.data.selectedProgram
    this.setData({
      lectureReservations: update(this.data.lectureReservations),
      lectureReviews: update(this.data.lectureReviews),
      activityReservations: update(this.data.activityReservations),
      activityReviews: update(this.data.activityReviews),
      selectedProgram
    })
    wx.showToast({ title: liked ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  openCurrent() {
    const cur = this.data.currentExhibitions[this.data.currentExhibitionIndex] || this.data.currentExhibitions[0]
    if (cur) this.setData({ selectedExhibition: cur })
  },

  onCurrentExhibitionChange(e: WechatMiniprogram.SwiperChange) {
    const idx = e.detail.current
    this.setData({ currentExhibitionIndex: idx })
    // 更新当前展览的今日预约数
    const cur = this.data.currentExhibitions[idx]
    if (cur && cur.reservable) {
      // 已有 todayBookings 数据在 loadData 中设置了第一条，此处只更新显示
      // 如果需要精确可重新拉取，这里保持简单更新
    }
  },

  reserveCurrent() {
    this.goToBooking('/pages/booking/booking')
  },

  openProgram(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const programIds = getFavoriteProgramIds()
    // 先在 programs 列表中查找
    let selectedProgram: OfficialProgram | null = [
      ...this.data.lectureReservations,
      ...this.data.lectureReviews,
      ...this.data.activityReservations,
      ...this.data.activityReviews
    ].find(item => item.id === id) || null
    if (selectedProgram) {
      (selectedProgram as any).liked = programIds.includes(id)
      this.setData({ selectedProgram, selectedExhibition: null })
      return
    }
    // 再在展览预告中查找
    const preview = this.data.exhibitionPreviews.find(item => item.id === id)
    if (preview) {
      const favoriteIds = getFavoriteExhibitionIds()
      this.setData({ selectedExhibition: { ...preview, liked: favoriteIds.includes(preview.id) }, selectedProgram: null })
    }
  },

  closeProgram() {
    this.setData({ selectedProgram: null })
  },

  reserveProgram(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    // 展览预告 → 走展览预约
    const preview = this.data.exhibitionPreviews.find(item => item.id === id)
    if (preview) {
      if (!preview.reservable) {
        wx.showToast({ title: '本期预约已结束，敬请期待', icon: 'none' })
        return
      }
      this.goToBooking(`/pages/booking/booking?id=${preview.id}&source=exhibition`)
      return
    }
    // 讲座/活动 → 走 program 预约
    const program = [
      ...this.data.lectureReservations,
      ...this.data.activityReservations,
      ...this.data.activityReviews
    ].find(item => item.id === id)
    if (!program || !program.reservable) {
      wx.showToast({ title: '本期预约已结束，敬请期待', icon: 'none' })
      return
    }
    this.goToBooking(`/pages/booking/booking?id=${program.id}`)
  },

  goToBooking(url: string) {
    if (!wx.getStorageSync('bfaa_logged_in')) {
      wx.setStorageSync('bfaa_pending_booking', url)
      wx.showToast({ title: '请先登录后再预约', icon: 'none' })
      setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 500)
      return
    }
    wx.navigateTo({ url })
  },

  openVirtualGallery(e: WechatMiniprogram.BaseEvent) {
    if (this.data.selectedExhibition) this.setData({ selectedExhibition: null })
    const index = e.currentTarget.dataset.index as number
    const item = this.data.digitalGalleries[index]
    const url = item ? item.url : ''
    wx.navigateTo({ url: '/pages/web-gallery/web-gallery' + (url ? '?url=' + encodeURIComponent(url) : '') })
  },

  onDigitalGalleryChange(e: WechatMiniprogram.SwiperChange) {
    this.setData({ digitalGalleryIndex: e.detail.current })
  },

  openSubmissions() {
    if (this.data.selectedExhibition) this.setData({ selectedExhibition: null })
    wx.navigateTo({ url: '/pages/submissions/submissions' })
  },

  openReview(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const selectedExhibition = this.data.reviews.find(item => item.id === id) || null
    this.setData({ selectedExhibition })
  },

  toggleReviewFavorite(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const liked = toggleFavoriteExhibition(id)
    const reviews = this.data.reviews.map(item => item.id === id ? { ...item, liked } : item)
    const start = (this.data.reviewPage - 1) * this.data.reviewPageSize
    const pagedReviews = reviews
      .slice(start, start + this.data.reviewPageSize)
      .map((item, index) => ({ ...item, displayIndex: `0${start + index + 1}` }))
    const selectedExhibition = this.data.selectedExhibition && this.data.selectedExhibition.id === id
      ? { ...this.data.selectedExhibition, liked }
      : this.data.selectedExhibition
    this.setData({ reviews, pagedReviews, selectedExhibition })
    wx.showToast({ title: liked ? '已收藏展览' : '已取消收藏', icon: 'none' })
  },

  previousReviews() {
    if (this.data.reviewPage <= 1) return
    this.setReviewPage(this.data.reviewPage - 1)
  },

  nextReviews() {
    if (this.data.reviewPage >= this.data.totalReviewPages) return
    this.setReviewPage(this.data.reviewPage + 1)
  },

  setReviewPage(page: number) {
    const start = (page - 1) * this.data.reviewPageSize
    const pagedReviews = this.data.reviews
      .slice(start, start + this.data.reviewPageSize)
      .map((item, index) => ({ ...item, displayIndex: `0${start + index + 1}` }))
    this.setData({ reviewPage: page, pagedReviews })
  },

  closeExhibition() {
    this.setData({ selectedExhibition: null })
  },

  previewProgramImage() {
    if (!this.data.selectedProgram) return
    const programImages = [
      ...this.data.lectureReservations,
      ...this.data.lectureReviews,
      ...this.data.activityReservations,
      ...this.data.activityReviews
    ].map(item => item.image)
    wx.previewImage({
      current: this.data.selectedProgram.image,
      urls: programImages
    })
  },

  previewExhibitionImage() {
    if (!this.data.selectedExhibition) return
    wx.previewImage({
      current: this.data.selectedExhibition.image,
      urls: (this.data.currentExhibitions.length ? this.data.currentExhibitions : []).concat(this.data.reviews as any[]).map((item: any) => item.image)
    })
  },

  previewExhibitionArtwork(e: WechatMiniprogram.BaseEvent) {
    const artworks = this.data.selectedExhibition ? (this.data.selectedExhibition.artworks || []) : []
    const artwork = artworks.find(item => item.id === e.currentTarget.dataset.id)
    if (!artwork) return
    wx.previewImage({ current: artwork.image, urls: artworks.map(item => item.image) })
  },

  preventMove() {},

  // ===== 搜索功能 =====
  openSearch() {
    this.setData({ searchActive: true })
  },

  closeSearch() {
    this.setData({
      searchActive: false,
      searchKeyword: '',
      searchResultsExhibition: [],
      searchResultsLecture: [],
      searchResultsActivity: []
    })
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value.trim()
    this.setData({ searchKeyword: keyword })
    this.performSearch(keyword)
  },

  switchSearchTab(e: WechatMiniprogram.BaseEvent) {
    const tab = e.currentTarget.dataset.tab as 'exhibition' | 'lecture' | 'activity'
    this.setData({ searchTab: tab })
  },

  performSearch(keyword: string) {
    if (!keyword) {
      this.setData({
        searchResultsExhibition: [],
        searchResultsLecture: [],
        searchResultsActivity: []
      })
      return
    }
    const kw = keyword.toLowerCase()
    // 搜索展览（含当前展览、展览预告、展览回顾）
    const allExhibitions: Exhibition[] = this.data.currentExhibitions.length
      ? [...this.data.currentExhibitions, ...this.data.exhibitionPreviews, ...this.data.reviews]
      : [...this.data.exhibitionPreviews, ...this.data.reviews]
    const searchResultsExhibition = allExhibitions.filter(item =>
      item.title.toLowerCase().includes(kw) ||
      item.intro.toLowerCase().includes(kw) ||
      (item.location && item.location.toLowerCase().includes(kw)) ||
      (item.organizer && item.organizer.toLowerCase().includes(kw))
    )
    // 搜索讲座
    const allLectures: OfficialProgram[] = [...this.data.lectureReservations, ...this.data.lectureReviews]
    const searchResultsLecture = allLectures.filter(item =>
      item.title.toLowerCase().includes(kw) ||
      item.summary.toLowerCase().includes(kw) ||
      (item.speaker && item.speaker.toLowerCase().includes(kw))
    )
    // 搜索活动
    const searchResultsActivity = [...this.data.activityReservations, ...this.data.activityReviews].filter(item =>
      item.title.toLowerCase().includes(kw) ||
      item.summary.toLowerCase().includes(kw) ||
      (item.audience && item.audience.toLowerCase().includes(kw))
    )
    this.setData({ searchResultsExhibition, searchResultsLecture, searchResultsActivity })
  },

  searchResultCount(): number {
    return this.data.searchResultsExhibition.length + this.data.searchResultsLecture.length + this.data.searchResultsActivity.length
  },

  openSearchExhibition(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    // 当前展览
    const cur = this.data.currentExhibitions.find(item => item.id === id)
    if (cur) {
      this.setData({ selectedExhibition: cur, searchActive: false })
      return
    }
    // 展览预告
    const preview = this.data.exhibitionPreviews.find(item => item.id === id)
    if (preview) {
      this.setData({ selectedExhibition: preview, searchActive: false })
      return
    }
    // 展览回顾
    const exhibition = this.data.reviews.find(item => item.id === id)
    if (exhibition) {
      const favoriteIds = getFavoriteExhibitionIds()
      this.setData({
        selectedExhibition: { ...exhibition, liked: favoriteIds.includes(exhibition.id) },
        searchActive: false
      })
    }
  },

  openSearchProgram(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const program = [...this.data.lectureReservations, ...this.data.lectureReviews, ...this.data.activityReservations, ...this.data.activityReviews].find(item => item.id === id)
    if (program) {
      this.setData({ selectedProgram: program, searchActive: false })
    }
  },


  async loadAnnouncements() {
    try {
      const raw = await fetchAnnouncements()
      if (raw && raw.length > 0) {
        const announcements = raw.map(a => ({ ...a, urgent: !!a.urgent, popup: !!a.popup }))
        this.setData({ announcements, announcementIndex: 0 })
        // 弹窗公告：取第一条弹窗公告展示
        const popup = announcements.find(a => a.popup)
        if (popup) this.setData({ popupAnnouncement: popup })
      }
    } catch (_e) {
      // 公告接口失败则静默，不阻塞页面
    }
  },

  onAnnouncementChange(e: WechatMiniprogram.SwiperChange) {
    this.setData({ announcementIndex: e.detail.current })
  },

  openAnnouncement(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const item = this.data.announcements.find(a => a.id === id)
    if (item) this.setData({ popupAnnouncement: item })
  },

  closePopupAnnouncement() {
    this.setData({ popupAnnouncement: null })
  },

  quickJump(e: WechatMiniprogram.BaseEvent) {
    const target = String(e.currentTarget.dataset.target)
    const map: Record<string, string> = {
      exhibition: 'sec-exhibition',
      lecture: 'sec-lecture',
      activity: 'sec-activity',
      digital: 'sec-digital',
      submission: 'sec-submission'
    }
    const id = map[target]
    if (!id) return
    // 先清空再设置，确保连续点击同一目标也能触发
    this.setData({ scrollTarget: '' })
    setTimeout(() => this.setData({ scrollTarget: id }), 30)
  },

  async loadDailyPaintings() {
    try {
      const raw = await fetchDailyPaintings(5)
      if (raw && raw.length > 0) {
        const dailyPaintings = raw.map(p => ({
          ...p,
          // 保留正式 HTTPS 图片地址，Canvas/保存时再通过 downloadFile 转为临时路径。
          image: p.image
        }))
        this.setData({ dailyPaintings })
        return
      }
    } catch (_e) {
      // API 失败，使用本地 fallback
    }
    // 本地 fallback：从本地藏品中按日期种子确定性选取
    try {
      const artworks = await getArtworksAsync()
      if (artworks.length === 0) return
      const today = new Date()
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
      const shuffled = artworks.slice()
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = ((seed * (i + 1)) % (i + 1) + i + 1) % (i + 1)
        const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
      }
      const selected = shuffled.slice(0, Math.min(5, shuffled.length))
      const dailyPaintings = selected.map(a => ({
        id: a.id,
        title: a.title,
        artist: a.artist,
        image: a.image,
        intro: a.intro || '',
        work_intro: a.work_intro || '',
        birth: a.birth || '',
        category: a.category || ''
      }))
      this.setData({ dailyPaintings })
    } catch (_e) {
      // 本地也无数据，保持空列表
    }
  },

  openDailyPainting(e: WechatMiniprogram.BaseEvent) {
    const index = e.currentTarget.dataset.index as number
    const painting = this.data.dailyPaintings[index]
    if (!painting) return
    wx.navigateTo({ url: `/pages/daily-sign/daily-sign?id=${encodeURIComponent(painting.id)}&title=${encodeURIComponent(painting.title)}&artist=${encodeURIComponent(painting.artist)}&image=${encodeURIComponent(painting.image)}&intro=${encodeURIComponent(painting.work_intro || painting.intro || '')}&birth=${encodeURIComponent(painting.birth || '')}&category=${encodeURIComponent(painting.category || '')}` })
  },

  async loadDigitalGalleries() {
    try {
      const list = await fetchDigitalGalleries()
      if (list && list.length > 0) {
        // 封面图：后端返回的 cover 字段可能是 /assets/... 绝对路径或 http 链接
        const digitalGalleries = list.map(g => ({
          ...g,
          cover: g.cover ? (g.cover.startsWith('http') ? g.cover : (g.cover.startsWith('/assets/') ? '../..' + g.cover : g.cover)) : '../../assets/exhibitions/review-1.jpg'
        }))
        this.setData({ digitalGalleries, digitalGalleryIndex: 0 })
      }
    } catch (_e) {
      // API 失败则保持空列表，前端不展示数字展厅区域
    }
  }
})
