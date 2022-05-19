import crypto from 'crypto';

import { Room } from './room';
import { ClearType, Difficulty, PlayerInfo, PlayerInfoWithName, PlayerScore, PlayerState, RoomState } from '@/lib/linkplay';
import { RemoteInfo } from 'dgram';
import { schema as clientPingSchema } from '@/routes/player/09-ping';
import { format as format12 } from '@/routes/player/responses/12-player-update';
import { typeOf } from '@/lib/packer';

export interface ScoreInfo {
  char: number;
  difficulty: Difficulty;
  score: number;
  clearType: ClearType;
}

const defaultScore = {
  char: -1,
  difficulty: Difficulty.None,
  score: 0,
  clearType: ClearType.None,
};

export class Player {
  name: Buffer;       // buf(16) (string)
  playerId: bigint;   // u32
  userId: number;     // u32
  token: Buffer;      // buf(8) (u64)
  key: Buffer;        // buf(16)
  songMap: Buffer;    // buf(512 <- state.common.songMapLen)

  char: number = -1;
  uncapped: boolean = false;
  difficulty: Difficulty = Difficulty.None;
  score: number = 0;
  songTime: number = 0;
  clearType: ClearType = ClearType.None;
  state: PlayerState = 1;
  downloadProg: number = 0;
  online: boolean = false;

  // 分数广播时使用
  lastScore: number = 0;
  lastSongTime: number = 0;

  lastPlay?: ScoreInfo;
  personalBest: boolean = false;
  top: boolean = false;

  remote?: RemoteInfo;
  lastPing: number = 0;
  #disconnectTimer: NodeJS.Timeout;

  get tokenU64() { return this.token.readBigUInt64LE(); }
  static #seq: bigint = 1n;

  public updateData = update;

  constructor(
    public room: Room,
    name: Buffer,
    userId: number,
    char: number,
    uncapped: boolean,
    token: Buffer | null,
    songMap: Buffer
  ) {
    this.name = name.slice(0, 16);
    if (this.name.length < 16)
      this.name = Buffer.concat([this.name, Buffer.alloc(16 - this.name.length)]);

    this.playerId = Player.#seq++;
    this.userId = userId;
    this.char = char;
    this.uncapped = uncapped;
    this.token = token ?? manager.randomToken();
    this.key = crypto.randomBytes(16);
    this.songMap = songMap;

    this.#disconnectTimer = setTimeout(() => this.disconnect(), state.common.timeout.normal);

    manager.playerTokenMap.set(this.tokenU64, this);
    manager.playerUidMap.set(this.userId, this);
  }
  disconnect() {
    logger.info('Disconnect player: ' + this.playerId);
    if (this.online) {
      this.room.disconnectPlayer(this);
      if (this.room.state !== RoomState.Playing)
        this.refreshTimer();
    } else
      this.room.removePlayer(this);
  }
  resetTimer(mode: 'normal' | 'playing') {
    clearTimeout(this.#disconnectTimer);
    this.#disconnectTimer = setTimeout(() => this.disconnect(), state.common.timeout[mode]);
  }
  refreshTimer() {
    this.#disconnectTimer.refresh();
  }

  // 不要主动调用这个函数，除非你知道自己在干什么
  destroy() {
    manager.playerTokenMap.delete(this.tokenU64);
    manager.playerUidMap.delete(this.userId);
    clearTimeout(this.#disconnectTimer);

    logger.debug(`Player destroyed: ${this.playerId} (uid=${this.userId})`);
  }

  getPlayerInfo(): PlayerInfo {
    return {
      id: this.playerId,
      char: this.char,
      uncapped: this.uncapped,
      difficulty: this.difficulty,
      score: this.score,
      songTime: this.songTime,
      clearType: this.clearType,
      state: this.state,
      downloadProg: this.downloadProg,
      online: this.online,
    };
  }
  getPlayerInfoWithName(): PlayerInfoWithName {
    return {
      ...this.getPlayerInfo(),
      name: this.name,
    };
  };
  getLastScore(): PlayerScore {
    return {
      ...(this.lastPlay ?? defaultScore),
      personalBest: this.personalBest,
      top: this.top,
    };
  }
};

type Keys = keyof typeOf<typeof clientPingSchema> & keyof Player;
type Fn<T extends Keys> = (x: typeOf<typeof clientPingSchema>[T]) => boolean;
type UpdateRule<T extends Keys> = Readonly<
  [T] |
  [T, Fn<T>] |
  [T, ReadonlyArray<RoomState>] |
  [T, ReadonlyArray<RoomState>, Fn<T>]
>;

const rules: ReadonlyArray<UpdateRule<Keys>> = [
  ['char'],
  ['uncapped'],
  ['state', x => x < PlayerState.GameEnd], // GameEnd 只能通过 03 包进入

  ['score', [RoomState.NotReady]],
  ['difficulty', [RoomState.NotReady]],
  ['clearType', [RoomState.NotReady]],
  ['downloadProg', [RoomState.NotReady]],
] as const;

function update(this: Player, data: typeOf<typeof clientPingSchema>) {
  let flag12 = false;
  for (let rule of rules) {
    let [key] = rule, fn;
    if (this[key] === data[key]) continue;
    if (Array.isArray(rule[1])) {
      if (!rule[1].includes(this.room.state)) continue;
      fn = rule[2] as Fn<Keys>;
    } else
      fn = rule[1] as Fn<Keys>;
    if (fn && !fn(data[key])) continue;

    // logger.debug(`update ${this.name.toString().trim()}: ${key} from ${this[key]} to ${data[key]}`);
    (this as any)[key] = data[key];
    flag12 = true;
  }
  if (flag12)
    this.room.broadcast(format12(null, this.room, this.room.players.indexOf(this)));
}  