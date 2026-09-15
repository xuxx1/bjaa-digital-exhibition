/**
 * 数据导入脚本 — 将小程序现有静态数据写入 SQLite
 * 用法: node seed.js
 */
const { getDB, initTables, seed } = require('./db')
const bcrypt = require('bcryptjs')

// 初始化
initTables()
seed()

const db = getDB()

// ============ 展览（含展览预告） ============
const exhibitions = [
  { id: 'current-0', type: '当前展览', title: '问虫——齐白石的草间对话', image: '/assets/exhibitions/current-0.jpg', time: '2026年03月20日 至 2026年10月11日', location: '北京画院美术馆三、四层展厅', organizer: '中央美术学院、山东工艺美术学院、北京画院', intro: '从齐白石笔下的草虫世界出发，观看艺术家如何以细微观察、质朴笔墨与蓬勃生命力，在方寸纸面中展开一场跨越时间的草间对话。', status_text: '', reservable: 0, ended: 0, booking_dates: null, booking_times: null },
  { id: 'preview-5095', type: '展览预告', title: '灿然天地——关广志艺术展', image: '/assets/programs/preview-5095.jpg', time: '2026年8月7日起', location: '北京画院美术馆', organizer: '', intro: '北京画院"二十世纪中国美术大家研究系列"第69个项目，汇集关广志水彩、铜版画精品70余件。', status_text: '即将开展', reservable: 1, ended: 0, booking_dates: JSON.stringify([]), booking_times: JSON.stringify([]) },
  { id: 'review-0', type: '展览回顾', title: '未来白石美育艺术季·童心童语', image: '/assets/exhibitions/review-0.jpg', time: '2026年07月23日 至 2026年08月02日', location: '', organizer: '', intro: '此次展览与北京画院年度特展"问虫——齐白石的草间对话"同期举办。', status_text: '', reservable: 0, ended: 0, booking_dates: null, booking_times: null },
  { id: 'review-1', type: '展览回顾', title: '真言可贵——周思聪的变法之路', image: '/assets/exhibitions/review-1.jpg', time: '2026年06月19日 至 2026年07月19日', location: '', organizer: '中国美术家协会、中国美术馆、中央美术学院、中国女画家协会、北京美术家协会、北京画院', intro: '本次展览由中国美术家协会、中国美术馆、中央美术学院、中国女画家协会、北京美术家协会、北京画院共同主办，作为北京画院"二十世纪中国美术大家系列展"的重要篇章，展览呈现周思聪在艺术道路上的持续探索与变革。', status_text: '', reservable: 0, ended: 0, booking_dates: null, booking_times: null },
  { id: 'review-2', type: '展览回顾', title: '京西揽胜——"三山五园"主题创作展', image: '/assets/exhibitions/review-2.jpg', time: '2026年05月29日 至 2026年06月14日', location: '北京画院美术馆一、二层', organizer: '北京画院', intro: '北京文化艺术基金2025年度资助，北京画院主办的"京西揽胜——\u2018三山五园\u2019主题创作展"于2026年5月29日在北京画院美术馆一、二层正式启幕。', status_text: '', reservable: 0, ended: 0, booking_dates: null, booking_times: null },
  { id: 'review-3', type: '展览回顾', title: '已有丹青约——蒋采苹作品展', image: '/assets/exhibitions/review-3.jpg', time: '2026年04月30日 至 2026年05月24日', location: '北京画院美术馆', organizer: '中央美术学院、中国工笔画学会、中国女画家协会、北京画院', intro: '为缅怀中国当代工笔重彩画艺术大家蒋采苹先生，本次展览汇集蒋先生跨越半个多世纪的工笔重彩、创作手稿、写生佳作等，尽显工笔重彩之华。', status_text: '', reservable: 0, ended: 0, booking_dates: null, booking_times: null },
  { id: 'review-4', type: '展览回顾', title: '我代山川而言——亚明写生作品展', image: '/assets/exhibitions/review-4.jpg', time: '2026年03月27日 至 2026年04月26日', location: '北京画院美术馆', organizer: '', intro: '此次展览以写生为主题，展出60余件亚明先生在1960年至2000年间绘制于不同国家和地区的山川风情画作。', status_text: '', reservable: 0, ended: 0, booking_dates: null, booking_times: null }
]

