import { Player } from './player';
import { buf2U64String } from '@/lib/utils';

export class Room {
  id: Buffer; // buf(8) (u64)
  code: string; // str(6)
  players: Player[];
  songMap: Buffer; // buf(512 <- state.common.songMapLen)

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
};