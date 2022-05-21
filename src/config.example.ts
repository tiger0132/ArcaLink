import path from 'path';

export interface Config {
  data: {
    log: {
      common: string;
      admin: string;
    };
  };
  server: {
    playerPort: number;
    adminPort: number;
    key: string;

    pingInterval: number;
    packResendSizeLimit: number;
    songMapLen: number;

    allowDifferentVersion: boolean;
  };
  gameplay: {
    countdown: {
      ready: number;
      sync: number;
      skill: number;
    };
    timeout: {
      normal: number;
      playing: number;
    };
  };
  debugLevel: 'less' | 'full';
};

const config: Config = {
  data: {
    log: {
      common: path.resolve('./logs/common'),
      admin: path.resolve('./logs/admin'),
    },
  },
  server: {
    playerPort: 8081,
    adminPort: 8082,
    key: '', // 请求 admin api 时用于验证的 key；请随机生成一个

    pingInterval: 1000, // 返回 0c 包的限速
    packResendSizeLimit: 800, // 在包长度总和不超过该值时，补全所有包
    songMapLen: 512, // orderedAllowedSongs 长度

    allowDifferentVersion: true, // 允许不同版本的客户端；如 3.12.6 版本的 protocolVersion 为 09，而这里实现的版本是 0b
  },
  gameplay: {
    countdown: {
      ready: 3999, // 启动曲目的倒计时
      sync: 9999, // 同步的倒计时
      skill: 2999, // 技能显示的倒计时
    },
    timeout: {
      normal: 60e3, // 正常情况的超时时间
      playing: 15e3, // 游戏中的超时时间
    },
  },
  debugLevel: 'less', // stringify 时显示的内容多少；没什么用（
};

global.config = config;
