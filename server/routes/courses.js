/**
 * 线上微课 / 艺术小讲堂 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/courses', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM course ORDER BY sort_order, created_at DESC').all()
  list.forEach(c => {
    try { c.content = JSON.parse(c.content || '[]') } catch { c.content = [] }
  })
  res.json(list)
})

router.post('/courses', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`INSERT INTO course (id, title, type, category, cover, duration, summary, content, video_url, sort_order, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.id, d.title, d.type || '图文专栏', d.category || '国画基础知识',
    d.cover || '', d.duration || '', d.summary || '',
    JSON.stringify(d.content || []), d.video_url || '',
    d.sort_order || 0, d.status === undefined ? 1 : (d.status ? 1 : 0)
  )
  res.json({ ok: true })
})

router.put('/courses/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`UPDATE course SET title=?, type=?, category=?, cover=?, duration=?, summary=?, content=?, video_url=?, sort_order=?, status=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.title, d.type || '图文专栏', d.category || '国画基础知识',
    d.cover || '', d.duration || '', d.summary || '',
    JSON.stringify(d.content || []), d.video_url || '',
    d.sort_order || 0, d.status === undefined ? 1 : (d.status ? 1 : 0),
    req.params.id
  )
  res.json({ ok: true })
})

router.delete('/courses/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM course WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router