const exhibitionArtworks = [
  // review-1
  { id: 'review-1-0', exhibition_id: 'review-1', title: '蒋兆和先生肖像', artist: '周思聪', size: '60 × 107 cm', material: '纸本设色', year: '1962', image: '/assets/exhibition-artworks/review-1-0.jpg' },
  { id: 'review-1-1', exhibition_id: 'review-1', title: '清晨', artist: '周思聪', size: '80 × 119 cm', material: '绢本设色', year: '1963', image: '/assets/exhibition-artworks/review-1-1.jpg' },
  { id: 'review-1-2', exhibition_id: 'review-1', title: '长白青松', artist: '周思聪', size: '112 × 95 cm', material: '纸本设色', year: '1973', image: '/assets/exhibition-artworks/review-1-2.jpg' },
  // review-2
  { id: 'review-2-0', exhibition_id: 'review-2', title: '翠峦春晓万寿山', artist: '庄小雷、郭宝君、牛朝、买鸿钧 等', size: '145 × 360 cm', material: '纸本设色', year: '2024', image: '/assets/exhibition-artworks/review-2-0.jpg' },
  { id: 'review-2-1', exhibition_id: 'review-2', title: '春风和煦玉泉山', artist: '庄小雷、郭宝君、牛朝、买鸿钧 等', size: '145 × 360 cm', material: '纸本设色', year: '2024', image: '/assets/exhibition-artworks/review-2-1.jpg' },
  { id: 'review-2-2', exhibition_id: 'review-2', title: '翠湖湿地印象', artist: '徐卫国', size: '137 × 68 cm', material: '纸本设色', year: '2024', image: '/assets/exhibition-artworks/review-2-2.jpg' },
  // review-3
  { id: 'review-3-0', exhibition_id: 'review-3', title: '三月三之夜（二联画）', artist: '蒋采苹', size: '180 × 180 cm', material: '工笔重彩', year: '1988', image: '/assets/exhibition-artworks/review-3-0.jpg' },
  { id: 'review-3-1', exhibition_id: 'review-3', title: '金秋', artist: '蒋采苹', size: '170 × 97 cm', material: '工笔重彩', year: '1994', image: '/assets/exhibition-artworks/review-3-1.jpg' },
  { id: 'review-3-2', exhibition_id: 'review-3', title: '雾中苗女', artist: '蒋采苹', size: '170 × 97 cm', material: '工笔重彩', year: '2012', image: '/assets/exhibition-artworks/review-3-2.jpg' },
  // review-4
  { id: 'review-4-0', exhibition_id: 'review-4', title: '夜航', artist: '亚明', size: '28 × 34 cm', material: '纸本设色', year: '年代未载', image: '/assets/exhibition-artworks/review-4-0.jpg' },
  { id: 'review-4-1', exhibition_id: 'review-4', title: '夜航（铅笔稿）', artist: '亚明', size: '17 × 23 cm', material: '纸本铅笔', year: '年代未载', image: '/assets/exhibition-artworks/review-4-1.jpg' },
  { id: 'review-4-2', exhibition_id: 'review-4', title: '西人岛有此一景', artist: '亚明', size: '66.5 × 44.5 cm', material: '纸本设色', year: '1983', image: '/assets/exhibition-artworks/review-4-2.jpg' }
]

