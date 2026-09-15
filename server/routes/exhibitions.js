/**
 * 展览 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

// 列表
router.get('/exhibitions', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM exhibition ORDER BY sort_order, created_at DESC').all()
  // 附带作品 + 解析 JSON 字段
  const withArtworks = list.map(e => {
    const artworks = db.prepare('SELECT * FROM exhibition_artwork WHERE exhibition_id = ? ORDER BY sort_order').all(e.id)
    return {
      ...e,
      artworks,
      reservable: !!e.reservable,
      ended: !!e.ended,
      booking_dates: safeParse(e.booking_dates),
      booking_times: safeParse(e.booking_times)
    }
  })
  res.json(withArtworks)
})

// 新增
router.post('/exhibitions', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`INSERT INTO exhibition (id, type, title, image, time, location, organizer, intro, status_text, reservable, ended, booking_dates, booking_times, booking_quota, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.id, d.type || '当前展览', d.title, d.image, d.time, d.location, d.organizer, d.intro,
    d.status_text || null,
    d.reservable ? 1 : 0,
    d.ended ? 1 : 0,
    stringify(d.booking_dates),
    stringify(d.booking_times),
    d.booking_quota || 5,
    d.sort_order || 0
  )
  // 子作品
  if (d.artworks && d.artworks.length) {
    const stmt = db.prepare(`INSERT INTO exhibition_artwork (id, exhibition_id, title, artist, size, material, year, image, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    d.artworks.forEach((a, i) => {
      stmt.run(a.id, d.id, a.title, a.artist, a.size, a.material, a.year, a.image, i)
    })
  }
  res.json({ ok: true })
})

// 更新
router.put('/exhibitions/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`UPDATE exhibition SET type=?, title=?, image=?, time=?, location=?, organizer=?, intro=?, status_text=?, reservable=?, ended=?, booking_dates=?, booking_times=?, booking_quota=?, sort_order=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.type, d.title, d.image, d.time, d.location, d.organizer, d.intro,
    d.status_text || null,
    d.reservable ? 1 : 0,
    d.ended ? 1 : 0,
    stringify(d.booking_dates),
    stringify(d.booking_times),
    d.booking_quota || 5,
    d.sort_order || 0,
    req.params.id
  )
  // 替换子作品
  db.prepare('DELETE FROM exhibition_artwork WHERE exhibition_id = ?').run(req.params.id)
  if (d.artworks && d.artworks.length) {
    const stmt = db.prepare(`INSERT INTO exhibition_artwork (id, exhibition_id, title, artist, size, material, year, image, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    d.artworks.forEach((a, i) => {
      stmt.run(a.id, req.params.id, a.title, a.artist, a.size, a.material, a.year, a.image, i)
    })
  }
  res.json({ ok: true })
})

// 删除
router.delete('/exhibitions/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM exhibition WHERE id = ?').run(req.params.id)
  db.prepare('DELETE FROM exhibition_artwork WHERE exhibition_id = ?').run(req.params.id)
  res.json({ ok: true })
})

// 工具函数
function safeParse(s) {
  if (!s) return []
  if (Array.isArray(s)) return s
  try { return JSON.parse(s) } catch { return [] }
}

function stringify(arr) {
  if (!arr) return null
  if (typeof arr === 'string') return arr
  return JSON.stringify(arr)
}

module.exports = router
