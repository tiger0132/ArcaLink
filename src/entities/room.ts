import { Player } from './player';
import { getEncryptedSize, hrtime } from '@/lib/utils';
import { defaultPlayer, defaultPlayerWithName, defaultScore, PlayerInfoWithName, PlayerScore, RoomInfo, RoomInfoWithHost, RoomState } from '@/lib/linkplay';
import { p, Tuple, typeOf } from '@/lib/packer';
import { format as format15 } from '@/routes/player/responses/15-full-roominfo';
import { format as format12 } from '@/routes/player/responses/12-player-update';
import { format as format10 } from '@/routes/player/responses/10-host-change';
import { format as format14 } from '@/routes/player/responses/14-songmap-update';
import { format as format13 } from '@/routes/player/responses/13-part-roominfo';

export class Room {
  id: Buffer;
  code: string;
  players: Player[];
  songMap: Buffer;

  #state: RoomState = RoomState.Locked;
  counter: number = 0;
  countdown: number = -1;
  #host: Player | null = null;

  songIdx: number = -1;
  lastSong: number = -1;
  roundRobin: boolean = false;

  #commandQueue: Buffer[] = [];
  #totalQueueSize: number = 0;

  get idU64() { return this.id.readBigUInt64LE(); }

  get state() { return this.#state; };
  set state(state: RoomState) {
    if (this.#state === state) return;
    this.#state = state;
    this.broadcast(format13(null, this));
  }

  get host() {
    if (!this.#host) throw new Error('room.host is null');
    return this.#host;
  }
  set host(player: Player) {
    if (this.#host === player) return;
    this.#host = player;
    this.broadcast(format10(null, this));
  }
  // 修改房主不会广播 10 包，一般请不要这么做
  _setHost(player: Player) { this.#host = player; }

  constructor() {
    this.id = manager.randomID();
    this.code = manager.randomCode();
    this.players = [];
    this.songMap = Buffer.alloc(state.common.songMapLen);

    manager.roomCodeMap.set(this.code, this);
    manager.roomIdMap.set(this.idU64, this);
  }
  updateSongMap() {
    let oldSongMap = this.songMap;
    this.songMap.fill(0xFF);
    this.players.forEach(p => {
      for (let i = 0; i < state.common.songMapLen; i++)
        this.songMap[i] &= p.songMap[i];
    });
    if (!oldSongMap.equals(this.songMap))
      this.broadcast(format14(null, this));
  }
  isAllOnline() {
    return this.players.every(p => p.online);
  }

  disconnectPlayer(player: Player) {
    let idx = this.players.indexOf(player);
    if (idx === -1) throw new Error('player not found');

    player.online = false;
    this.broadcast(format12(null, this, idx));

    if (player === this.host) {
      let host = this.players.find(p => p.online);
      if (host) this.host = host;
    }

    // FIXME: 可以预见的是，在游玩曲目时，即使有人被强退了，这个状态也不会跳回 1 / 2。到时候再处理吧，需要进行更多测试
    this.state = RoomState.Locked;
  }
  removePlayer(player: Player) {
    let idx = this.players.indexOf(player);
    if (idx === -1) throw new Error('player not found');

    // 鲨人，广播 12 包
    player.destroy();
    this.broadcast(format12(null, this, idx, defaultPlayer));

    // 尸体清走
    this.players.splice(idx, 1);
    if (!this.players.length) return this.destroy();

    // 更新 songMap，广播 14 包
    this.updateSongMap();

    // 更新房主
    if (player === this.host)
      this.host = this.players.find(p => p.online) ?? this.players[0];

    // FIXME: 可以预见的是，在游玩曲目时，即使有人被强退了，这个状态也不会跳回 1 / 2。到时候再处理吧，需要进行更多测试
    this.state = this.isAllOnline() ? RoomState.Choosing : RoomState.Locked;
  }
  destroy() {
    manager.roomCodeMap.delete(this.code);
    manager.roomIdMap.delete(this.idU64);

    this.players.forEach(p => p.destroy());
    this.players = [];

    logger.info('Room destroyed: ' + this.code);
  }

  // 发包补包相关
  broadcast(...packs: (Buffer | undefined)[]) {
    for (let pack of packs)
      if (pack)
        for (let p of this.players)
          if (p.online)
            manager.udpServer.send(pack, p);
  }
  pushPack(pack: Buffer) {
    this.#commandQueue.push(pack);
    this.#totalQueueSize += getEncryptedSize(pack.length);
    while (this.#totalQueueSize > state.common.packResendSizeLimit) {
      let pack = this.#commandQueue.shift()!;
      this.#totalQueueSize -= getEncryptedSize(pack.length);
    }
  }
  getResendPacks(counter: number) {
    let num = this.counter - counter;
    if (num > this.#commandQueue.length)
      return [format15(this)];
    else if (num <= 0)
      return []; // 怎么会事呢？
    else
      return this.#commandQueue.slice(-num);
  }

  // 获取房间信息相关
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
      'times?': Buffer.from('\x64\x00\x00\x00\x00\x00\x00'), // from 616

      lastScores: this.getLastScores(),
      lastSong: this.lastSong,
      roundRobin: this.roundRobin ? 1 : 0,
    };
  }
  getRoomInfoWithHost(): RoomInfoWithHost {
    return {
      host: BigInt(this.host.playerId),
      ...this.getRoomInfo(),
    };
  }
};