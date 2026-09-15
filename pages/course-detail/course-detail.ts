import { getCoursesAsync, Course } from '../../data/courses'
import { resolveCachedImagePath } from '../../data/api'

Page({
  data: {
    course: null as Course | null,
    paragraphs: [] as Array<{ type: 'text' | 'img'; text?: string; src?: string }>
  },

  async onLoad(query: Record<string, string>) {
    const id = query.id || ''
    const list = await getCoursesAsync()
    const course = list.find(item => item.id === id)
    if (!course) {
      wx.showToast({ title: '课程不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    this.setData({
      course,
      paragraphs: this.parseContent(course.content)
    })
    wx.setNavigationBarTitle({ title: course.title })
  },

  parseContent(content: string[]): Array<{ type: 'text' | 'img'; text?: string; src?: string }> {
    return (content || []).map(line => {
      const m = line.match(/^\[img:(.+)\]$/)
      if (m) return { type: 'img', src: resolveCachedImagePath(m[1]) }
      return { type: 'text', text: line }
    })
  },

  goBack() {
    wx.navigateBack()
  }
})