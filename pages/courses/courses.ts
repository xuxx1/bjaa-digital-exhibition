import { getCoursesAsync, Course } from '../../data/courses'

Page({
  data: {
    courses: [] as Course[],
    visibleCourses: [] as Course[],
    activeCategory: '全部',
    categories: ['全部', '国画基础知识', '齐白石艺术科普', '其他']
  },

  async onLoad() {
    const list = await getCoursesAsync()
    this.setData({
      courses: list,
      visibleCourses: list
    })
  },

  goBack() {
    wx.navigateBack()
  },

  chooseCategory(e: WechatMiniprogram.BaseEvent) {
    const category = String(e.currentTarget.dataset.category)
    const list = this.data.courses
    this.setData({
      activeCategory: category,
      visibleCourses: category === '全部' ? list : list.filter(item => item.category === category)
    })
  },

  openCourse(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id)
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${id}` })
  }
})