/**
 * 认证路由 — 登录获取 JWT
 */
const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { getDB } = require('../db')

const router = express.Router()
const JWT_SECRET = 'bfaa-admin-2026'
const JWT_EXPIRES = '7d'

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' })
  }

  const db = getDB()
  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username)
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
  res.json({ token, username: admin.username })
})

// 验证中间件
function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET)
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期' })
  }
}

module.exports = { router, authMiddleware }