// ============ 藏品 ============
const artworks = [
  { id: 'qi-40', title: '十二属图', artist: '齐白石', category: '齐白石', size: '68.5 × 36 cm', image: '/assets/artworks/qi-40.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。他早年学习民间艺术，后转向文人写意绘画，在传统笔墨基础上融入生活观察，形成了质朴清新、生动传神的艺术风格。' },
  { id: 'qi-50', title: '壶酒盘蟹', artist: '齐白石', category: '齐白石', size: '68.5 × 33.5 cm', image: '/assets/artworks/qi-50.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。' },
  { id: 'qi-60', title: '借山图卷', artist: '齐白石', category: '齐白石', size: '30 × 48 cm', image: '/assets/artworks/qi-60.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。' },
  { id: 'qi-90', title: '钟馗搔背图', artist: '齐白石', category: '齐白石', size: '89 × 47 cm', image: '/assets/artworks/qi-90.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。' },
  { id: 'qi-110', title: '草虫册页之七', artist: '齐白石', category: '齐白石', size: '尺寸未载', image: '/assets/artworks/qi-110.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。' },
  { id: 'qi-120', title: '草间鹌鹑', artist: '齐白石', category: '齐白石', size: '30 × 39 cm', image: '/assets/artworks/qi-120.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。' },
  { id: 'qi-130', title: '樱桃', artist: '齐白石', category: '齐白石', size: '100 × 33.5 cm', image: '/assets/artworks/qi-130.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。' },
  { id: 'qi-150', title: '虾', artist: '齐白石', category: '齐白石', size: '134 × 33 cm', image: '/assets/artworks/qi-150.jpg', birth: '1864—1957', identity: '近现代中国绘画大师、中国画艺术家、篆刻家、书法家', intro: '齐白石是中国近现代绘画史上具有重要影响的艺术家之一。' },
  { id: 'cn-xbh', title: '马', artist: '徐悲鸿', category: '中国画', size: '149.5 × 81 cm', image: '/assets/artworks/cn-xbh.jpg', birth: '1895—1953', identity: '中国现代美术教育家、画家，中国现代美术的重要奠基者之一', intro: '徐悲鸿是中国现代美术发展的重要推动者。他主张融合中国传统绘画与西方写实技法，强调造型基础和现实主义精神。' },
  { id: 'cn-lkr', title: '暮归图', artist: '李可染', category: '中国画', size: '69 × 45.5 cm', image: '/assets/artworks/cn-lkr.jpg', birth: '1907—1989', identity: '中国现代著名山水画家、美术教育家', intro: '李可染是中国现代山水画的重要代表人物。他强调深入自然写生，通过积墨技法强化山水空间和光影效果。' },
  { id: 'cn-hbh', title: '山水（宋）', artist: '黄宾虹', category: '中国画', size: '77 × 32.5 cm', image: '/assets/artworks/cn-hbh.jpg', birth: '1865—1955', identity: '中国近现代山水画大师、美术史论家、金石学家', intro: '黄宾虹是中国近现代山水画的重要代表人物之一。他深入研究中国历代绘画传统，强调笔墨精神。' },
  { id: 'cn-zdq', title: '山水（石溪）', artist: '张大千', category: '中国画', size: '110 × 48.5 cm', image: '/assets/artworks/cn-zdq.jpg', birth: '1899—1983', identity: '中国近现代著名画家、中国画大师', intro: '张大千是20世纪中国画坛的重要艺术家之一。他广泛学习中国历代绘画传统，并深入研究敦煌壁画艺术。' },
  { id: 'cn-zsc', title: '荷（三）', artist: '周思聪', category: '中国画', size: '50.5 × 55 cm', image: '/assets/artworks/cn-zsc.jpg', birth: '1939—1996', identity: '中国现代著名人物画家、中国美术家协会会员', intro: '周思聪是中国现代人物画的重要代表人物之一。她继承现实主义人物画传统，同时不断探索水墨表现的新方式。' },
  { id: 'cn-wxt', title: '松雉', artist: '王雪涛', category: '中国画', size: '96.5 × 56 cm', image: '/assets/artworks/cn-wxt.jpg', birth: '1903—1982', identity: '中国近现代著名花鸟画家、美术教育家', intro: '王雪涛是20世纪中国花鸟画的重要画家。他继承传统花鸟画精髓，同时吸收西方绘画观察方法。' },
  { id: 'cn-jzh', title: '向毛主席汇报', artist: '蒋兆和', category: '中国画', size: '102 × 142 cm', image: '/assets/artworks/cn-jzh.jpg', birth: '1904—1986', identity: '中国现代著名人物画家、美术教育家', intro: '蒋兆和是中国现代人物画的重要奠基者之一。他将西方素描造型方法与中国水墨传统相结合。' },
  { id: 'cn-yqy', title: '寂乡之舞', artist: '叶浅予', category: '中国画', size: '67 × 46.5 cm', image: '/assets/artworks/cn-yqy.jpg', birth: '1907—1995', identity: '中国现代著名画家、漫画家、美术教育家', intro: '叶浅予是中国现代人物画和漫画艺术的重要代表人物。他以敏锐的观察力和简练生动的线条表现人物形象。' }
]

