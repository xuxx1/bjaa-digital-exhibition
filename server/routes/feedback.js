/**
 * 用户反馈管理 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

// 列表（含联系方式，后台可见）
router.get('/feedback', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all()
  res.json(list)
})

// 新增（后台手工添加）
router.post('/feedback', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.content) return res.status(400).json({ error: '请填写反馈内容' })
  db.prepare(`INSERT INTO feedback (id, category, content, contact, status)
    VALUES (?, ?, ?, ?, ?)`).run(
    d.id, d.category || '建议', d.content, d.contact || '', d.status || '待处理'
  )
  res.json({ ok: true })
})

// 更新（含状态流转）
router.put('/feedback/:id', (req, res) => {
  const db = getDB()
  const d = req.body
  db.prepare(`UPDATE feedback SET category=?, content=?, contact=?, status=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    d.category || '其他', d.content, d.contact || '', d.status || '待处理', req.params.id
  )
  res.json({ ok: true })
})

// 回复反馈（管理端）
router.put('/feedback/:id/reply', (req, res) => {
  const db = getDB()
  const { reply } = req.body
  if (!reply || !reply.trim()) {
    return res.status(400).json({ error: '请填写回复内容' })
  }
  db.prepare("UPDATE feedback SET reply = ?, replied_at = datetime('now','localtime'), status = '已处理', updated_at = datetime('now','localtime') WHERE id = ?").run(reply.trim(), req.params.id)
  res.json({ ok: true })
})

router.delete('/feedback/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM feedback WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router