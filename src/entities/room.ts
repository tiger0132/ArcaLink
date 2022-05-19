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
  players: (Player | null)[] = [null, null, null, null];
  playerCnt: number = 0;
  songMap: Buffer;

  counter: number = 0;

  songIdxWithDiff: number = -1;
  lastSong: number = -1;
  roundRobin: boolean = false;

  #commandQueue: Buffer[] = [];
  #totalQueueSize: number = 0;

  get idU64() { return this.id.readBigUInt64LE(); }

  state: RoomState = RoomState.Locked;
  setState(state: RoomState, nonce?: bigint) { // 修改并广播 13 包
    if (this.state === state) return;
    this.state = state;
    this.broadcast(format13(nonce ?? null, this));
  }
  setRoundRobin(roundRobin: boolean, nonce?: bigint) { // 其实只有那一个地方会设置 roundrobin，纯粹就是为了统一
    this.roundRobin = roundRobin;
    this.broadcast(format13(nonce ?? null, this));
  }

  #host: Player | null = null;
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

  #countdownStart: number | null = null;
  countdown: number = -1;
  updateCountdown() {
    if (this.#countdownStart) {
      let d = Date.now() - this.#countdownStart;
      // logger.info(`countdown from ${this.countdown} to ${this.countdown - d}`);
      this.countdown -= d;
      this.#countdownStart += d;
    }
  }

  constructor() {
    this.id = manager.randomID();
    this.code = manager.randomCode();
    this.songMap = Buffer.alloc(state.common.songMapLen);

    manager.roomCodeMap.set(this.code, this);
    manager.roomIdMap.set(this.idU64, this);
  }
  updateSongMap(nonce?: bigint, force?: true) {
    let oldSongMap = Buffer.from(this.songMap);
    this.songMap.fill(0xFF);
    this.players.forEach(p => {
      if (!p) return;
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
    return this.players.every(p => !p || p.online);
  }
  isReady(state: PlayerState, canOffline: boolean = false) { // 是否所有玩家都在特定 state
    return this.players.every(p => !p || (!p.online && canOffline) || (p.online && p.state === state));
  }
  updateState() {
    if (this.state === RoomState.Locked && this.isReady(PlayerState.Idle))      // 1 -> 2
      return this.setState(RoomState.Idle);
    if (this.state === RoomState.Idle && !this.isReady(PlayerState.Idle))       // 2 -> 1
      return this.setState(RoomState.Locked);
    if (this.state === RoomState.NotReady && this.isReady(PlayerState.Ready)) { // 3 -> 4
      this.countdown = state.common.countdown.ready;
      this.setState(RoomState.Countdown);
      this.#countdownStart = Date.now();
      return;
    }

    this.updateCountdown();
    if (RoomState.Countdown <= this.state && this.state <= RoomState.Skill) { // state 4, 5, 6 handling
      if (this.state === RoomState.Skill && this.countdown < 0) { // 6 -> 7
        for (let p of this.players)
          if (p) p.resetTimer('playing');
        this.countdown = -1;
        this.#countdownStart = null;
        this.setState(RoomState.Playing);
      }
      if (this.state === RoomState.Countdown && this.countdown < 0) { // 4 -> 5
        this.clearPrepareInfo();
        this.broadcast(format11(null, this));

        this.countdown += state.common.countdown.sync;
        this.setState(RoomState.Syncing);
      }
      if (this.state === RoomState.Syncing && (this.countdown < 0 || this.isReady(PlayerState.Synced))) { // 5 -> 6
        this.countdown += state.common.countdown.skill;
        this.setState(RoomState.Skill);
      }
      return;
    }

    if (this.state === RoomState.Playing && this.isReady(PlayerState.GameEnd, true)) // 7 -> 8
      return this.makeFinish();
    if (this.state === RoomState.GameEnd && this.isReady(PlayerState.Idle, true)) { // 8 -> 1
      this.songIdxWithDiff = -1;
      this.clearPrepareInfo();
      if (this.roundRobin) {
        let idx = this.players.indexOf(this.#host);
        while (!this.players[idx = (idx + 1) % 4]);
        this.host = this.players[idx]!;
      }
      return this.setState(RoomState.Locked);
    }
  }
  makeFinish() { // 结算
    for (let p of this.players)
      if (!p) { }
      else if (p.online)
        p.resetTimer('normal');
      else
        this.removePlayer(p);

    this.lastSong = this.songIdxWithDiff;

    let topScore = -Infinity;
    for (let p of this.players) {
      if (!p) continue;
      p.lastPlay = {
        difficulty: p.difficulty,
        score: p.score,
        char: p.char,
        clearType: p.clearType,
      };
      p.top = false;
      topScore = Math.max(topScore, p.score);
    }
    for (let p of this.players)
      if (p && p.score === topScore) p.top = true;

    this.setState(RoomState.GameEnd); // 20s
  }

  // 玩家操作
  addPlayer(player: Player) {
    let idx = this.players.indexOf(null);
    if (idx < 0) throw new Error('room is full');
    this.players[idx] = player;
    this.playerCnt++;
  }
  disconnectPlayer(player: Player) {
    let idx = this.players.indexOf(player);
    if (idx === -1) throw new Error('player not found');

    player.online = false;
    this.broadcast(format12(null, this, idx));

    if (player === this.host) {
      let host = this.players.find(p => p && p.online);
      if (host) this.setHost(host);
    }
    this.updateState();
  }
  removePlayer(player: Player) {
    let idx = this.players.indexOf(player);
    if (idx === -1) throw new Error('player not found');

    if (this.state === RoomState.NotReady) { // 在准备界面时的退出流程
      // 鲨人，尸体清走
      player.destroy();
      this.players[idx] = null;
      this.playerCnt--;
      if (!this.playerCnt) return this.destroy();

      // 给被鲨的人发个 11 包
      let pack11 = format11(null, this);
      manager.udpServer.send(pack11, player);

      // 更新房主，但是不发 10 包
      if (player === this.host)
        this.#host =
          this.players.find(p => p && p.online) ??
          this.players.find(p => p) ??
          this.players[0];

      // 进入一般退出准备界面流程
      this.leavePrepareState(null, pack11);
      return;
    }

    // 鲨人，广播 12 包
    player.destroy();
    this.broadcast(format12(null, this, idx, defaultPlayer));

    // 尸体清走
    this.players[idx] = null;
    this.playerCnt--;
    if (!this.playerCnt) return this.destroy();

    // 更新 songMap，广播 14 包
    this.updateSongMap();

    // 更新房主
    if (player === this.host) {
      this.#host =
        this.players.find(p => p && p.online) ??
        this.players.find(p => p) ??
        this.players[0];
      if (this.state >= RoomState.Countdown) // 这是官服的行为……挺奇怪的
        this.broadcast(format13(null, this));
      else
        this.broadcast(format10(null, this));
    }
    this.updateState();
  }
  clearPrepareInfo() {
    for (let p of this.players) {
      if (!p) continue;
      p.score = 0;
      p.clearType = ClearType.None;
      p.downloadProg = -1;
      // player.difficulty = Difficulty.None; // 理论上应该有这样一个行为，但是 616 没有

      p.lastScore = p.lastSongTime = 0;
    }
  }
  leavePrepareState(nonce: bigint | null, _pack11?: Buffer) { // 从准备界面回到选曲界面
    this.clearPrepareInfo();
    this.state = RoomState.Locked;
    this.songIdxWithDiff = -1;

    this.broadcast(_pack11 ?? format11(nonce, this), format13(nonce, this));
  }
  destroy() {
    manager.roomCodeMap.delete(this.code);
    manager.roomIdMap.delete(this.idU64);

    this.players.forEach(p => p && p.destroy());
    this.players = [];

    logger.info('Room destroyed: ' + this.code);
  }

  // 发包补包相关
  broadcast(...packs: (Buffer | undefined)[]) {
    for (let pack of packs)
      if (pack)
        for (let p of this.players)
          if (p && p.online)
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

  // 房间信息相关
  getPlayersInfoWithName() {
    return this.players.map(p => p ? p.getPlayerInfoWithName() : defaultPlayerWithName) as Tuple<PlayerInfoWithName, 4>;
  }
  getLastScores() {
    return this.players.map(p => p ? p.getLastScore() : defaultScore) as Tuple<PlayerScore, 4>;
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