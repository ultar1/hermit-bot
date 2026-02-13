// --- CRITICAL DEBUG TEST: If you see this, the code is running! ---
console.log('--- HERMIT BOT SCRIPT STARTING (index.js) ---');

// === Imports ===
const client = require('./lib/client')
const axios = require('axios');
const path = require("path"); 
const fs = require("fs"); 
let _baileys = null;

if (fs.existsSync("./config.env")) {
    require("dotenv").config({ path: "./config.env" });
}

// === CONFIGURATION ===
const APP_NAME             = process.env.APP_NAME             || 'Hermit App';
const SESSION_ID           = process.env.SESSION_ID           || 'unknown-session';
const RESTART_DELAY_MINUTES= parseInt(process.env.RESTART_DELAY_MINUTES || '360', 10);
const HEROKU_API_KEY       = process.env.HEROKU_API_KEY;

// === TELEGRAM SETUP (Hardcoded Token) ===
const TELEGRAM_BOT_TOKEN   = '7730944193:AAGgJrE7v41v9l2GLbxit46LLRYzLXRW-vI'; // Your Token
const TELEGRAM_USER_ID     = '7302005705'; // Your Admin ID
const TELEGRAM_CHANNEL_ID  = '-1003620973489'; // Your Channel ID

let lastLogoutMessageId = null;
let lastLogoutAlertTime = null;

// === LOW-LEVEL LOG INTERCEPTION START (from Raganork) ===

// --- 💡 FIX 1: Variables declared *before* use ---
let stdoutBuffer = '';
let stderrBuffer = '';

// Store original write functions
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

// --- 💡 FIX 2: Made the function 'async' ---
process.stdout.write = async (chunk, encoding, callback) => {
    stdoutBuffer += chunk.toString();
    // Process line by line
    let newlineIndex;
    while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.substring(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.substring(newlineIndex + 1);
        await handleLogLine(line, 'stdout'); // <-- 💡 Added 'await'
    }
    return originalStdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
};

// --- 💡 FIX 2: Made the function 'async' ---
process.stderr.write = async (chunk, encoding, callback) => {
    stderrBuffer += chunk.toString();
    // Process line by line
    let newlineIndex;
    while ((newlineIndex = stderrBuffer.indexOf('\n')) !== -1) {
        const line = stderrBuffer.substring(0, newlineIndex);
        stderrBuffer = stderrBuffer.substring(newlineIndex + 1);
        await handleLogLine(line, 'stderr'); // <-- 💡 Added 'await'
    }
    return originalStderrWrite.apply(process.stderr, [chunk, encoding, callback]);
};

/**
 * Function to process each log line
 * --- 💡 FIX 2: Made the function 'async' ---
 */
async function handleLogLine(line, streamType) {
    const cleanLine = line.trim();

    // 1. HERMIT "CONNECTED" TRIGGER
    if (cleanLine === 'connected') {
        originalStdoutWrite.apply(process.stdout, ['[DEBUG] Hermit "connected" message detected!\n']);
        // --- 💡 FIX 3: Added 'await' ---
        await sendBotConnectedAlert().catch(err => originalStderrWrite.apply(process.stderr, [`Error sending connected alert: ${err.message}\n`]));
    }

    // 2. HERMIT "LOGOUT" TRIGGERS
    const logoutPatterns = [
        'connection closed.',
        'connection replaced'
    ];

    if (logoutPatterns.some(pattern => cleanLine.includes(pattern))) {
        originalStderrWrite.apply(process.stderr, ['[DEBUG] Hermit "logout" (connection closed/replaced) pattern detected in log!\n']);
        
        // --- 💡 FIX 3: Added 'await' ---
        // This forces the bot to send the message *before* continuing.
        await sendInvalidSessionAlert().catch(err => originalStderrWrite.apply(process.stderr, [`Error sending logout alert: ${err.message}\n`]));

        if (HEROKU_API_KEY) {
            originalStderrWrite.apply(process.stderr, [`Detected logout. Scheduling process exit in ${RESTART_DELAY_MINUTES} minute(s).\n`]);
            setTimeout(() => process.exit(1), RESTART_DELAY_MINUTES * 60 * 1000);
        }
    }
}
// === LOW-LEVEL LOG INTERCEPTION END ===


// === Telegram Helper Functions (Copied from Raganork) ===

async function loadLastLogoutAlertTime() {
  if (!HEROKU_API_KEY) {
      console.warn('HEROKU_API_KEY is not set. Cannot load LAST_LOGOUT_ALERT from Heroku config vars.');
      return;
  }
  const url = `https://api.heroku.com/apps/${APP_NAME}/config-vars`;
  const headers = {
    Authorization: `Bearer ${HEROKU_API_KEY}`,
    Accept: 'application/vnd.heroku+json; version=3'
  };

  try {
    const res = await axios.get(url, { headers });
    const saved = res.data.LAST_LOGOUT_ALERT;
    if (saved) {
      const parsed = new Date(saved);
      if (!isNaN(parsed)) {
        lastLogoutAlertTime = parsed;
        console.log(`Loaded LAST_LOGOUT_ALERT: ${parsed.toISOString()}`);
      }
    }
  } catch (err) {
    console.error('Failed to load LAST_LOGOUT_ALERT from Heroku:', err.message);
  }
}

