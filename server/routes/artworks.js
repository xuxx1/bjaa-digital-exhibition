/**
 * 藏品 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/artworks', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM artwork ORDER BY sort_order, created_at DESC').all()
  res.json(list)
})

router.post('/artworks', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`INSERT INTO artwork (id, title, artist, category, size, image, birth, identity, intro, artist_intro, work_intro, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.id, d.title, d.artist, d.category || '中国画', d.size, d.image, d.birth, d.identity, d.intro || '', d.artist_intro || '', d.work_intro || '', d.sort_order || 0
  )
  res.json({ ok: true })
})

router.put('/artworks/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`UPDATE artwork SET title=?, artist=?, category=?, size=?, image=?, birth=?, identity=?, intro=?, artist_intro=?, work_intro=?, sort_order=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(d.title, d.artist, d.category, d.size, d.image, d.birth, d.identity, d.intro || '', d.artist_intro || '', d.work_intro || '', d.sort_order || 0, req.params.id)
  res.json({ ok: true })
})

router.delete('/artworks/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM artwork WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
