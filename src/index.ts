import './config';
import './logger';
import './state';
import { LinkPlayManager } from './entities/manager';
import adminServer from './routes/admin';
import playerServer from './routes/player';

const manager = new LinkPlayManager();
global['manager'] = manager;

adminServer.listen(config.server.adminPort);
playerServer.listen(config.server.playerPort);