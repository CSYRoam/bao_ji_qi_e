/* ============ 暴击企鹅 · 规则配置（可调参） ============ */
window.CONFIG = {
  /** 初始金币 */
  startCoins: 10000,

  /** 解锁猜球所需击球次数 */
  hitsTarget: 20,

  /** 下注档位（两页翻页） */
  betPages: [
    [100, 500, 1000],
    [1000, 5000, 20000],
  ],
  defaultBet: 100,

  /** 猜球掏球动画时长（毫秒） */
  guessDrawMs: 3000,

  /**
   * 球池：击球奖励倍率表（图4）
   * type: solid=全色 / stripe=花色 / eight=黑8 / cue=白球 / special=特殊球
   * weight: 抽取权重（百分比，合计100）
   * 猜球判定仅使用 solid(1-7) 与 stripe(9-15)，各50%概率
   */
  balls: [
    { key: 'star', num: null, type: 'stripe',  color: '#ff4fd8', mult: 40,   weight: 0.5 },
    { key: 'b8',   num: 8,    type: 'eight',   color: '#1b1b1f', mult: 10,   weight: 1   },
    { key: 'b15',  num: 15,   type: 'stripe',  color: '#8b4a2f', mult: 1.5,  weight: 3   },
    { key: 'b14',  num: 14,   type: 'stripe',  color: '#23b14d', mult: 1.4,  weight: 4   },
    { key: 'b13',  num: 13,   type: 'stripe',  color: '#ff8c1a', mult: 1.3,  weight: 5   },
    { key: 'b12',  num: 12,   type: 'stripe',  color: '#8e44dd', mult: 1.2,  weight: 6   },
    { key: 'b11',  num: 11,   type: 'stripe',  color: '#f03a3a', mult: 1.1,  weight: 7   },
    { key: 'b10',  num: 10,   type: 'stripe',  color: '#2f6df6', mult: 1,    weight: 8   },
    { key: 'b9',   num: 9,    type: 'stripe',  color: '#ffd21f', mult: 0.9,  weight: 8   },
    { key: 'b7',   num: 7,    type: 'solid',   color: '#8b4a2f', mult: 0.7,  weight: 9   },
    { key: 'b6',   num: 6,    type: 'solid',   color: '#23b14d', mult: 0.6,  weight: 9   },
    { key: 'b5',   num: 5,    type: 'solid',   color: '#ff8c1a', mult: 0.5,  weight: 9   },
    { key: 'b4',   num: 4,    type: 'solid',   color: '#8e44dd', mult: 0.4,  weight: 8   },
    { key: 'b3',   num: 3,    type: 'solid',   color: '#f03a3a', mult: 0.3,  weight: 7   },
    { key: 'b2',   num: 2,    type: 'solid',   color: '#2f6df6', mult: 0.2,  weight: 6   },
    { key: 'b1',   num: 1,    type: 'solid',   color: '#ffd21f', mult: 0.1,  weight: 5   },
    { key: 'bad',  num: null, type: 'solid',   color: '#d31626', mult: 0.01, weight: 2.5 },
    { key: 'cue',  num: null, type: 'cue',     color: '#f4f4f6', mult: 0,    weight: 2   },
  ],

  /** 本地存档 key */
  saveKey: 'baoji-qie-save-v1',
};
