/**
 * 北京画院美术馆 — 后端服务入口
 * Express + SQLite + JWT 认证 + 管理后台静态页
 */
const express = require('express')
const path = require('path')
const { getDB, initTables, seed } = require('./db')

// 初始化数据库
initTables()
seed()

const app = express()
const PORT = process.env.PORT || 3000

// 基础中间件
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 静态资源
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/admin', express.static(path.join(__dirname, 'admin')))
// 小程序 assets 目录（展览图、藏品图等），供管理后台预览
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')))

// 路由
const { router: authRouter, authMiddleware } = require('./routes/auth')
app.use('/api/auth', authRouter)
app.use('/api/admin', require('./routes/exhibitions'))
app.use('/api/admin', require('./routes/artworks'))
app.use('/api/admin', require('./routes/programs'))
app.use('/api/admin', require('./routes/news'))
app.use('/api/admin', require('./routes/courses'))
app.use('/api/admin', require('./routes/submissions'))
app.use('/api/admin', require('./routes/feedback'))
app.use('/api/admin', require('./routes/sensitive-words'))
app.use('/api/admin', require('./routes/announcements'))
app.use('/api/admin', require('./routes/digital-galleries'))
app.use('/api/admin', require('./routes/bookings'))
app.use('/api/admin', require('./routes/upload'))
app.use('/api/public', require('./routes/public'))

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 管理后台 SPA 回退
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'))
})

// 公开投稿图片上传（小程序端调用，无需认证）
const multer = require('multer')
const uploadDir = path.join(__dirname, 'uploads')
const pubStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, 'pub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext)
  }
})
const pubUpload = multer({ storage: pubStorage, limits: { fileSize: 10 * 1024 * 1024 } })
app.post('/api/public/upload', pubUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '无文件' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

app.listen(PORT, () => {
  console.log(`[BFAA Server] 启动成功`)
  console.log(`  管理后台: http://localhost:${PORT}/admin`)
  console.log(`  公开 API: http://localhost:${PORT}/api/public`)
  console.log(`  默认账号: admin / admin123`)
})
