import { z } from 'zod';

export const name = 'common';
export const key = 'common';
export const schema = z.object({
  ttl: z.number().default(3600e3), // 玩家和房间的最长存活时间
  interval: z.record(z.number(), z.number()).default({}), // 命令限速
  countdown: z.number().default(3999), // 启动曲目的倒计时
  playerTimeout: z.number().default(60e3), // 玩家多少 ms 没有心跳就自动断连
  songMapLen: z.number().default(512), // orderedAllowedSongs 长度

  debugLevel: z.enum(['less', 'full']).default('full'), // stringify 时的输出量
});

declare global {
  interface State {
    common: z.infer<typeof schema>,
  }
}