// ============ 讲座/活动 ============
const programs = [
  { id: 'lecture-5081', kind: '讲座预约', title: '可惜无声——齐白石的草虫画研究', image: '/assets/programs/lecture-5081.jpg', publish_date: '2026.07.28', time: '2026年7月31日 9:30—11:30', location: '北京画院美术馆5层报告厅', speaker: '吕晓', summary: '从艺术源流、精神解读与书画辨伪三个方向，梳理齐白石工虫花卉的创作与鉴定逻辑。', source_url: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=171&news=5081', status_text: '本期已结束', reservable: 0, ended: 1, booking_dates: '[]', booking_times: '[]' },
  { id: 'lecture-review-5082', kind: '讲座回顾', title: '写意画的文脉', image: '/assets/programs/review-5082.jpg', publish_date: '2026.07.29', speaker: '邵彦', summary: '通过大量作品实例梳理工笔、写意两支的发展脉络，分析从小写意到大写意的飞跃及其哲学、美学理念。', source_url: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=171&news=5082', status_text: '查看回顾', reservable: 0, ended: 0, booking_dates: '[]', booking_times: '[]' },
  { id: 'lecture-review-5041', kind: '讲座回顾', title: '立身误坠皮毛类——再谈齐白石与吴昌硕的恩怨', image: '/assets/programs/review-5041.jpg', publish_date: '2026.07.08', speaker: '吕晓', summary: '从日记、诗歌与绘画对比回到历史原境，解读齐白石如何把相关讥评转化为艺术革新的动力。', source_url: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=171&news=5041', status_text: '查看回顾', reservable: 0, ended: 0, booking_dates: '[]', booking_times: '[]' },
  { id: 'activity-5085', kind: '活动预约', title: '好饿的毛毛虫——皮影小剧场工作坊', image: '/assets/programs/activity-5085.jpg', publish_date: '2026.07.27', time: '2026年7月30日 9:30—11:30', location: '北京画院美术馆三层展厅门口集合', audience: '7—12岁儿童，每位儿童限一位家长陪同', summary: '结合"问虫——齐白石的草间对话"展览，在光影剧场中创作属于自己的小虫皮影故事。', source_url: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5085', status_text: '报名已结束', reservable: 0, ended: 1, booking_dates: '[]', booking_times: '[]' },
  { id: 'activity-5084', kind: '活动预约', title: '与虫翩翩——创舞体验工作坊', image: '/assets/programs/activity-5084.jpg', publish_date: '2026.07.26', time: '2026年7月29日 9:30—11:30', location: '北京画院美术馆', audience: '7—12岁儿童，每位儿童限一位家长陪同', summary: '从齐白石笔下的草虫出发，以身体动作、想象与舞蹈感受自然节奏。', source_url: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5084', status_text: '报名已结束', reservable: 0, ended: 1, booking_dates: '[]', booking_times: '[]' },
  { id: 'activity-review-5085', kind: '活动回顾', title: '好饿的毛毛虫——皮影小剧场工作坊回顾', image: '/assets/programs/activity-5085.jpg', publish_date: '2026.08.01', summary: '小朋友们用皮影讲述了自己的草虫故事，在光影中感受传统艺术的魅力。', source_url: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5085', status_text: '查看回顾', reservable: 0, ended: 0, booking_dates: '[]', booking_times: '[]' },
  { id: 'activity-review-5084', kind: '活动回顾', title: '与虫翩翩——创舞体验工作坊回顾', image: '/assets/programs/activity-5084.jpg', publish_date: '2026.07.30', summary: '孩子们在展厅中化身草虫，用肢体语言与齐白石笔下的自然生命展开对话。', source_url: 'https://www.bjaa.com.cn/news.html?hcs=11&clg=170&news=5084', status_text: '查看回顾', reservable: 0, ended: 0, booking_dates: '[]', booking_times: '[]' }
]

// ============ 新闻 ============
const news = [
  { id: 'news-0', title: '童心作笔，草间问虫——"未来白石美育艺术季·童心童语"展览开展', date: '2026-07-24', type: '展览动态', summary: '以经典为桥梁，为青少年搭建感知美、表达美、创造美的广阔平台。', image: '/assets/news/news-0.jpg', content: JSON.stringify(['2026年7月23日，"未来白石美育艺术季·童心童语"展览如约而至。本次展览由北京画院与中国宋庆龄青少年科技文化交流中心联合主办，北京市学生金帆书画院秘书处协办。', '此次展览与北京画院年度特展"问虫——齐白石的草间对话"同期举办。当成年人的目光向下俯身、贴近地面、凝视微小，孩子们的目光则向上仰望、平视、触摸、想象，两种目光在展厅中形成跨越时空的对话。', '展览以多条线索呈现孩子们眼中的草间世界，通过绘画、综合材料、装置与多元媒介，重新发现那些容易被忽略的微小生命与自然奇迹。']) },
  { id: 'news-1', title: '喜讯｜我馆策展项目入选文化和旅游部2026年全国美术馆青年策展项目扶持计划', date: '2026-07-15', type: '画院新闻', summary: '北京画院美术馆策展项目成功入选全国美术馆青年策展项目扶持计划。', image: '/assets/news/news-1.jpg', content: JSON.stringify(['近日，文化和旅游部公布2026年全国美术馆青年策展项目扶持计划入选名单，北京画院美术馆策展项目成功入选。', '该计划旨在鼓励青年策展人立足中华优秀传统文化与当代艺术实践，持续提升美术馆的策展研究能力和公共文化服务水平。', '北京画院将继续推动学术研究、馆藏活化与公共教育之间的深入连接，为观众带来更具文化厚度与当代视野的展览。']) },
  { id: 'news-2', title: '北京画院2026年度定向招聘退役大学生士兵拟录用人员公示', date: '2026-07-15', type: '公示公告', summary: '北京画院发布2026年度定向招聘拟录用人员公示。', image: '', content: JSON.stringify(['根据2026年度北京市事业单位面向退役大学生士兵定向招聘相关工作安排，北京画院现对拟录用人员进行公示。', '公示期间如有异议，请通过书面、电话或来访等方式如实反映情况，并提供真实姓名、联系电话及地址。', '本信息来源于项目本地新闻数据集，具体名单及公示要求以北京画院正式公告为准。']) },
  { id: 'news-3', title: '北京画院美术馆和齐白石旧居纪念馆恢复开放通知', date: '2026-07-12', type: '开放通知', summary: '暴雨红色预警解除，北京画院美术馆和齐白石旧居纪念馆恢复开放。', image: '', content: JSON.stringify(['根据气象部门预报，全市分区暴雨红色预警已经解除，北京画院美术馆和齐白石旧居纪念馆即刻起恢复开放。', '请观众根据开放时间合理安排出行，参观过程中注意安全，并关注北京画院后续通知。']) },
  { id: 'news-4', title: '临时闭馆通知', date: '2026-07-10', type: '开放通知', summary: '受汛期天气影响，北京画院美术馆和齐白石旧居纪念馆临时闭馆。', image: '', content: JSON.stringify(['根据气象部门发布的汛期预警信息，为确保观众安全，北京画院美术馆和齐白石旧居纪念馆于2026年7月10日9:00起采取临时闭馆措施。', '恢复开放时间将根据汛情另行通知。请观众及时关注天气预报和北京画院发布的最新信息，合理安排出行。']) }
]

// ============ 写入 ============
const insertExhibition = db.prepare(`INSERT OR IGNORE INTO exhibition (id, type, title, image, time, location, organizer, intro, status_text, reservable, ended, booking_dates, booking_times) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
const insertExhibitionArtwork = db.prepare(`INSERT OR IGNORE INTO exhibition_artwork (id, exhibition_id, title, artist, size, material, year, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
const insertArtwork = db.prepare(`INSERT OR IGNORE INTO artwork (id, title, artist, category, size, image, birth, identity, intro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
const insertProgram = db.prepare(`INSERT OR IGNORE INTO program (id, kind, title, image, publish_date, time, location, speaker, audience, summary, source_url, status_text, reservable, ended, booking_dates, booking_times) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
const insertNews = db.prepare(`INSERT OR IGNORE INTO news (id, title, date, type, summary, image, content, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

const runAll = db.transaction(() => {
  exhibitions.forEach(e => insertExhibition.run(e.id, e.type, e.title, e.image, e.time, e.location, e.organizer, e.intro, e.status_text, e.reservable, e.ended, e.booking_dates, e.booking_times))
  console.log(`[seed] 展览: ${exhibitions.length} 条`)

  exhibitionArtworks.forEach(a => insertExhibitionArtwork.run(a.id, a.exhibition_id, a.title, a.artist, a.size, a.material, a.year, a.image))
  console.log(`[seed] 展览作品: ${exhibitionArtworks.length} 条`)

  artworks.forEach(a => insertArtwork.run(a.id, a.title, a.artist, a.category, a.size, a.image, a.birth, a.identity, a.intro))
  console.log(`[seed] 藏品: ${artworks.length} 条`)

  programs.forEach(p => insertProgram.run(p.id, p.kind, p.title, p.image, p.publish_date, p.time, p.location, p.speaker, p.audience, p.summary, p.source_url, p.status_text, p.reservable, p.ended, p.booking_dates, p.booking_times))
  console.log(`[seed] 讲座/活动: ${programs.length} 条`)

  news.forEach((n, i) => insertNews.run(n.id, n.title, n.date, n.type, n.summary, n.image, n.content, i))
  console.log(`[seed] 新闻: ${news.length} 条`)
})

runAll()
console.log('[seed] 数据导入完成！')
