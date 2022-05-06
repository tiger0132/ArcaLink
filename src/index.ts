import './config';
import './logger';
import './state';

const { LinkPlayManager } = await import('./entities/manager');
const adminServer = (await import('./routes/admin')).default;
const playerServer = (await import('./routes/player')).default;

const manager = new LinkPlayManager(playerServer);
global['manager'] = manager;

adminServer.listen(config.server.adminPort);
playerServer.listen(config.server.playerPort);