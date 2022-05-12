import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';

import { Player } from '@/entities/player';
import { Room } from '@/entities/room';
import { RoomState } from '@/lib/linkplay';

import { format as format11 } from '../player/responses/11-players-info';
import { format as format13 } from '../player/responses/13-part-roominfo';
import { format as format14 } from '../player/responses/14-songmap-update';
import { z } from 'zod';

const app = new Koa();
const router = new Router();

app.use(bodyParser());
app.use(async (ctx, next) => {
  try {
    logger.info(`${ctx.ip} ${ctx.method} ${ctx.url} ${JSON.stringify(ctx.request.body)}`);
    await next();
  } catch (e) {
    logger.error(e);
    if (typeof e === 'number') {
      ctx.status = 403;
      ctx.body = { success: false, error_code: e };
    } else if (typeof e === 'string') {
      ctx.status = 403;
      ctx.body = { success: false, error: e };
    } else {
      ctx.status = 500;
      ctx.body = { success: false };
    }
  }
});

const schema = z.object({
  key: z.string(),
  name: z.string(),
  userId: z.number(),
  char: z.number(),
  uncapped: z.boolean(),
  songMap: z.string().refine(x => x.length === state.common.songMapLen * 2),
});

router.post('/multiplayer/room/create', async ctx => {
  let parsed = await schema.safeParseAsync(ctx.request.body);
  if (!parsed.success) throw parsed.error.toString();

  let { key, name, userId, char, uncapped, songMap: _songMap } = parsed.data;
  if (key !== config.server.key) throw 'invalid key';

  let songMap = Buffer.from(_songMap, 'hex');
  if (songMap.length !== state.common.songMapLen) throw 'invalid song map';

  let room = new Room();

  let player = manager.playerUidMap.get(userId);
  if (player)
    player.room.removePlayer(player);

  // 官服行为，但是其实 key 想是啥就是啥
  // let player = new Player(room, Buffer.from(name), userId, char, room.id, songMap);

  player = new Player(room, Buffer.from(name), userId, char, uncapped, null, songMap);
  room.players = [player];
  room.host = player;
  room.songMap = songMap;

  // 根据官服在 counter = 0 时直接补 15 包的行为，推测 counter = 1 的包也是 15（因为足够大）
  // 所以无论如何它不会被发送，于是直接排除在队列之外
  room.counter++;
  format11(null, room); // counter = 2
  format13(null, room); // counter = 3
  format14(null, room); // counter = 4

  ctx.body = {
    success: true,
    value: {
      roomCode: room.code,
      roomId: room.id.readBigUInt64LE().toString(),
      token: player.token.readBigUInt64LE().toString(),
      key: player.key.toString('base64'),
      playerId: player.playerId.toString(),
      userId: player.userId,
      orderedAllowedSongs: room.songMap.toString('base64'),
    }
  };
});

router.post('/multiplayer/room/join/:code', async ctx => {
  let parsed = await schema.safeParseAsync(ctx.request.body);
  if (!parsed.success) throw parsed.error.toString();

  let { key, name, userId, char, uncapped, songMap: _songMap } = parsed.data;
  if (key !== config.server.key) throw 'invalid key';

  let songMap = Buffer.from(_songMap, 'hex');
  if (songMap.length !== state.common.songMapLen) throw 'invalid song map';

  let code = ctx.params.code;
  let room = manager.roomCodeMap.get(code);
  if (!room) throw 1202;
  if (room.players.length === 4) throw 1201;
  if (room.state > RoomState.Idle) throw 1205; // FIXME: 其实不知道 GameEnd state 可不可以，还没试过

  let player = manager.playerUidMap.get(userId);
  let pack11;
  if (player && player.room === room) {
    // 这是官服的行为，我觉得非常怪异，，，
    // 如果加入了自己创建的房间，那么把新的 player 替换到原来的位置，给原来的设备发一个 11 包

    let oldPlayer = player;
    let idx = room.players.indexOf(oldPlayer);
    if (idx === -1) throw 'player not found';
    oldPlayer.destroy();

    player = new Player(room, Buffer.from(name), userId, char, uncapped, null, songMap);
    room.players[idx] = player;
    manager.udpServer.send(pack11 = format11(null, room), oldPlayer);

    if (room.host === oldPlayer) {
      room.host = player; // 616 并不会在这里发 10 包，所以我们也不发

      /*
      在这种情况下，616 所有会广播的包分别是：
      - 一个 11 包，内容是更新了的 players 列表
      - 一个 13 包，内容是把 state 变成 1，host 变成替换了的新 player 的新 roominfo
      - 【一个啥都不改的 13 包】
      - 如果更新了 songMap，发一个 14 包

      不太懂为啥 616 那里会有一个冗余包，我只能猜测是 616 是手动发的 13 包，而不是在 state 更新时自动处理
      我觉得这个行为很蠢，就不抄了
      */
    }
  } else {
    if (player)
      player.room.removePlayer(player);
    player = new Player(room, Buffer.from(name), userId, char, uncapped, null, songMap);
    room.players.push(player);
  }

  room.broadcast(pack11 ?? format11(null, room)); // 发一个 11 包
  room.setState(RoomState.Locked); // 更新状态并发一个 13 包
  room.updateSongMap(); // 更新 songMap 并发一个 14 包

  ctx.body = {
    success: true,
    value: {
      roomCode: room.code,
      roomId: room.id.readBigUInt64LE().toString(),
      token: player.token.readBigUInt64LE().toString(),
      key: player.key.toString('base64'),
      playerId: player.playerId.toString(),
      userId: player.userId,
      orderedAllowedSongs: room.songMap.toString('base64'),
    }
  };
});

app
  .use(router.routes())
  .use(router.allowedMethods());

export default app;
