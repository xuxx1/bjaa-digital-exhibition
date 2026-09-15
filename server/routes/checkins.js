/**
 * 打卡 + 勋章 API
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()

// ============ 管理端 API（需认证）============

// 获取所有可打卡的展览列表（管理端用）
router.get('/checkins/exhibitions', authMiddleware, (req, res) => {
  const db = getDB()
  const list = db.prepare("SELECT id, title, type FROM exhibition ORDER BY sort_order, created_at DESC").all()
  res.json(list)
})

// 查看某展览的打卡记录
router.get('/checkins/:exhibitionId', authMiddleware, (req, res) => {
  const db = getDB()
  const list = db.prepare('SELECT * FROM checkin WHERE exhibition_id = ? ORDER BY created_at DESC').all(req.params.exhibitionId)
  list.forEach(c => {
    try { c.nickname = c.nickname || '' } catch {}
    try { c.avatar_url = c.avatar_url || '' } catch {}
  })
  res.json(list)
})

// ============ 公开 API（小程序端调用）============

// 提交打卡
router.post('/public/checkins', (req, res) => {
  const db = getDB()
  const d = req.body
  if (!d.exhibition_id) {
    return res.status(400).json({ error: '缺少展览ID' })
  }

  // 查展览标题
  const exhibition = db.prepare('SELECT id, title FROM exhibition WHERE id = ?').get(d.exhibition_id)
  if (!exhibition) {
    return res.status(404).json({ error: '展览不存在' })
  }

  // 检查是否已打卡（同一用户同一展览只能打卡一次）
  if (d.user_openid) {
    const existing = db.prepare('SELECT id FROM checkin WHERE exhibition_id = ? AND user_openid = ?').get(d.exhibition_id, d.user_openid)
    if (existing) {
      return res.json({ ok: true, already: true, message: '已打卡过该展览' })
    }
  }

  db.prepare(`INSERT INTO checkin (exhibition_id, exhibition_title, user_openid, nickname, avatar_url)
    VALUES (?, ?, ?, ?, ?)`).run(
    d.exhibition_id,
    exhibition.title,
    d.user_openid || null,
    d.nickname || '',
    d.avatar_url || ''
  )

  res.json({ ok: true, already: false, message: '打卡成功' })
})

// 查询某用户的勋章列表
router.get('/public/checkins/badges', (req, res) => {
  const db = getDB()
  const { openid } = req.query
  if (!openid) return res.json([])

  const list = db.prepare('SELECT * FROM checkin WHERE user_openid = ? ORDER BY created_at DESC').all(openid)
  res.json(list)
})

// 查询某展览打卡人数
router.get('/public/checkins/count', (req, res) => {
  const db = getDB()
  const { exhibition_id } = req.query
  if (!exhibition_id) return res.json({ count: 0 })
  const result = db.prepare('SELECT COUNT(*) as count FROM checkin WHERE exhibition_id = ?').get(exhibition_id)
  res.json({ count: result.count })
})

module.exports = router