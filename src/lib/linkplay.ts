import { p, typeOf } from './packer';

export enum PlayerState {
  Idle = 1, // 选歌

  Downloading = 2, // 正在下载
  NotReady = 3, // 在准备界面，自己没准备好
  Ready = 4, // 自己准备好了

  Syncing = 5, // 进入游戏，但是在显示技能前
  Desynced = 6, // 疑似在 Syncing 阶段超过 1.5s 出现

  Playing = 7, // 正在游玩
  GameEnd = 8, // 结算或者关门
};

export enum RoomState {
  Locked = 1, // 在有人 online 为 false 时进入此状态
  Idle = 2, // 选歌

  NotReady = 3, // 在准备界面，有人没准备好
  Countdown = 4, // 在准备界面，所有人都准备好了，进入倒计时

  // 似乎是同步时出现的，但是不知道具体含义
  Unknown5 = 5, // 要我猜的话，5 应该是同步延迟
  Unknown6 = 6, // 6 应该是倒计时

  Playing = 7, // 正在游玩
  GameEnd = 8, // 结算
  // 所有人要么离开要么关门也会进入状态 8
};

export enum Difficulty {
  None = -1,
  Past,
  Present,
  Future,
  Beyond,
};

export enum ClearType { // 与正常 ClearType 不同，0 代表不存在
  None = 0,
  TrackLost = 1,
  NormalComplete = 2,
  FullCombo = 3,
  PureMemory = 4,
  EasyClear = 5,
  HardClear = 6,
};

export const playerInfoSchema = p('playerInfo').struct([
  p('id').u64(),          // [0, 8) Player.id
  p('char').i8(),         // [8]    default -1
  p('uncapped').bool(),     // [9]
  p('difficulty').i8(),   // [10]
  p('score').u32(),       // [11, 15)
  p('timer?').u32(),      // [15, 19)
  p('clearType').u8(),    // [19]
  p('state').u8(),        // [20] getPlayerState = min(state, 4)
  p('downloadProg').i8(), // [21]
  p('online').bool(),       // [22]
]);
export type PlayerInfo = typeOf<typeof playerInfoSchema>;
export const defaultPlayer: PlayerInfo = {
  id: 0n,
  char: -1,
  uncapped: false,
  difficulty: -1,
  score: 0,
  'timer?': 0,
  clearType: 0,
  state: 1,
  downloadProg: 0,
  online: false,
} as const;

export const playerInfoWithNameSchema = p('playerInfoWithName').struct([
  ...playerInfoSchema.fields,
  p().u8(0),         // [23] padding
  p('name').buf(16), // [24, 40) Player.name
]);
export type PlayerInfoWithName = typeOf<typeof playerInfoWithNameSchema>;
export const defaultPlayerWithName: PlayerInfoWithName = {
  ...defaultPlayer,
  name: Buffer.from('EmptyPlayer\x00\x00\x00\x00\x00'),
} as const;

export const playerScoreSchema = p().struct([
  p('char').i8(),         // [0]
  p('difficulty').i8(),   // [1]
  p('score').u32(),       // [2, 6)
  p('clearType').u8(),    // [6]
  p('persenalBest').bool(), // [7]
  p('top').bool(),          // [8]
]);
export type PlayerScore = typeOf<typeof playerScoreSchema>;
export const defaultScore: PlayerScore = {
  char: -1,
  difficulty: -1,
  score: 0,
  clearType: 0,
  persenalBest: false,
  top: false,
} as const;

export const roomInfoSchema = p('roomInfo').struct([
  p('state').u8(),
  p('countdown').i32(),
  p('serverTime').u64(),
  p('songIdxWithDiff').i16(),
  p('interval?').u16(),
  p('times?').buf(7),

  p('lastScores').array(4, playerScoreSchema),
  p('lastSong').i16(),
  p('roundRobin').bool(),
]);
export type RoomInfo = typeOf<typeof roomInfoSchema>;

export const roomInfoWithHostSchema = p('roomInfoWithHost').struct([
  p('host').u64(),
  ...roomInfoSchema.fields,
]);
export type RoomInfoWithHost = typeOf<typeof roomInfoWithHostSchema>;