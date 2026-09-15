/**
 * 讲座/活动/展览预告 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/programs', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM program ORDER BY sort_order, created_at DESC').all()
  // booking_dates/booking_times 是 JSON 字符串
  list.forEach(p => {
    p.reservable = !!p.reservable
    p.ended = !!p.ended
    try { p.booking_dates = JSON.parse(p.booking_dates || '[]') } catch { p.booking_dates = [] }
    try { p.booking_times = JSON.parse(p.booking_times || '[]') } catch { p.booking_times = [] }
  })
  res.json(list)
})

router.post('/programs', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`INSERT INTO program (id, kind, title, image, publish_date, time, location, speaker, audience, summary, source_url, status_text, reservable, ended, booking_dates, booking_times, booking_quota, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.id, d.kind, d.title, d.image, d.publish_date, d.time, d.location, d.speaker,
    d.audience, d.summary, d.source_url, d.status_text,
    d.reservable ? 1 : 0, d.ended ? 1 : 0,
    JSON.stringify(d.booking_dates || []),
    JSON.stringify(d.booking_times || []),
    d.booking_quota || 5,
    d.sort_order || 0
  )
  res.json({ ok: true })
})

router.put('/programs/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`UPDATE program SET kind=?, title=?, image=?, publish_date=?, time=?, location=?, speaker=?, audience=?, summary=?, source_url=?, status_text=?, reservable=?, ended=?, booking_dates=?, booking_times=?, booking_quota=?, sort_order=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.kind, d.title, d.image, d.publish_date, d.time, d.location, d.speaker,
    d.audience, d.summary, d.source_url, d.status_text,
    d.reservable ? 1 : 0, d.ended ? 1 : 0,
    JSON.stringify(d.booking_dates || []),
    JSON.stringify(d.booking_times || []),
    d.booking_quota || 5,
    d.sort_order || 0, req.params.id
  )
  res.json({ ok: true })
})

router.delete('/programs/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM program WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
