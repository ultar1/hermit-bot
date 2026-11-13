const { Sequelize } = require('sequelize');
const fs = require('fs');

// Load local development values only when they are not already supplied by
// Heroku or another hosting provider. Hosted environment variables must win.
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

const convertToBool = (text, fault = 'true') => text === fault;
const toBool = (x) => (x && x.toLowerCase() === 'true') || false;

function createDisabledDatabase() {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: '127.0.0.1',
    database: 'disabled',
    username: 'disabled',
    password: 'disabled',
    logging: false,
  });
  const noRows = async () => [];
  const noRow = async () => null;
  const noWrite = async () => 0;
  const makeInstance = (values = {}) => ({
    ...values,
    dataValues: values,
    get: () => values,
    toJSON: () => values,
    update: async () => makeInstance(values),
    destroy: async () => {},
  });

  sequelize.authenticate = async () => {};
  sequelize.sync = async () => sequelize;
  sequelize.query = async () => [[], {}];
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {} });
  sequelize.close = async () => {};

  const define = sequelize.define.bind(sequelize);
  sequelize.define = (...args) => {
    const model = define(...args);
    model.findAll = noRows;
    model.findOne = noRow;
    model.findByPk = noRow;
    model.findOrCreate = async (options = {}) => [makeInstance(options.defaults || {}), false];
    model.findCreateFind = async (options = {}) => makeInstance(options.defaults || {});
    model.create = async (values = {}) => makeInstance(values);
    model.bulkCreate = async () => [];
    model.update = async () => [0];
    model.destroy = noWrite;
    model.count = async () => 0;
    model.upsert = async (values = {}) => [makeInstance(values), false];
    return model;
  };
  return sequelize;
}

const DATABASE_CONNECTION = (process.env.DATABASE_URL || '').trim();
if (!DATABASE_CONNECTION) {
  console.warn('DATABASE_URL is not set; PostgreSQL-backed features will be unavailable.');
}
const hasCaCert = !!process.env.PG_CA_CERT;

const DEBUG = convertToBool(process.env.DEBUG, 'true');

module.exports = {
  VERSION: 'v4.4.6',
  SESSION_ID: process.env.SESSION_ID || '',
  MODE: (process.env.MODE || 'private').toLowerCase(),
  HANDLERS: (process.env.PREFIX || '^[.,!]').trim(),
  SEND_READ: toBool(process.env.READ_COMMAND),
  READ_MSG: toBool(process.env.READ_MSG),
  MSG_LOG: convertToBool(process.env.LOG_MSG),
  BLOCKCHAT: process.env.BLOCK_CHAT || false,
  LANG: ('EN').toUpperCase(),
  ALWAYS_ONLINE: toBool(process.env.ALWAYS_ONLINE),
  BOT_NAME: process.env.BOT_NAME || 'ʜᴇʀᴍɪᴛ',
  AUTOMUTE_MSG: process.env.AUTOMUTE_MSG || '_Group automuted!_\n_(Change this by setting var AUTOMUTE_MSG)_',
  AUTOUNMUTE_MSG: process.env.AUTOUNMUTE_MSG || '_Group autounmuted!_\n_(Change this by setting var AUTOUNMUTE_MSG)_',
  ANTILINK_MSG: process.env.ANTILINK_MSG || '_Link Not Allowed!_\n_(Change this by setting var ANTILINK_MSG)_',
  BOT_INFO: process.env.BOT_INFO || 'ʜᴇʀᴍɪᴛ;ᴀᴅɪᴛʜyᴀɴ;972528277755;https://i.imgur.com/6oRG106.jpeg',
  AUDIO_DATA: process.env.AUDIO_DATA || 'ʜᴇʀᴍɪᴛ;ᴀᴅɪᴛʜyᴀɴ;https://i.imgur.com/fj2WE83.jpeg',
  STICKER_DATA: process.env.STICKER_DATA || 'ʜᴇʀᴍɪᴛ;ᴀᴅɪᴛʜyᴀɴ',
  ERROR_MESSAGE: toBool(process.env.ERROR_MESSAGE, 'true'),
  SONG_THUMBNAIL: toBool(process.env.SONG_THUMBNAIL),
  WARN: process.env.WARN || '4',
  REJECT_CALL: toBool(process.env.REJECT_CALL),
  KOYEB_API_KEY: process.env.KOYEB_API_KEY || false,
  KOYEB_APP_NAME: process.env.KOYEB_APP_NAME || '',
  RENDER_API: process.env.RENDER_API || false,
  RENDER_NAME: process.env.RENDER_NAME || '',
  TERMUX_VPS: toBool(process.env.TERMUX || process.env.VPS),
  AUTO_STATUS_VIEW: toBool(process.env.AUTO_STATUS_VIEW),
  APIKEY: process.env.APIKEY || 'free',
  AUTH_FILE: process.env.AUTH_FILE || false,
  START_MSG: toBool(process.env.START_MSG || 'true'),
  DATABASE_URL: DATABASE_CONNECTION,
  DATABASE: DATABASE_CONNECTION
    ? new Sequelize(DATABASE_CONNECTION, {
        dialect: "postgres",
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: hasCaCert, // 🔑 key line
            ...(hasCaCert && {
              ca: process.env.PG_CA_CERT.replace(/\\n/g, "\n"),
            }),
          },
        },
      })
    : createDisabledDatabase(),
  RBG_API_KEY: process.env.REMOVE_BG_API_KEY || false,
  BRAIN_ID: process.env.BRAIN_ID || 'bid=168613&key=EfbnX54Iy9PFIFp3',
  SUDO: process.env.SUDO || '0,0',
  DEBUG: DEBUG
};
