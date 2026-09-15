/**
 * 公开 API — 小程序端调用，无需认证
 */
const express = require('express')
const { getDB } = require('../db')

const router = express.Router()

// 展览
router.get('/exhibitions', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM exhibition ORDER BY sort_order, created_at DESC').all()
  list.forEach(e => {
    e.artworks = db.prepare('SELECT * FROM exhibition_artwork WHERE exhibition_id = ? ORDER BY sort_order').all(e.id)
    e.reservable = !!e.reservable
    e.ended = !!e.ended
    e.booking_quota = e.booking_quota || 5
    try { e.booking_dates = JSON.parse(e.booking_dates || '[]') } catch { e.booking_dates = [] }
    try { e.booking_times = JSON.parse(e.booking_times || '[]') } catch { e.booking_times = [] }
  })
  res.json(list)
})

// 藏品
router.get('/artworks', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM artwork ORDER BY sort_order, created_at DESC').all()
  res.json(list)
})

// 讲座/活动
router.get('/programs', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM program ORDER BY sort_order, created_at DESC').all()
  list.forEach(p => {
    p.reservable = !!p.reservable
    p.ended = !!p.ended
    p.booking_quota = p.booking_quota || 5
    try { p.booking_dates = JSON.parse(p.booking_dates || '[]') } catch { p.booking_dates = [] }
    try { p.booking_times = JSON.parse(p.booking_times || '[]') } catch { p.booking_times = [] }
  })
  res.json(list)
})

// 新闻
router.get('/news', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM news ORDER BY sort_order, created_at DESC').all()
  list.forEach(n => { try { n.content = JSON.parse(n.content || '[]') } catch { n.content = [] } })
  res.json(list)
})

// 线上微课 / 艺术小讲堂（仅返回上架课程）
router.get('/courses', (req, res) => {
  const db = getDB()
  const list = db.prepare("SELECT * FROM course WHERE status = 1 ORDER BY sort_order, created_at DESC").all()
  list.forEach(c => {
    try { c.content = JSON.parse(c.content || '[]') } catch { c.content = [] }
  })
  res.json(list)
})

// 公告（仅返回已发布公告，按排序倒序）
router.get('/announcements', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT id, title, content, urgent, popup FROM announcement WHERE status = 1 ORDER BY urgent DESC, sort_order, created_at DESC').all()
  list.forEach(a => {
    a.urgent = !!a.urgent
    a.popup = !!a.popup
  })
  res.json(list)
})

// 线上征集活动（仅返回已展示的投稿）
router.get('/submissions', (req, res) => {
  const db = getDB()
  const list = db.prepare("SELECT id, title, author, intro, image, created_at FROM submission WHERE status = '已展示' ORDER BY sort_order, created_at DESC").all()
  res.json(list)
})

// 大众投稿（无需认证）
router.post('/submissions', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.title || !d.author) {
    return res.status(400).json({ error: '请填写作品名称和作者' })
  }
  const id = 'sub-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  db.prepare(`INSERT INTO submission (id, title, author, intro, image, contact, status)
    VALUES (?, ?, ?, ?, ?, ?, '待审核')`).run(
    id, d.title, d.author, d.intro || '', d.image || '', d.contact || ''
  )
  res.json({ ok: true, id })
})

// 用户反馈提交（无需认证，含敏感词校验）
router.post('/feedback', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.content || !d.content.trim()) {
    return res.status(400).json({ error: '请填写反馈内容' })
  }
  // 敏感词校验：含敏感词的反馈不能提交
  const words = db.prepare('SELECT word FROM sensitive_word').all()
  if (words.length > 0) {
    const text = d.content
    const hit = words.find(w => w.word && text.indexOf(w.word) !== -1)
    if (hit) {
      return res.status(400).json({ error: '反馈内容包含不当词汇，请修改后再提交', sensitive_word: hit.word })
    }
  }
  const id = 'fb-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  db.prepare(`INSERT INTO feedback (id, category, content, contact, status)
    VALUES (?, ?, ?, ?, '待处理')`).run(
    id, d.category || '建议', d.content.trim(), d.contact || ''
  )
  res.json({ ok: true, id })
})

// 查询我的反馈（按联系方式匹配，含回复内容）
router.get('/feedback/mine', (req, res) => {
  const db = getDB()
  const { contact } = req.query
  if (!contact) return res.json([])
  const list = db.prepare('SELECT id, category, content, status, reply, replied_at, created_at FROM feedback WHERE contact = ? ORDER BY created_at DESC').all(String(contact))
  res.json(list)
})

// 提交预约
router.post('/bookings', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.contact_name || !d.contact_phone) {
    return res.status(400).json({ error: '请填写联系人信息' })
  }
  const booking_no = 'BFAA' + Date.now().toString().slice(-8)
  const visitorsInfo = d.visitors_info ? JSON.stringify(d.visitors_info) : null
  db.prepare(`INSERT INTO booking (booking_no, program_id, program_kind, program_title, user_openid, contact_name, contact_phone, booking_date, booking_time, visitors, status, visitors_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待确认', ?)`).run(
    booking_no, d.program_id || null, d.program_kind || null, d.program_title || null,
    d.user_openid || null, d.contact_name, d.contact_phone,
    d.booking_date || null, d.booking_time || null, d.visitors || 1,
    visitorsInfo
  )
  res.json({ ok: true, booking_no })
})

