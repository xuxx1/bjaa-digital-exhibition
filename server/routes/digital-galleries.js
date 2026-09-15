/**
 * 数字展厅管理 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

// 列表
router.get('/digital-galleries', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM digital_gallery ORDER BY sort_order, created_at DESC').all()
  list.forEach(g => { g.status = !!g.status })
  res.json(list)
})

// 新增
router.post('/digital-galleries', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.title || !d.title.trim()) return res.status(400).json({ error: '请填写展厅标题' })
  if (!d.url || !d.url.trim()) return res.status(400).json({ error: '请填写全景页面 URL' })
  db.prepare(`INSERT INTO digital_gallery (id, title, url, cover, description, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    d.id || 'dg-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    d.title.trim(),
    d.url.trim(),
    d.cover || '',
    d.description || '',
    d.status === undefined ? 1 : (d.status ? 1 : 0),
    d.sort_order || 0
  )
  res.json({ ok: true })
})

// 更新
router.put('/digital-galleries/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.title || !d.title.trim()) return res.status(400).json({ error: '请填写展厅标题' })
  if (!d.url || !d.url.trim()) return res.status(400).json({ error: '请填写全景页面 URL' })
  db.prepare(`UPDATE digital_gallery SET title=?, url=?, cover=?, description=?, status=?, sort_order=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.title.trim(),
    d.url.trim(),
    d.cover || '',
    d.description || '',
    d.status === undefined ? 1 : (d.status ? 1 : 0),
    d.sort_order || 0,
    req.params.id
  )
  res.json({ ok: true })
})

// 删除
router.delete('/digital-galleries/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM digital_gallery WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
