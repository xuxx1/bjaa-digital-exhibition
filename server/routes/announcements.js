/**
 * 公告管理 CRUD（展览页顶部公告栏 + 弹窗公告）
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

// 公告列表
router.get('/announcements', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM announcement ORDER BY sort_order, created_at DESC').all()
  list.forEach(a => {
    a.urgent = !!a.urgent
    a.popup = !!a.popup
    a.status = !!a.status
  })
  res.json(list)
})

// 新增公告
router.post('/announcements', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.title || !d.title.trim()) {
    return res.status(400).json({ error: '请填写公告标题' })
  }
  db.prepare(`INSERT INTO announcement (id, title, content, urgent, popup, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    d.id || 'ann-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    d.title.trim(),
    d.content || '',
    d.urgent ? 1 : 0,
    d.popup ? 1 : 0,
    d.status === undefined ? 1 : (d.status ? 1 : 0),
    d.sort_order || 0
  )
  res.json({ ok: true })
})

// 更新公告
router.put('/announcements/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.title || !d.title.trim()) {
    return res.status(400).json({ error: '请填写公告标题' })
  }
  db.prepare(`UPDATE announcement SET title=?, content=?, urgent=?, popup=?, status=?, sort_order=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.title.trim(),
    d.content || '',
    d.urgent ? 1 : 0,
    d.popup ? 1 : 0,
    d.status === undefined ? 1 : (d.status ? 1 : 0),
    d.sort_order || 0,
    req.params.id
  )
  res.json({ ok: true })
})

// 删除公告
router.delete('/announcements/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM announcement WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router