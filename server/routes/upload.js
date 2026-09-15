/**
 * 文件上传路由
 */
const express = require('express')
const multer = require('multer')
const path = require('path')
const { authMiddleware } = require('./auth')

const uploadDir = path.join(__dirname, '..', 'uploads')

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext)
  }
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

const router = express.Router()
router.use(authMiddleware)

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '无文件' })
  const url = `/uploads/${req.file.filename}`
  res.json({ url, filename: req.file.filename })
})

module.exports = router
