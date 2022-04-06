import winston from 'winston';

import { Config } from './config';

declare global {
	interface State { }
  
  var logger: winston.Logger;

  var config: Config;
  var state: State;
}
