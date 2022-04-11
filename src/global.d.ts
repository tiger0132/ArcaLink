import winston from 'winston';

import { Config } from './config';
import { LinkPlayManager } from './entities/manager';

declare global {
	interface State { }
  
  var logger: winston.Logger;
  var adminLogger: winston.Logger;

  var config: Config;
  var state: State;
  var manager: LinkPlayManager;
}
