import { defaultPlayerWithName, defaultScore, Player, PlayerInfoWithName, PlayerScore, playerScoreSchema } from './player';
import { buf2U64String, hrtime } from '@/lib/utils';
import { RoomState } from '@/lib/linkplay';
import { p, Tuple, typeOf } from '@/lib/packer';

export class Room {
  id: Buffer;
  code: string;
  players: Player[];
  songMap: Buffer;

  state: RoomState = RoomState.Locked;
  counter: number = 0;
  countdown: number = -1;
  host: Player | null = null;

  songIdx: number = -1;
  lastSong: number = -1;
  roundRobin: boolean = false;

  get idString() { return buf2U64String(this.id); }
  constructor() {
    this.id = manager.randomID();
    this.code = manager.randomCode();
    this.players = [];
    this.songMap = Buffer.alloc(state.common.songMapLen);

    manager.roomCodeMap.set(this.code, this);
    manager.roomIdMap.set(this.idString, this);
  }
  updateSongMap() {
    this.songMap.fill(0xFF);
    this.players.forEach(p => {
      for (let i = 0; i < state.common.songMapLen; i++)
        this.songMap[i] &= p.songMap[i];
    });
  }
  destroy() {
    manager.roomCodeMap.delete(this.code);
    manager.roomIdMap.delete(this.idString);

    this.players.forEach(p => p.destroy());
  }
  getPlayersInfoWithName() {
    let playersInfo = [defaultPlayerWithName, defaultPlayerWithName, defaultPlayerWithName, defaultPlayerWithName] as Tuple<PlayerInfoWithName, 4>;
    this.players.slice(0, 4).forEach((p, i) => playersInfo[i] = p.getPlayerInfoWithName());
    return playersInfo;
  }
  getLastScores() {
    let lastScores = [defaultScore, defaultScore, defaultScore, defaultScore] as Tuple<PlayerScore, 4>;
    this.players.slice(0, 4).forEach((p, i) => lastScores[i] = p.getLastScore());
    return lastScores;
  }
  getRoomInfo(): RoomInfo {
    return {
      state: this.state,
      countdown: this.countdown,
      serverTime: hrtime(),
      songIdx: this.songIdx,
      'interval?': 1000, // from 616
      'times?': Buffer.from('\x64\x00\x00\x00\x00\x00\x00\x00'), // from 616

      lastScores: this.getLastScores(),
      lastSong: this.lastSong,
      roundRobin: this.roundRobin ? 1 : 0,
    };
  }
  getRoomInfoWithHost(): RoomInfoWithHost {
    if (!this.host) throw new Error('room.host is null');
    return {
      host: BigInt(this.host.playerId),
      ...this.getRoomInfo(),
    };
  }
};

export const roomInfoSchema = p('roomInfo').struct([
  p('state').u8(),
  p('countdown').i32(),
  p('serverTime').u64(),
  p('songIdx').i16(),
  p('interval?').u16(),
  p('times?').buf(7),

  p('lastScores').array(4, playerScoreSchema),
  p('lastSong').i16(),
  p('roundRobin').u8(),
]);
export type RoomInfo = typeOf<typeof roomInfoSchema>;

export const roomInfoWithHostSchema = p('roomInfoWithHost').struct([
  p('host').u64(),
  ...roomInfoSchema.fields,
]);
export type RoomInfoWithHost = typeOf<typeof roomInfoWithHostSchema>;