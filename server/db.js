/**
 * 数据库初始化 + 种子数据
 * 使用 better-sqlite3，同步 API，零配置
 */
const Database = require('better-sqlite3')
const path = require('path')
const bcrypt = require('bcryptjs')

const DB_PATH = path.join(__dirname, 'data.db')

let db

function getDB() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

function initTables() {
  const db = getDB()

  db.exec(`
    -- 管理员
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 展览
    CREATE TABLE IF NOT EXISTS exhibition (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT '当前展览',
      title TEXT NOT NULL,
      image TEXT,
      time TEXT,
      location TEXT,
      organizer TEXT,
      intro TEXT,
      status_text TEXT,
      reservable INTEGER DEFAULT 0,
      ended INTEGER DEFAULT 0,
      booking_dates TEXT,
      booking_times TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 展览作品
    CREATE TABLE IF NOT EXISTS exhibition_artwork (
      id TEXT PRIMARY KEY,
      exhibition_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      size TEXT,
      material TEXT,
      year TEXT,
      image TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (exhibition_id) REFERENCES exhibition(id) ON DELETE CASCADE
    );

    -- 藏品
    CREATE TABLE IF NOT EXISTS artwork (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      category TEXT DEFAULT '中国画',
      size TEXT,
      image TEXT,
      birth TEXT,
      identity TEXT,
      intro TEXT,
      artist_intro TEXT,
      work_intro TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 讲座/活动/展览预告
    CREATE TABLE IF NOT EXISTS program (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      image TEXT,
      publish_date TEXT,
      time TEXT,
      location TEXT,
      speaker TEXT,
      audience TEXT,
      summary TEXT,
      source_url TEXT,
      status_text TEXT,
      reservable INTEGER DEFAULT 0,
      ended INTEGER DEFAULT 0,
      booking_dates TEXT,
      booking_times TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 新闻
    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT,
      type TEXT,
      summary TEXT,
      image TEXT,
      content TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 线上微课 / 艺术小讲堂
    CREATE TABLE IF NOT EXISTS course (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT DEFAULT '图文专栏',      -- 短视频 / 图文专栏
      category TEXT DEFAULT '国画基础知识', -- 国画基础知识 / 齐白石艺术科普 / 其他
      cover TEXT,                          -- 封面图
      duration TEXT,                       -- 时长（短视频用，如 "5:30"）
      summary TEXT,                        -- 简介
      content TEXT,                        -- 正文内容（图文专栏：JSON 数组）
      video_url TEXT,                      -- 视频地址（短视频用）
      sort_order INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,            -- 1 上架 / 0 下架
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 线上征集活动（大众书画投稿）
    CREATE TABLE IF NOT EXISTS submission (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,                 -- 作品名称
      author TEXT NOT NULL,                -- 作者
      intro TEXT,                          -- 作品简介
      image TEXT,                          -- 作品图像
      contact TEXT,                        -- 联系方式（投稿人手机/微信，仅后台可见）
      status TEXT DEFAULT '待审核',        -- 待审核 / 已展示 / 未通过
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 用户反馈（意见/建议/问题/活动想法）
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      category TEXT DEFAULT '建议',
      content TEXT NOT NULL,
      contact TEXT,
      status TEXT DEFAULT '待处理',
      reply TEXT,
      replied_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 数字展厅（外部全景链接）
    CREATE TABLE IF NOT EXISTS digital_gallery (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,                  -- 外部全景页面 URL
      cover TEXT,                         -- 封面图
      description TEXT,                   -- 简介
      status INTEGER DEFAULT 1,           -- 1 上架 / 0 下架
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 反馈敏感词（含敏感词的反馈不能提交）
    CREATE TABLE IF NOT EXISTS sensitive_word (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,           -- 敏感词内容
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 公告（展览页顶部公告栏 + 弹窗）
    CREATE TABLE IF NOT EXISTS announcement (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,                 -- 公告标题
      content TEXT DEFAULT '',             -- 公告内容
      urgent INTEGER DEFAULT 0,            -- 是否紧急（1 紧急 / 0 普通）
      popup INTEGER DEFAULT 0,             -- 是否弹窗（1 进入页面弹窗 / 0 不弹窗）
      status INTEGER DEFAULT 1,            -- 1 发布 / 0 下架
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 预约
    CREATE TABLE IF NOT EXISTS booking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_no TEXT UNIQUE NOT NULL,
      program_id TEXT,
      program_kind TEXT,
      program_title TEXT,
      user_openid TEXT,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      booking_date TEXT,
      booking_time TEXT,
      visitors INTEGER DEFAULT 1,
      status TEXT DEFAULT '待确认',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 展览打卡
    CREATE TABLE IF NOT EXISTS checkin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exhibition_id TEXT NOT NULL,
      exhibition_title TEXT NOT NULL,
      user_openid TEXT,
      nickname TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(exhibition_id, user_openid)
    );
  `)

  // 兼容旧数据库：新增字段
  try { db.exec('ALTER TABLE artwork ADD COLUMN artist_intro TEXT') } catch {}
  try { db.exec('ALTER TABLE artwork ADD COLUMN work_intro TEXT') } catch {}
  try { db.exec('ALTER TABLE booking ADD COLUMN visitors_info TEXT') } catch {}
  try { db.exec('ALTER TABLE exhibition ADD COLUMN booking_quota INTEGER DEFAULT 5') } catch {}
  try { db.exec('ALTER TABLE program ADD COLUMN booking_quota INTEGER DEFAULT 5') } catch {}
  try { db.exec('ALTER TABLE feedback ADD COLUMN reply TEXT') } catch {}
  try { db.exec('ALTER TABLE feedback ADD COLUMN replied_at TEXT') } catch {}
}

function seed() {
  const db = getDB()

  // 默认管理员
  const existing = db.prepare('SELECT id FROM admin WHERE username = ?').get('admin')
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10)
    db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run('admin', hash)
    console.log('[seed] 默认管理员: admin / admin123')
  }
}

module.exports = { getDB, initTables, seed }
