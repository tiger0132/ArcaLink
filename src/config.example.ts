import path from 'path';

export interface Config {
  data: {
    log: {
      common: string;
      admin: string;
    };
    store: string;
  };
  server: {
    playerPort: number;
    adminPort: number;
    key: string;
  };
};

const config: Config = {
  data: {
    log: {
      common: path.resolve('./logs/common'),
      admin: path.resolve('./logs/admin'),
    },
    store: path.resolve('./data/state'),
  },
  server: {
    playerPort: 8081,
    adminPort: 8082,
    key: '',
  },
};

global.config = config;
