import { z } from 'zod';

export const name = 'common';
export const key = 'common';
export const schema = z.object({
  pingInterval: z.number().default(1000), // 返回 0c 包的限速

  countdown: z.number().default(3999), // 启动曲目的倒计时
  playerTimeout: z.number().default(60e3), // 玩家多少 ms 没有 ping 就自动断连
  songMapLen: z.number().default(512), // orderedAllowedSongs 长度
  packResendSizeLimit: z.number().default(800), // 在包长度总和不超过该值时，补全所有包

  debugLevel: z.enum(['less', 'full']).default('full'), // stringify 时的输出量

  // 不处理 songMap 中为 false 的难度
  // arc 本体有一个行为：如果选定的难度在 songMap 中为 false，但是本地可玩，那么会发一个推荐
  // 这会导致在没有这首曲目的客户端闪退
  ignoreLockedIdx: z.boolean().default(false),
});

declare global {
  interface State {
    common: z.infer<typeof schema>,
  }
}