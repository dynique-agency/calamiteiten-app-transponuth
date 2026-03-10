'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const LOG_MAP = path.join(__dirname, '../../../../logs');

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, stack }) =>
          stack
            ? `${timestamp} [${level}]: ${message}\n${stack}`
            : `${timestamp} [${level}]: ${message}`
        )
      ),
    }),
    new transports.File({
      filename: path.join(LOG_MAP, 'fout.log'),
      level:    'error',
    }),
    new transports.File({
      filename: path.join(LOG_MAP, 'applicatie.log'),
    }),
  ],
});

module.exports = logger;
