/**
 * 线上征集活动 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

// 列表（含联系方式，后台可见）
router.get('/submissions', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM submission ORDER BY sort_order, created_at DESC').all()
  res.json(list)
})

// 新增（后台手工添加，或由公开 API 投稿）
router.post('/submissions', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`INSERT INTO submission (id, title, author, intro, image, contact, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.id, d.title, d.author, d.intro || '', d.image || '', d.contact || '',
    d.status || '待审核', d.sort_order || 0
  )
  res.json({ ok: true })
})

router.put('/submissions/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`UPDATE submission SET title=?, author=?, intro=?, image=?, contact=?, status=?, sort_order=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.title, d.author, d.intro || '', d.image || '', d.contact || '',
    d.status || '待审核', d.sort_order || 0, req.params.id
  )
  res.json({ ok: true })
})

router.delete('/submissions/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM submission WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router