async function sendTelegramAlert(text, chatId) { 
    if (!TELEGRAM_BOT_TOKEN) {
        originalStderrWrite.apply(process.stderr, ['TELEGRAM_BOT_TOKEN is not set. Cannot send Telegram alerts.\n']);
        return null;
    }
    if (!chatId) {
        originalStderrWrite.apply(process.stderr, ['Telegram chatId is not provided for alert. Cannot send.\n']);
        return null;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: chatId, text };

    try {
        const res = await axios.post(url, payload);
        originalStdoutWrite.apply(process.stdout, [`Telegram message sent to chat ID ${chatId}: ${text.substring(0, 50)}...\n`]);
        return res.data.result.message_id;
    } catch (err) {
        originalStderrWrite.apply(process.stderr, [`Telegram alert failed for chat ID ${chatId}: ${err.message}\n`]);
        if (err.response) {
            originalStderrWrite.apply(process.stderr, [`   Telegram API Response: Status ${err.response.status}, Data: ${JSON.stringify(err.response.data)}\n`]);
        }
        return null;
    }
}

async function sendInvalidSessionAlert() {
  const now = new Date();
  // --- 💡 REMOVED COOLDOWN LOGIC 💡 ---
  // if (lastLogoutAlertTime && (now - lastLogoutAlertTime) < 24 * 3600e3) {
  //   console.log('Skipping logout alert — cooldown not expired.');
  //   return;
  // }

  const nowStr   = now.toLocaleString('en-GB', { timeZone: 'Africa/Lagos' });
  const hour     = now.getHours();
  const greeting = hour < 12 ? 'good morning'
                 : hour < 17 ? 'good afternoon'
                 : 'good evening';

  const restartTimeDisplay = RESTART_DELAY_MINUTES >= 60 && (RESTART_DELAY_MINUTES % 60 === 0)
    ? `${RESTART_DELAY_MINUTES / 60} hour(s)` 
    : `${RESTART_DELAY_MINUTES} minute(s)`;

  // Message 1: For the main bot (bot.js)
  const channelMessage = `User [${APP_NAME}] has logged out.`;
  
  // Message 2: For you (the admin)
  const adminMessage =
    `Hey 𝖀𝖑𝖙-𝕬𝕽, ${greeting}!\n\n` +
    `User [${APP_NAME}] has logged out.\n` +
    `[${SESSION_ID}] invalid\n` +
    `Time: ${nowStr}\n` +
    `Restarting in ${restartTimeDisplay}.`;

  try {
    if (lastLogoutMessageId) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
          { chat_id: TELEGRAM_USER_ID, message_id: lastLogoutMessageId }
        );
      } catch (delErr) { /* ignore */ }
    }

    const msgId = await sendTelegramAlert(adminMessage, TELEGRAM_USER_ID);
    if (!msgId) return; 

    lastLogoutMessageId = msgId;
    // --- 💡 REMOVED COOLDOWN LOGIC 💡 ---
    // lastLogoutAlertTime = now; 
 
    await sendTelegramAlert(channelMessage, TELEGRAM_CHANNEL_ID);
    console.log(`Sent new logout alert to Admin and Channel.`);

    // --- 💡 REMOVED COOLDOWN LOGIC 💡 ---
    // (Removed Heroku API call to save timestamp)
    
  } catch (err) {
    console.error('Failed during sendInvalidSessionAlert():', err.message);
  }
}

async function sendBotConnectedAlert() {
    const now = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' });
    
    // Message 1: For the main bot (bot.js)
    const channelMessage = `[${APP_NAME}] connected`;
    
    // Message 2: For you (the admin)
    const adminMessage = `[${APP_NAME}] connected.\n🔐 ${SESSION_ID}\n🕒 ${now}`;

    await sendTelegramAlert(adminMessage, TELEGRAM_USER_ID);
    await sendTelegramAlert(channelMessage, TELEGRAM_CHANNEL_ID);
    console.log(` Sent "connected" message to Admin and Channel.`);
}

// === Original Hermit Code ===
const connect = async () => {
	try {
        // --- 💡 REMOVED COOLDOWN LOGIC 💡 ---
        // await loadLastLogoutAlertTime(); 

		if (!_baileys) {
			_baileys = await import('baileys');
			global.Baileys = _baileys;
		}
		await client.connect()
	} catch (error) {
        // This 'console.error' is what triggers the 'connection closed' log
		console.error(error) 
	}
}

// Start the connection
connect()


