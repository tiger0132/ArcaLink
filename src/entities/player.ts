import crypto from 'crypto';

import { Room } from './room';
import { buf2U64String } from '@/lib/utils';
import { typeOf, p } from '@/lib/packer';
import { ClearType, Difficulty, PlayerState } from '@/lib/linkplay';

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

  persenalBest: boolean = false;
  top: boolean = false;

  get tokenString() { return buf2U64String(this.token); }
  static #seq: number = 0;

  constructor(
    public room: Room,
    name: Buffer,
    userId: number,
    token: Buffer | null,
    songMap: Buffer
  ) {
    this.name = name.slice(0, 16);
    if (this.name.length < 16)
      this.name = Buffer.concat([this.name, Buffer.alloc(16 - this.name.length)]);

    this.playerId = Player.#seq++;
    this.userId = userId;
    this.token = token ?? manager.randomToken();
    this.key = crypto.randomBytes(16);
    this.songMap = songMap;

    manager.playerTokenMap.set(this.tokenString, this);
  }
  destroy() {
    manager.playerTokenMap.delete(this.tokenString);
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
      online: this.online ? 1 : 1,
      name: this.name,
    };
  };
  getLastScore(): PlayerScore {
    return {
      char: this.char,
      difficulty: this.difficulty,
      score: this.score,
      clearType: this.clearType,
      persenalBest: this.persenalBest ? 1 : 0,
      top: this.top ? 1 : 0,
    };
  }
};

export const playerInfoSchema = p('playerInfo').struct([
  p('id').u64(),          // [0, 8) Player.id
  p('char').i8(),         // [8]    default -1
  p('uncapped').u8(),     // [9]
  p('difficulty').i8(),   // [10]
  p('score').u32(),       // [11, 15)
  p('timer?').u32(),      // [15, 19)
  p('clearType').u8(),    // [19]
  p('state').u8(),        // [20] getPlayerState = min(state, 4)
  p('downloadProg').u8(), // [21]
]);
export type PlayerInfo = typeOf<typeof playerInfoSchema>;
export const defaultPlayer: PlayerInfo = {
  id: 0n,
  char: -1,
  uncapped: 0,
  difficulty: -1,
  score: 0,
  'timer?': 0,
  clearType: 0,
  state: 1,
  downloadProg: 0,
} as const;

export const playerInfoWithNameSchema = p('playerInfoWithName').struct([
  ...playerInfoSchema.fields,
  p('online').u8(),  // [22]
  p().u8(0),         // [23] padding
  p('name').buf(16), // [24, 40) Player.name
]);
export type PlayerInfoWithName = typeOf<typeof playerInfoWithNameSchema>;
export const defaultPlayerWithName: PlayerInfoWithName = {
  ...defaultPlayer,
  online: 0,
  name: Buffer.from('EmptyPlayer\x00\x00\x00\x00\x00'),
} as const;

export const playerScoreSchema = p().struct([
  p('char').i8(),         // [0]
  p('difficulty').i8(),   // [1]
  p('score').u32(),       // [2, 6)
  p('clearType').u8(),    // [6]
  p('persenalBest').u8(), // [7]
  p('top').u8(),          // [8]
]);
export type PlayerScore = typeOf<typeof playerScoreSchema>;
export const defaultScore: PlayerScore = {
  char: -1,
  difficulty: -1,
  score: 0,
  clearType: 0,
  persenalBest: 0,
  top: 0,
} as const;