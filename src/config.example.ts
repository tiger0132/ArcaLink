import path from 'path';

export interface Config {
  data: {
    log: {
      common: string;
    };
    store: string;
  };
};

const config: Config = {
  data: {
    log: {
      common: path.resolve('./logs/common'),
    },
    store: path.resolve('./data/state'),
  },
};

global.config = config;
