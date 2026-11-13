const { Sequelize } = require('sequelize');
const fs = require('fs');

// Load local development values only when they are not already supplied by
// Heroku or another hosting provider. Hosted environment variables must win.
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

const convertToBool = (text, fault = 'true') => text === fault;
const toBool = (x) => (x && x.toLowerCase() === 'true') || false;

function createDisabledDatabase() {
  const noRows = async () => [];
  const noRow = async () => null;
  const makeInstance = (values = {}) => ({
    ...values,
    dataValues: values,
    get: (key) => key ? values[key] : values,
    toJSON: () => values,
    update: async (updates = {}) => makeInstance({ ...values, ...updates }),
    save: async () => makeInstance(values),
    destroy: async () => {},
  });
  const sequelize = {
    models: {},
    define(name, attributes = {}) {
      const model = {
        name,
        modelName: name,
        rawAttributes: attributes,
        sequelize,
        associations: {},
        findAll: noRows,
        findOne: noRow,
        findByPk: noRow,
        findOrCreate: async (options = {}) => [makeInstance(options.defaults || {}), false],
        findCreateFind: async (options = {}) => makeInstance(options.defaults || {}),
        create: async (values = {}) => makeInstance(values),
        build: (values = {}) => makeInstance(values),
        bulkCreate: async () => [],
        update: async () => [0],
        destroy: async () => 0,
        count: async () => 0,
        upsert: async (values = {}) => [makeInstance(values), false],
        sync: async () => model,
        drop: async () => {},
        truncate: async () => 0,
        belongsTo: () => ({}),
        belongsToMany: () => ({}),
        hasMany: () => ({}),
        hasOne: () => ({}),
      };
      this.models[name] = model;
      return model;
    },
    model(name) { return this.models[name]; },
    authenticate: async () => {},
    sync: async () => sequelize,
    query: async () => [[], {}],
    transaction: async (options, callback) => {
      const transaction = { commit: async () => {}, rollback: async () => {} };
      const fn = typeof options === 'function' ? options : callback;
      return typeof fn === 'function' ? fn(transaction) : transaction;
    },
    close: async () => {},
    getQueryInterface: () => new Proxy({}, { get: () => async () => [] }),
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
