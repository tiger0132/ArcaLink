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
  songMap: z.string().length(state.common.songMapLen * 2),
});
router.post('/multiplayer/room/create', async ctx => {
  let parsed = await schema.safeParseAsync(ctx.request.body);
  if (!parsed.success) throw parsed.error.toString();

  let { key, name, userId, char, songMap: _songMap } = parsed.data;
  if (key !== config.server.key) throw 'invalid key';

  let songMap = Buffer.from(_songMap, 'hex');
  if (songMap.length !== state.common.songMapLen) throw 'invalid song map';

  let room = new Room();

  // 官服行为，但是其实 key 想是啥就是啥
  // let player = new Player(room, Buffer.from(name), userId, char, room.id, songMap);

  let player = new Player(room, Buffer.from(name), userId, char, null, songMap);
  room.players = [player];
  room.host = player;
  room.updateSongMap();

  // 根据官服在 counter = 0 时直接补 15 包的行为，推测 counter = 1 的包也是 15（因为足够大）
  // 所以无论如何它不会被发送，于是直接排除在队列之外
  room.counter++;
  room.counter++; room.pushPack(format11(null, room)); // counter = 2
  room.counter++; room.pushPack(format13(null, room)); // counter = 3
  room.counter++; room.pushPack(format14(null, room)); // counter = 4

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
