import { getExhibitions, findExhibition } from '../../data/exhibitions'
import { getAllProgramsAsync, findOfficialProgramAsync } from '../../data/official-programs'
import { submitBooking, fetchDateConfirmedByProgram } from '../../data/api'

interface VisitorInfo {
  name: string
  phone: string
}

/** 可预约项目（展览/讲座/活动统一格式） */
interface ReservableItem {
  id: string
  title: string
  image: string
  kind: string           // '展览预约' | '讲座预约' | '活动预约'
  location: string
  bookingDates: Array<{ day: string; week: string; month: string; raw: string }>
  bookingTimes: string[]
  bookingQuota: number
}

interface DateCardData {
  day: string
  week: string
  month: string
  raw: string
  isMonday: boolean
  isFull: boolean
  booked: number
}

Page({
  data: {
    exhibition: null as any,
    bookingTitle: '预约参观',
    bookingKicker: 'RESERVATION',
    dateStepTitle: '选择参观日期',
    peopleStepTitle: '参观人数',
    // 可预约项目列表 & 选择状态
    reservableItems: [] as ReservableItem[],
    selectedItemId: '' as string,
    showItemPicker: false,
    hasItems: true,
    dates: [] as DateCardData[],
    times: ['上午场 9:00-12:00', '下午场 12:00-16:00'],
    selectedDate: 0,
    selectedTime: 0,
    visitors: 1,
    visitorList: [{ name: '', phone: '' }] as VisitorInfo[],
    agreed: false,
    submitted: false,
    bookingNo: '',
    bookingQuota: 5,
    // 当前选中日期的已预约人数和是否已满
    selectedDateBooked: 0,
    selectedDateFull: false,
    // 人数是否超出剩余名额
    visitorsExceedQuota: false,
  },

  async onLoad(options: Record<string, string>) {
    // 加载所有可预约项目
    await this.loadReservableItems()

    // 如果通过 URL 传入了指定 id，直接选中
    if (options.id) {
      if (options.source === 'exhibition') {
        const exhibition = await findExhibition(options.id)
        if (exhibition && exhibition.reservable) {
          this.selectReservableItem(exhibition.id, '展览预约')
        }
      } else {
        const program = await findOfficialProgramAsync(options.id)
        if (program && program.reservable) {
          this.selectReservableItem(program.id, program.kind)
        }
      }
    }

    if (!wx.getStorageSync('bfaa_logged_in')) {
      const pendingUrl = options.id ? (options.source === 'exhibition' ? `/pages/booking/booking?id=${options.id}&source=exhibition` : `/pages/booking/booking?id=${options.id}`) : '/pages/booking/booking'
      wx.setStorageSync('bfaa_pending_booking', pendingUrl)
      wx.showToast({ title: '请先登录后再预约', icon: 'none' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/profile/profile' })
      }, 800)
    }
  },

  /** 加载当前可预约的展览/讲座/活动列表 */
  async loadReservableItems() {
    const items: ReservableItem[] = []

    // 获取可预约的展览（当前展览 + 展览预告）
    try {
      const exhibitions = await getExhibitions()
      exhibitions.forEach(e => {
        if (e.reservable && !e.ended) {
          items.push({
            id: e.id,
            title: e.title,
            image: e.image,
            kind: '展览预约',
            location: e.location || '',
            bookingDates: e.bookingDates || [],
            bookingTimes: e.bookingTimes || [],
            bookingQuota: e.bookingQuota || 5
          })
        }
      })
    } catch (_e) { /* ignore */ }

    // 获取可预约的讲座/活动
    try {
      const programs = await getAllProgramsAsync()
      programs.forEach(p => {
        if (p.reservable && (p.kind === '讲座预约' || p.kind === '活动预约')) {
          items.push({
            id: p.id,
            title: p.title,
            image: p.image,
            kind: p.kind,
            location: p.location || '',
            bookingDates: p.bookingDates || [],
            bookingTimes: p.bookingTimes || [],
            bookingQuota: p.bookingQuota || 5
          })
        }
      })
    } catch (_e) { /* ignore */ }

    this.setData({ reservableItems: items, hasItems: items.length > 0 })

    // 如果只有一个可预约项，自动选中
    if (items.length === 1) {
      this.applyItemSelection(items[0])
    }
  },

  /** 用户点击选择某个可预约项目 */
  onSelectItem(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    const kind = String(e.currentTarget.dataset.kind)
    this.selectReservableItem(id, kind)
    this.setData({ showItemPicker: false })
  },

  /** 切换预约项目选择面板 */
  onSwitchItem() {
    this.setData({ showItemPicker: !this.data.showItemPicker })
  },

  /** 按id+kind查找并选中项目 */
  selectReservableItem(id: string, kind: string) {
    const item = this.data.reservableItems.find(i => i.id === id && i.kind === kind)
    if (item) {
      this.applyItemSelection(item)
    }
  },

  /** 将选中项目应用到表单 */
  applyItemSelection(item: ReservableItem) {
    const kindLabel = item.kind === '讲座预约' ? '讲座预约' : item.kind === '活动预约' ? '活动预约' : '展览预约'
    const kicker = item.kind === '讲座预约' ? 'LECTURE RESERVATION' : item.kind === '活动预约' ? 'ACTIVITY RESERVATION' : 'OPEN RESERVATION'
    const dateStep = item.kind === '讲座预约' ? '选择讲座场次' : item.kind === '活动预约' ? '选择活动场次' : '选择参观日期'
    const peopleStep = item.kind === '活动预约' ? '参与人数' : '参观人数'

    // 过滤：只保留明天及之后的日期，周一标注"闭馆"但仍显示
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0')

    // 生成未来30天日期（含周一标注闭馆）
    const dates: DateCardData[] = []
    const WEEKS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const MONTHS = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

    // 如果后台配置了预约日期，用它；否则自动生成未来30天
    if (item.bookingDates && item.bookingDates.length > 0) {
      // 用后台配置的日期，但只保留明天及之后的
      item.bookingDates.forEach(d => {
        const raw = d.raw || ''
        if (raw < tomorrowStr) return // 跳过今天及之前
        const parts = raw.split('-')
        const dayOfWeek = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getDay()
        dates.push({
          day: d.day,
          week: d.week || WEEKS[dayOfWeek],
          month: d.month || MONTHS[Number(parts[1])],
          raw,
          isMonday: dayOfWeek === 1,
          isFull: false,
          booked: 0
        })
      })
    } else {
      // 自动生成未来30天
      for (let i = 0; i < 30; i++) {
        const d = new Date(tomorrow)
        d.setDate(d.getDate() + i)
        const raw = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
        dates.push({
          day: String(d.getDate()).padStart(2, '0'),
          week: WEEKS[d.getDay()],
          month: MONTHS[d.getMonth() + 1],
          raw,
          isMonday: d.getDay() === 1,
          isFull: false,
          booked: 0
        })
      }
    }

    const quota = item.bookingQuota || 5

    this.setData({
      selectedItemId: item.id,
      exhibition: {
        id: item.id,
        title: item.title,
        image: item.image,
        location: item.location,
        intro: ''
      },
      bookingTitle: kindLabel,
      bookingKicker: kicker,
      dateStepTitle: dateStep,
      peopleStepTitle: peopleStep,
      dates,
      times: ['上午场 9:00-12:00', '下午场 12:00-16:00'],
      selectedDate: 0,
      selectedTime: 0,
      bookingQuota: quota,
      selectedDateBooked: 0,
      selectedDateFull: false,
    })

    // 批量查询每个日期的已预约人数
    const rawList = dates.map(d => d.raw).filter(raw => { const dd = dates.find(d => d.raw === raw); return dd ? !dd.isMonday : true })
    if (rawList.length > 0 && item.id) {
      fetchDateConfirmedByProgram(item.id, rawList).then(res => {
        const updatedDates = dates.map(d => {
          const booked = res[d.raw] || 0
          return { ...d, booked, isFull: !d.isMonday && booked >= quota }
        })
        this.setData({ dates: updatedDates })
        // 更新当前选中日期的已满状态
        this.updateSelectedDateStatus(updatedDates)
      }).catch(() => {
        // 查询失败时不做任何处理
      })
    }
  },

  /** 更新当前选中日期的已满状态 */
  updateSelectedDateStatus(dates?: DateCardData[]) {
    const allDates = dates || this.data.dates
    const selected = allDates[this.data.selectedDate]
    if (selected) {
      const booked = selected.booked
      const exceed = booked + this.data.visitors > this.data.bookingQuota
      this.setData({
        selectedDateBooked: booked,
        selectedDateFull: selected.isFull,
        visitorsExceedQuota: exceed
      })
    }
  },

  /** 校验当前人数是否超出剩余名额 */
  checkVisitorsQuota() {
    const exceed = this.data.selectedDateBooked + this.data.visitors > this.data.bookingQuota
    this.setData({ visitorsExceedQuota: exceed })
  },

  goBack() {
    wx.navigateBack()
  },

  chooseDate(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const selected = this.data.dates[index]
    if (selected && selected.isMonday) return // 周一不可选
    if (selected && selected.isFull) return // 已满不可选
    this.setData({ selectedDate: index })
    this.updateSelectedDateStatus()
  },

  chooseTime(e: WechatMiniprogram.BaseEvent) {
    this.setData({ selectedTime: Number(e.currentTarget.dataset.index) })
  },

  decreaseVisitors() {
    if (this.data.visitors <= 1) return
    const newCount = this.data.visitors - 1
    const visitorList = this.data.visitorList.slice(0, newCount)
    this.setData({ visitors: newCount, visitorList })
    this.checkVisitorsQuota()
  },

  increaseVisitors() {
    if (this.data.visitors >= 5) return
    const newCount = this.data.visitors + 1
    // 校验是否超出剩余名额
    if (this.data.selectedDateBooked + newCount > this.data.bookingQuota) {
      wx.showToast({ title: `已约${this.data.selectedDateBooked}人，最多再约${this.data.bookingQuota - this.data.selectedDateBooked}人`, icon: 'none' })
      return
    }
    const visitorList = [...this.data.visitorList, { name: '', phone: '' }]
    this.setData({ visitors: newCount, visitorList })
    this.checkVisitorsQuota()
  },

  onVisitorNameInput(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const visitorList = [...this.data.visitorList]
    visitorList[index] = { ...visitorList[index], name: e.detail.value }
    this.setData({ visitorList })
  },

  onVisitorPhoneInput(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const visitorList = [...this.data.visitorList]
    visitorList[index] = { ...visitorList[index], phone: e.detail.value }
    this.setData({ visitorList })
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  async submitBooking() {
    if (!this.data.selectedItemId) {
      wx.showToast({ title: '请先选择预约项目', icon: 'none' })
      return
    }
    // 检查所选日期是否已满或为周一
    const selectedDateObj = this.data.dates[this.data.selectedDate]
    if (selectedDateObj) {
      if (selectedDateObj.isMonday) {
        wx.showToast({ title: '周一闭馆，不可预约', icon: 'none' })
        return
      }
      if (selectedDateObj.isFull) {
        wx.showToast({ title: '该日期预约已满，请选择其他日期', icon: 'none' })
        return
      }
    }
    // 检查人数是否超出剩余名额
    if (this.data.selectedDateBooked + this.data.visitors > this.data.bookingQuota) {
      wx.showToast({ title: `已约${this.data.selectedDateBooked}人，本次${this.data.visitors}人超出上限`, icon: 'none' })
      return
    }
    for (let i = 0; i < this.data.visitorList.length; i++) {
      const v = this.data.visitorList[i]
      if (!v.name || !v.name.trim()) {
        wx.showToast({ title: `请填写第${i + 1}位参观人姓名`, icon: 'none' })
        return
      }
      if (!v.phone || !/^1\d{10}$/.test(v.phone)) {
        wx.showToast({ title: `请填写第${i + 1}位参观人手机号`, icon: 'none' })
        return
      }
    }
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读预约须知', icon: 'none' })
      return
    }
    const bookingNo = `BFAA${Date.now().toString().slice(-8)}`
    const dateObj = this.data.dates[this.data.selectedDate]
    const bookingDate = dateObj ? `${dateObj.month}${dateObj.day}日` : ''
    const bookingTime = this.data.times[this.data.selectedTime] || ''
    const primary = this.data.visitorList[0]
    const selectedItem = this.data.reservableItems.find(i => i.id === this.data.selectedItemId)
    const programKind = selectedItem ? selectedItem.kind : '展览预约'
    try {
      const result = await submitBooking({
        program_id: this.data.selectedItemId,
        program_kind: programKind,
        program_title: (this.data.exhibition && this.data.exhibition.title) || '',
        contact_name: primary.name,
        contact_phone: primary.phone,
        booking_date: bookingDate,
        booking_time: bookingTime,
        visitors: this.data.visitors,
        visitors_info: this.data.visitorList
      })
      console.log('[booking] 提交成功', result)
    } catch (e) {
      console.error('[booking] 提交失败', e)
      wx.showToast({ title: '预约提交失败，请检查网络', icon: 'none' })
      return
    }
    this.setData({
      submitted: true,
      bookingNo
    })
  },

  finishBooking() {
    wx.navigateBack()
  }
})
