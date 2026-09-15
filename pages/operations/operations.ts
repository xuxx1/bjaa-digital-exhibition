Page({
  data: {
    updatedAt: '2026.08.03 21:40',
    visits: '1,286',
    visitTrend: '+12.4%',
    heat: 87,
    hourlyVisits: [
      { time: '09', value: 24, count: 62 },
      { time: '10', value: 39, count: 114 },
      { time: '11', value: 55, count: 176 },
      { time: '12', value: 42, count: 123 },
      { time: '13', value: 61, count: 198 },
      { time: '14', value: 78, count: 246 },
      { time: '15', value: 91, count: 287 },
      { time: '16', value: 68, count: 202 }
    ],
    popularArtworks: [
      { rank: '01', title: '虾', artist: '齐白石', views: '3,842', heat: 96 },
      { rank: '02', title: '草间鹌鹑', artist: '齐白石', views: '3,156', heat: 88 },
      { rank: '03', title: '钟馗搔背图', artist: '齐白石', views: '2,704', heat: 76 }
    ],
    environment: {
      temperature: '22.6',
      humidity: '52',
      targetTemperature: '20—24°C',
      targetHumidity: '45—60%RH'
    },
    devices: [
      { name: '三层展厅灯光', code: 'LIGHT · 3F', status: '正常', detail: '36 / 36 组在线', progress: 100 },
      { name: '四层展厅灯光', code: 'LIGHT · 4F', status: '正常', detail: '28 / 28 组在线', progress: 100 },
      { name: '恒温系统', code: 'HVAC · TEMP', status: '正常', detail: '22.6°C · 稳定', progress: 92 },
      { name: '恒湿系统', code: 'HVAC · RH', status: '正常', detail: '52%RH · 稳定', progress: 87 }
    ],
    logs: [
      { time: '20:30', title: '闭馆前设备巡检', result: '全部正常' },
      { time: '17:00', title: '展厅温湿度复核', result: '符合标准' },
      { time: '13:30', title: '重点展柜照度检测', result: '照度正常' },
      { time: '09:00', title: '开馆设备启动检查', result: '全部正常' }
    ]
  },

  goBack() {
    wx.navigateBack()
  },

  refreshData() {
    const now = new Date()
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    this.setData({ updatedAt: `2026.08.03 ${hour}:${minute}` })
    wx.showToast({ title: '数据已刷新', icon: 'success' })
  }
})
