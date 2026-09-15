/**
 * 预约管理 — 查看预约列表 + 更新状态
 */
const express = require('express')
const { getDB } = require('../db')
const { authMiddleware } = require('./auth')

const router = express.Router()
router.use(authMiddleware)

// 列表（支持筛选）
router.get('/bookings', (req, res) => {
  const db = getDB()
  const { status, kind, keyword } = req.query
  let sql = 'SELECT * FROM booking WHERE 1=1'
  const params = []
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (kind) { sql += ' AND program_kind = ?'; params.push(kind) }
  if (keyword) { sql += ' AND (contact_name LIKE ? OR contact_phone LIKE ? OR booking_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`) }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  // 解析 visitors_info JSON
  list.forEach(b => {
    try { b.visitors_info = JSON.parse(b.visitors_info || '[]') } catch { b.visitors_info = [] }
  })
  res.json(list)
})

// 更新状态
router.put('/bookings/:id/status', (req, res) => {
  const db = getDB()
  const { status } = req.body
  if (!['待确认', '已确认', '已取消', '已完成'].includes(status)) {
    return res.status(400).json({ error: '无效状态' })
  }
  db.prepare('UPDATE booking SET status = ? WHERE id = ?').run(status, req.params.id)
  res.json({ ok: true })
})

// 批量更新状态
router.put('/bookings/batch-status', (req, res) => {
  const db = getDB()
  const { ids, status } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择预约记录' })
  }
  if (!['待确认', '已确认', '已取消', '已完成'].includes(status)) {
    return res.status(400).json({ error: '无效状态' })
  }
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`UPDATE booking SET status = ? WHERE id IN (${placeholders})`).run(status, ...ids)
  res.json({ ok: true, updated: ids.length })
})

// 批量删除
router.delete('/bookings/batch', (req, res) => {
  const db = getDB()
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择预约记录' })
  }
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM booking WHERE id IN (${placeholders})`).run(...ids)
  res.json({ ok: true, deleted: ids.length })
})

// 删除
router.delete('/bookings/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM booking WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// 统计（按人数统计：预约几人记几人）
router.get('/bookings/stats', (req, res) => {
  const db = getDB()
  const total = db.prepare('SELECT COALESCE(SUM(visitors),0) as count FROM booking').get().count
  const pending = db.prepare("SELECT COALESCE(SUM(visitors),0) as count FROM booking WHERE status = '待确认'").get().count
  const confirmed = db.prepare("SELECT COALESCE(SUM(visitors),0) as count FROM booking WHERE status = '已确认'").get().count
  const today = db.prepare("SELECT COALESCE(SUM(visitors),0) as count FROM booking WHERE status = '已确认' AND date(created_at) = date('now','localtime')").get().count
  // 按来源分组统计已确认人数
  const bySource = db.prepare(`
    SELECT program_id, program_kind, program_title,
      COALESCE(SUM(visitors),0) as confirmed_count
    FROM booking WHERE status = '已确认' AND program_id IS NOT NULL
    GROUP BY program_id ORDER BY confirmed_count DESC
  `).all()
  // 按类型分组统计
  const byKind = db.prepare(`
    SELECT program_kind,
      COALESCE(SUM(visitors),0) as total_count,
      COALESCE(SUM(CASE WHEN status='已确认' THEN visitors ELSE 0 END),0) as confirmed_count
    FROM booking GROUP BY program_kind
  `).all()
  res.json({ total, pending, confirmed, today, bySource, byKind })
})

module.exports = router
