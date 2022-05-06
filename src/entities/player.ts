import crypto from 'crypto';

import { Room } from './room';
import { ClearType, Difficulty, PlayerInfo, PlayerInfoWithName, PlayerScore, PlayerState } from '@/lib/linkplay';
import { RemoteInfo } from 'dgram';

export class Player {
  name: Buffer;       // buf(16) (string)
  playerId: number;   // u32
  userId: number;     // u32
  token: Buffer;      // buf(8) (u64)
  key: Buffer;        // buf(16)
  songMap: Buffer;    // buf(512 <- state.common.songMapLen)

  char: number = -1;
  uncapped: boolean = false;
  difficulty: Difficulty | -1 = -1;
  score: number = 0;
  'timer?': number = 0;
  clearType: ClearType = ClearType.None;
  state: PlayerState = 1;
  downloadProg: number = 0;
  online: boolean = false;

  personalBest: boolean = false;
  top: boolean = false;

  lastPing: bigint = 0n;
  remote?: RemoteInfo;

  get tokenU64() { return this.token.readBigUInt64LE(); }
  static #seq: number = 1;

  constructor(
    public room: Room,
    name: Buffer,
    userId: number,
    char: number,
    token: Buffer | null,
    songMap: Buffer
  ) {
    this.name = name.slice(0, 16);
    if (this.name.length < 16)
      this.name = Buffer.concat([this.name, Buffer.alloc(16 - this.name.length)]);

    this.playerId = Player.#seq++;
    this.userId = userId;
    this.char = char;
    this.token = token ?? manager.randomToken();
    this.key = crypto.randomBytes(16);
    this.songMap = songMap;

    manager.playerTokenMap.set(this.tokenU64, this);
    manager.playerUidMap.set(this.userId, this);
  }

  // 不要主动调用这个函数，除非你知道自己在干什么
  destroy() {
    manager.playerTokenMap.delete(this.tokenU64);
    manager.playerUidMap.delete(this.userId);

    logger.debug(`Player destroyed: ${this.playerId} (uid=${this.userId})`);
  }
  getPlayerInfo(): PlayerInfo {
    return {
      id: BigInt(this.playerId),
      char: this.char,
      uncapped: this.uncapped ? 1 : 0,
      difficulty: this.difficulty,
      score: this.score,
      'timer?': this['timer?'],
      clearType: this.clearType,
      state: this.state,
      downloadProg: this.downloadProg,
    };
  }
  getPlayerInfoWithName(): PlayerInfoWithName {
    return {
      ...this.getPlayerInfo(),
      online: this.online ? 1 : 0,
      name: this.name,
    };
  };
  getLastScore(): PlayerScore {
    return {
      char: this.char,
      difficulty: this.difficulty,
      score: this.score,
      clearType: this.clearType,
      persenalBest: this.personalBest ? 1 : 0,
      top: this.top ? 1 : 0,
    };
  }
};