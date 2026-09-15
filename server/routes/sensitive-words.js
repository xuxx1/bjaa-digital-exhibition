/**
 * 反馈敏感词管理 CRUD
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

// 敏感词列表
router.get('/sensitive-words', (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT id, word, created_at FROM sensitive_word ORDER BY id DESC').all()
  res.json(list)
})

// 新增敏感词（支持逗号/空格/换行分隔批量添加）
router.post('/sensitive-words', (req, res) => {
  const db = getDB()
  const d = req.body
  const raw = String(d.words || d.word || '').trim()
  if (!raw) return res.status(400).json({ error: '请填写敏感词' })

  const words = raw.split(/[,，\s\n;；]+/).map(w => w.trim()).filter(Boolean)
  if (words.length === 0) return res.status(400).json({ error: '请填写敏感词' })

  const insert = db.prepare('INSERT OR IGNORE INTO sensitive_word (word) VALUES (?)')
  let added = 0
  const existing = []
  words.forEach(w => {
    const info = insert.run(w)
    if (info.changes > 0) added++
    else existing.push(w)
  })
  res.json({ ok: true, added, existing, total: words.length })
})

// 删除敏感词
router.delete('/sensitive-words/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM sensitive_word WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// 清空敏感词
router.delete('/sensitive-words', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM sensitive_word').run()
  res.json({ ok: true })
})

module.exports = router