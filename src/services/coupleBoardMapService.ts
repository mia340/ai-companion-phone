import type { CoupleBoardCellType } from './coupleBoardGameService'

export type CoupleBoardVisualMode = 'romantic' | 'pixel'
export type CoupleBoardMapZone = 'home' | 'street' | 'park' | 'date' | 'night' | 'private'

export interface CoupleBoardMapStop {
  index: number
  name: string
  zone: CoupleBoardMapZone
  x: number
  y: number
  scenery: string
  hint: string
}

/**
 * A 30-stop date route. Coordinates are percentages inside the map stage and intentionally
 * form a winding route rather than a spreadsheet-like board. The game rules still use the
 * stable 0..29 indexes, so old saves remain compatible.
 */
export const COUPLE_BOARD_MAP_STOPS: CoupleBoardMapStop[] = [
  { index: 0, name: '家门口', zone: 'home', x: 9, y: 87, scenery: '🏠', hint: '今晚从这里出发' },
  { index: 1, name: '街角', zone: 'street', x: 19, y: 80, scenery: '🌷', hint: '刚好并肩走' },
  { index: 2, name: '便利店', zone: 'street', x: 31, y: 84, scenery: '🏪', hint: '顺手买点喜欢的' },
  { index: 3, name: '斑马线', zone: 'street', x: 43, y: 77, scenery: '🚦', hint: '等灯的时候靠近一点' },
  { index: 4, name: '甜品店', zone: 'date', x: 57, y: 82, scenery: '🍰', hint: '甜一点也没关系' },
  { index: 5, name: '小巷', zone: 'street', x: 71, y: 76, scenery: '✨', hint: '路灯把影子拉得很近' },
  { index: 6, name: '花店', zone: 'date', x: 84, y: 81, scenery: '💐', hint: '路过也会想起对方' },
  { index: 7, name: '公园入口', zone: 'park', x: 89, y: 67, scenery: '🌳', hint: '风开始慢下来' },
  { index: 8, name: '长椅', zone: 'park', x: 77, y: 61, scenery: '🪑', hint: '适合多停一会儿' },
  { index: 9, name: '喷泉边', zone: 'park', x: 64, y: 66, scenery: '⛲', hint: '水声会把沉默变柔软' },
  { index: 10, name: '树影下', zone: 'park', x: 51, y: 59, scenery: '🍃', hint: '说点平时没说的' },
  { index: 11, name: '夜市', zone: 'date', x: 38, y: 64, scenery: '🏮', hint: '人很多，手别走丢' },
  { index: 12, name: '娃娃机', zone: 'date', x: 25, y: 58, scenery: '🧸', hint: '输赢没那么重要' },
  { index: 13, name: '电影院', zone: 'date', x: 11, y: 63, scenery: '🎬', hint: '灯暗下来的那一刻' },
  { index: 14, name: '最后一排', zone: 'date', x: 8, y: 49, scenery: '🍿', hint: '离得好像更近了' },
  { index: 15, name: '河边', zone: 'night', x: 21, y: 43, scenery: '🌊', hint: '很适合把话说慢一点' },
  { index: 16, name: '月光桥', zone: 'night', x: 35, y: 48, scenery: '🌙', hint: '月光有一点偏心' },
  { index: 17, name: '桥中央', zone: 'night', x: 49, y: 41, scenery: '🌉', hint: '回头就能看见彼此' },
  { index: 18, name: '夜风台阶', zone: 'night', x: 62, y: 46, scenery: '💫', hint: '今晚不必急着走' },
  { index: 19, name: '天台门', zone: 'night', x: 76, y: 39, scenery: '🚪', hint: '再往前一点点' },
  { index: 20, name: '天台', zone: 'night', x: 89, y: 45, scenery: '🌌', hint: '城市在下面，你们在这里' },
  { index: 21, name: '回家路', zone: 'street', x: 86, y: 30, scenery: '🚕', hint: '回去也可以继续聊' },
  { index: 22, name: '玄关', zone: 'home', x: 72, y: 25, scenery: '🗝️', hint: '终于只剩你们两个' },
  { index: 23, name: '厨房', zone: 'home', x: 58, y: 31, scenery: '🥛', hint: '拿杯水，继续慢慢说' },
  { index: 24, name: '客厅', zone: 'home', x: 45, y: 24, scenery: '🛋️', hint: '最普通也最容易放松' },
  { index: 25, name: '沙发边', zone: 'private', x: 31, y: 29, scenery: '🫶', hint: '适合靠着，不赶时间' },
  { index: 26, name: '阳台', zone: 'private', x: 17, y: 23, scenery: '🌃', hint: '风吹进来，距离没吹远' },
  { index: 27, name: '走廊', zone: 'private', x: 11, y: 13, scenery: '🕯️', hint: '声音会自然放轻' },
  { index: 28, name: '床边', zone: 'private', x: 27, y: 9, scenery: '🛏️', hint: '只聊彼此都舒服的事' },
  { index: 29, name: '心跳终点', zone: 'private', x: 45, y: 12, scenery: '💘', hint: '棋局结束，关系不会重置' }
]

export function getCoupleBoardMapStop(index: number) {
  return COUPLE_BOARD_MAP_STOPS[Math.max(0, Math.min(COUPLE_BOARD_MAP_STOPS.length - 1, Math.trunc(index)))]
}

export function coupleBoardZoneLabel(zone: CoupleBoardMapZone) {
  return ({ home: '一起回家', street: '约会街区', park: '晚风公园', date: '约会时间', night: '夜色路线', private: '只属于你们' } as const)[zone]
}

export function mapStopBias(stop: CoupleBoardMapStop, cellType?: CoupleBoardCellType) {
  const themesByZone = {
    home: ['daily', 'memory', 'playful'],
    street: ['daily', 'playful', 'flirt'],
    park: ['memory', 'chemistry', 'flirt'],
    date: ['flirt', 'playful', 'jealousy', 'chemistry'],
    night: ['chemistry', 'memory', 'intimacy'],
    private: ['intimacy', 'adult', 'private']
  } as const
  return {
    location: stop.name,
    zone: stop.zone,
    themes: [...themesByZone[stop.zone]],
    cellType
  }
}