// 查询我的预约
router.get('/bookings/mine', (req, res) => {
  const db = getDB()
  const { openid } = req.query
  if (!openid) return res.json([])
  const list = db.prepare('SELECT * FROM booking WHERE user_openid = ? ORDER BY created_at DESC').all(openid)
  list.forEach(b => {
    try { b.visitors_info = JSON.parse(b.visitors_info || '[]') } catch { b.visitors_info = [] }
  })
  res.json(list)
})

// 按来源查询预约人数（未取消的，供小程序展示）
router.get('/bookings/confirmed-count', (req, res) => {
  const db = getDB()
  const { program_id } = req.query
  if (!program_id) return res.json({ count: 0 })
  const result = db.prepare("SELECT COALESCE(SUM(visitors),0) as count FROM booking WHERE program_id = ? AND status != '已取消'").get(program_id)
  res.json({ count: result.count })
})

// 查询指定项目在指定日期的预约人数（未取消的）
// ?program_id=xxx&date=YYYY-MM-DD
router.get('/bookings/date-confirmed-count', (req, res) => {
  const db = getDB()
  const { program_id, date } = req.query
  if (!program_id) return res.json({ count: 0 })
  let sql = "SELECT COALESCE(SUM(visitors),0) as count FROM booking WHERE program_id = ? AND status != '已取消'"
  const params = [program_id]
  if (date) {
    // 从 YYYY-MM-DD 提取日，匹配 booking_date 中的 "XX日"
    const day = date.split('-')[2]
    sql += " AND booking_date LIKE ?"
    params.push('%' + day + '日')
  }
  const result = db.prepare(sql).get(...params)
  res.json({ count: result.count })
})

// 批量查询多个项目今日预约人数（未取消的）
// ?ids=id1,id2,id3
router.get('/bookings/today-confirmed-by-program', (req, res) => {
  const db = getDB()
  const { ids } = req.query
  if (!ids) return res.json({})
  const idList = String(ids).split(',').filter(Boolean)
  if (idList.length === 0) return res.json({})
  const placeholders = idList.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT program_id, COALESCE(SUM(visitors),0) as count
     FROM booking
     WHERE program_id IN (${placeholders})
       AND status != '已取消'
       AND booking_date LIKE '%' || strftime('%d','now','localtime') || '日'
     GROUP BY program_id`
  ).all(...idList)
  const result = {}
  rows.forEach(r => { result[r.program_id] = r.count })
  // 未查到的项目补0
  idList.forEach(id => { if (!result[id]) result[id] = 0 })
  res.json(result)
})

// 批量查询指定项目在多个日期的已确认预约人数
// ?program_id=xxx&dates=2026-08-11,2026-08-12,2026-08-13
router.get('/bookings/date-confirmed-by-program', (req, res) => {
  const db = getDB()
  const { program_id, dates } = req.query
  if (!program_id) return res.json({})
  const dateList = dates ? String(dates).split(',').filter(Boolean) : []
  if (dateList.length === 0) return res.json({})
  const result = {}
  dateList.forEach(dateStr => {
    const day = dateStr.split('-')[2]
    const row = db.prepare(
      "SELECT COALESCE(SUM(visitors),0) as count FROM booking WHERE program_id = ? AND status != '已取消' AND booking_date LIKE ?"
    ).get(program_id, '%' + day + '日')
    result[dateStr] = row.count
  })
  res.json(result)
})

// 数字展厅（仅返回上架的）
router.get('/digital-galleries', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT id, title, url, cover, description, sort_order, created_at FROM digital_gallery WHERE status = 1 ORDER BY sort_order, created_at DESC').all()
  res.json(list)
})

// 每日一画：基于日期种子确定性返回 N 幅藏品
router.get('/daily-paintings', (req, res) => {
  const db = getDB()
  const count = Math.min(Math.max(parseInt(req.query.count) || 5, 1), 20)
  const allArtworks = db.prepare('SELECT id, title, artist, image, intro, work_intro, birth, category FROM artwork ORDER BY sort_order, created_at DESC').all()
  if (allArtworks.length === 0) return res.json([])

  // 基于今天日期生成确定性种子
  const today = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  const seed = today.getFullYear() * 1000 + dayOfYear

  // 简易确定性洗牌（Fisher-Yates with seed）
  const shuffled = [...allArtworks]
  let s = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  res.json(shuffled.slice(0, count))
})

module.exports = router
