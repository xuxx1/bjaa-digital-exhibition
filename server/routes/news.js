/**
 * 新闻 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/news', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM news ORDER BY sort_order, created_at DESC').all()
  list.forEach(n => { try { n.content = JSON.parse(n.content || '[]') } catch { n.content = [] } })
  res.json(list)
})

router.post('/news', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`INSERT INTO news (id, title, date, type, summary, image, content, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.id, d.title, d.date, d.type, d.summary, d.image,
    JSON.stringify(d.content || []),
    d.sort_order || 0
  )
  res.json({ ok: true })
})

router.put('/news/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`UPDATE news SET title=?, date=?, type=?, summary=?, image=?, content=?, sort_order=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.title, d.date, d.type, d.summary, d.image,
    JSON.stringify(d.content || []),
    d.sort_order || 0, req.params.id
  )
  res.json({ ok: true })
})

router.delete('/news/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
