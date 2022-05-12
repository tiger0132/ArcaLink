import { Player } from './player';
import { getDiffPair, getEncryptedSize, hrtime } from '@/lib/utils';
import { ClearType, defaultPlayer, defaultPlayerWithName, defaultScore, PlayerInfoWithName, PlayerScore, PlayerState, RoomInfo, roomInfoSchema, RoomInfoWithHost, RoomState } from '@/lib/linkplay';
import { p, Tuple, typeOf } from '@/lib/packer';
import { format as format15 } from '@/routes/player/responses/15-full-roominfo';
import { format as format12 } from '@/routes/player/responses/12-player-update';
import { format as format10 } from '@/routes/player/responses/10-host-change';
import { format as format14 } from '@/routes/player/responses/14-songmap-update';
import { format as format13 } from '@/routes/player/responses/13-part-roominfo';
import { format as format11 } from '@/routes/player/responses/11-players-info';

export class Room {
  id: Buffer;
  code: string;
  players: Player[];
  songMap: Buffer;

  state: RoomState = RoomState.Locked;
  counter: number = 0;
  countdown: number = -1;
  #host: Player | null = null;

  songIdxWithDiff: number = -1;
  lastSong: number = -1;
  roundRobin: boolean = false;

  #commandQueue: Buffer[] = [];
  #totalQueueSize: number = 0;

  get idU64() { return this.id.readBigUInt64LE(); }

  setState(state: RoomState, nonce?: bigint) { // 修改并广播 13 包
    if (this.state === state) return;
    this.state = state;
    this.broadcast(format13(nonce ?? null, this));
  }
  setRoundRobin(roundRobin: boolean, nonce?: bigint) { // 其实只有那一个地方会设置 roundrobin，纯粹就是为了统一
    this.roundRobin = roundRobin;
    this.broadcast(format13(nonce ?? null, this));
  }

  get host() {
    if (!this.#host) throw new Error('room.host is null');
    return this.#host;
  }
  set host(player: Player) { this.#host = player; }
  setHost(player: Player, nonce?: bigint, force?: true) { // 修改并广播 10 包
    if (!force && this.#host === player) return;
    this.#host = player;
    this.broadcast(format10(nonce ?? null, this));
  }

  constructor() {
    this.id = manager.randomID();
    this.code = manager.randomCode();
    this.players = [];
    this.songMap = Buffer.alloc(state.common.songMapLen);

    manager.roomCodeMap.set(this.code, this);
    manager.roomIdMap.set(this.idU64, this);
  }
  updateSongMap(nonce?: bigint, force?: true) {
    let oldSongMap = Buffer.from(this.songMap);
    this.songMap.fill(0xFF);
    this.players.forEach(p => {
      for (let i = 0; i < state.common.songMapLen; i++)
        this.songMap[i] &= p.songMap[i];
    });
    if (force || !oldSongMap.equals(this.songMap))
      this.broadcast(format14(nonce ?? null, this));
  }
  canPlayDiff(songIdxWithDiff: number) {
    if (songIdxWithDiff < 0 || songIdxWithDiff >= state.common.songMapLen * 8)
      return 'invalid';
    let i = songIdxWithDiff >> 3, j = songIdxWithDiff & 7;
    return (this.songMap[i] >> j) & 1 ? 'ok' : 'locked';
  }
  canPlaySong(songIdx: number) {
    if (songIdx < 0 || songIdx >= state.common.songMapLen * 2)
      return 'invalid';
    let i = songIdx >> 1, j = songIdx & 1;
    return (this.songMap[i] >> (j * 4)) & 0xF ? 'ok' : 'locked';
  }
  isAllOnline() {
    return this.players.every(p => p.online);
  }
  isReady(state: PlayerState) {
    return this.players.every(p => p.online && p.state === state);
  }
  updateState() {
    let state = getNewState.call(this);
    if (state) this.setState(state);
  }

  disconnectPlayer(player: Player) {
    let idx = this.players.indexOf(player);
    if (idx === -1) throw new Error('player not found');

    player.online = false;
    this.broadcast(format12(null, this, idx));

    if (player === this.host) {
      let host = this.players.find(p => p.online);
      if (host) this.setHost(host);
    }
    this.updateState();
  }
  removePlayer(player: Player) {
    let idx = this.players.indexOf(player);
    if (idx === -1) throw new Error('player not found');

    if (this.state === RoomState.NotReady || this.state === RoomState.Countdown) { // 在准备界面时的退出流程
      // 鲨人，尸体清走
      player.destroy();
      this.players.splice(idx, 1);
      if (!this.players.length) return this.destroy(); // 并不应该出现，但是还是加上吧

      // 给被鲨的人发个 11 包
      let pack11 = format11(null, this);
      manager.udpServer.send(pack11, player);

      // 更新房主，但是不发 10 包
      if (player === this.host)
        this.#host = this.players.find(p => p.online) ?? this.players[0];

      // 进入一般退出准备界面流程
      this.leavePrepareState(null, pack11);
      return;
    }

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
      this.setHost(this.players.find(p => p.online) ?? this.players[0]);
    this.updateState();
  }
  leavePrepareState(nonce: bigint | null, _pack11?: Buffer) { // 从准备界面回到选曲界面
    for (let player of this.players) {
      player.score = 0;
      player.clearType = ClearType.None;
      player.downloadProg = -1;
      // player.difficulty = Difficulty.None; // 理论上应该有这样一个行为，但是 616 没有
    }
    this.state = RoomState.Locked;
    this.songIdxWithDiff = -1;

    this.broadcast(_pack11 ?? format11(nonce, this), format13(nonce, this));
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
      songIdxWithDiff: this.songIdxWithDiff,
      'interval?': 1000, // from 616
      'times?': Buffer.from('\x64\x00\x00\x00\x00\x00\x00'), // from 616

      lastScores: this.getLastScores(),
      lastSong: this.lastSong,
      roundRobin: this.roundRobin,
    };
  }
  getRoomInfoWithHost(): RoomInfoWithHost {
    return {
      host: this.host.playerId,
      ...this.getRoomInfo(),
    };
  }
};

// 转移到新状态
type Rule =
  { if: PlayerState, then: RoomState } |
  { ifNot: PlayerState, then: RoomState }
  ;
const rulesMap: Partial<Record<RoomState, Rule[]>> = {
  [RoomState.Locked]: [
    { if: PlayerState.Idle, then: RoomState.Idle }
  ],
  [RoomState.Idle]: [
    { ifNot: PlayerState.Idle, then: RoomState.Locked }
  ],
  [RoomState.NotReady]: [
    { if: PlayerState.Ready, then: RoomState.Countdown }
  ],
};
function getNewState(this: Room) {
  let rules = rulesMap[this.state];
  if (!rules) return null;

  for (let rule of rules) {
    if ('if' in rule && this.isReady(rule.if))
      return rule.then;
    if ('ifNot' in rule && !this.isReady(rule.ifNot))
      return rule.then;
  }
  return null;
}