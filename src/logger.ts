import process from 'process';
import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

let logLevel = process.env.LOG_LEVEL || 'verbose';
function createLogger(logPath: string, rotate: boolean = true) {
  let maxLength = Math.max(...Object.keys(winston.config.npm.levels).map(x => x.length)) + 2 + 10 /* color code */;
  let logger = winston.createLogger({
    transports: [new winston.transports.Console({
      level: logLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.splat(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(info => `${info.level}:`.padEnd(maxLength, ' ') + `${info.message} [${info.timestamp}]`)
      )
    })]
  });

  if (process.env['NODE_ENV'] === 'production') {
    if (rotate) {
      logger.add(new winston.transports.DailyRotateFile({
        filename: path.join(logPath, '%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: logLevel,
        createSymlink: true,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.json()
        )
      }));

      logger.add(new winston.transports.File({
        filename: path.join(logPath, 'error.log'),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.json()
        )
      }));
    } else {
      logger.add(new winston.transports.File({
        filename: path.join(logPath, 'full.log'),
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.json()
        )
      }));
    }
  }

  return logger;
}

global['logger'] = createLogger(config.data.log.common);
global['adminLogger'] = createLogger(config.data.log.admin);
