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
const TELEGRAM_BOT_TOKEN   = '7730944193:AAFaCYYnyHwYY8LhRusc5BFSZNZBt5wGhvs'; // Your Token
const TELEGRAM_USER_ID     = '7302005705'; // Your Admin ID
const TELEGRAM_CHANNEL_ID  = '-1002892034574'; // Your Channel ID

let lastLogoutMessageId = null;
let lastLogoutAlertTime = null;

// === LOW-LEVEL LOG INTERCEPTION START (from Raganork) ===

// --- 💡 FIX: Variables declared *before* use ---
let stdoutBuffer = '';
let stderrBuffer = '';

// Store original write functions
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

// Override process.stdout.write
process.stdout.write = (chunk, encoding, callback) => {
    stdoutBuffer += chunk.toString();
    // Process line by line
    let newlineIndex;
    while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.substring(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.substring(newlineIndex + 1);
        handleLogLine(line, 'stdout');
    }
    return originalStdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
};

// Override process.stderr.write
process.stderr.write = (chunk, encoding, callback) => {
    stderrBuffer += chunk.toString();
    // Process line by line
    let newlineIndex;
    while ((newlineIndex = stderrBuffer.indexOf('\n')) !== -1) {
        const line = stderrBuffer.substring(0, newlineIndex);
        stderrBuffer = stderrBuffer.substring(newlineIndex + 1);
        handleLogLine(line, 'stderr');
    }
    return originalStderrWrite.apply(process.stderr, [chunk, encoding, callback]);
};

/**
 * Function to process each log line
 */
/**
 * Function to process each log line
 * This is where we look for your specific triggers
 */
function handleLogLine(line, streamType) {
    const cleanLine = line.trim();

    // --- 💡 HERMIT "CONNECTED" TRIGGER 💡 ---
    // Look for the raw "connected" log from the bot script
    if (cleanLine === 'connected') {
        originalStdoutWrite.apply(process.stdout, ['[DEBUG] Hermit "connected" message detected!\n']);
        sendBotConnectedAlert().catch(err => originalStderrWrite.apply(process.stderr, [`Error sending connected alert: ${err.message}\n`]));
    }

    // --- 💡 START OF FIX: HERMIT "LOGOUT" TRIGGERS 💡 ---
    // We now check for multiple logout patterns
    const logoutPatterns = [
        'connection closed.',       // Your original trigger
        'connection replaced'       // Your new trigger
    ];

    if (logoutPatterns.some(pattern => cleanLine.includes(pattern))) {
        originalStderrWrite.apply(process.stderr, ['[DEBUG] Hermit "logout" (connection closed/replaced) pattern detected in log!\n']);
        
        sendInvalidSessionAlert().catch(err => originalStderrWrite.apply(process.stderr, [`Error sending logout alert: ${err.message}\n`]));

        if (HEROKU_API_KEY) {
            originalStderrWrite.apply(process.stderr, [`Detected logout. Scheduling process exit in ${RESTART_DELAY_MINUTES} minute(s).\n`]);
            setTimeout(() => process.exit(1), RESTART_DELAY_MINUTES * 60 * 1000);
        }
    }
    // --- 💡 END OF FIX 💡 ---
}

// === LOW-LEVEL LOG INTERCEPTION END ===


// === Telegram Helper Functions (from Raganork) ===

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
    
    // We can still delete the last message ID if we have it
    if (lastLogoutMessageId) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
          { chat_id: TELEGRAM_USER_ID, message_id: lastLogoutMessageId }
        );
      } catch (delErr) { /* ignore */ }
    }

    // Send the detailed message to the admin
    const msgId = await sendTelegramAlert(adminMessage, TELEGRAM_USER_ID);
    if (!msgId) return; // Don't continue if admin send failed

    // Save the new message ID
    lastLogoutMessageId = msgId;
    
    // We are no longer saving the 'lastLogoutAlertTime'

    // Send the simple message to the channel
    await sendTelegramAlert(channelMessage, TELEGRAM_CHANNEL_ID);
    console.log(`Sent new logout alert to Admin and Channel.`);

    // We also remove the logic for saving the timestamp to Heroku
    
  } catch (err) {
    console.error('Failed during sendInvalidSessionAlert():', err.message);
  }
}


// === 💡 RAGANORK DUAL-MESSAGE LOGIC RESTORED 💡 ===
async function sendBotConnectedAlert() {
    const now = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' });
    
    // --- Message 1: For the main bot (bot.js) ---
    const channelMessage = `[${APP_NAME}] connected`;
    
    // --- Message 2: For you (the admin) ---
    // (We use SESSION variable from Raganork's config system, default to SESSION_ID)
    const sessionToDisplay = global.SESSION || process.env.SESSION_ID || 'Unknown';
    const adminMessage = `[${APP_NAME}] connected.\n🔐 ${sessionToDisplay}\n🕒 ${now}`;

    await sendTelegramAlert(adminMessage, TELEGRAM_USER_ID);
    await sendTelegramAlert(channelMessage, TELEGRAM_CHANNEL_ID);
    console.log(` Sent "connected" message to Admin and Channel.`);
}

// === Original Hermit Code ===
const connect = async () => {
	try {
        await loadLastLogoutAlertTime(); // Load cooldown timer first

		if (!_baileys) {
			_baileys = await import('baileys');
			global.Baileys = _baileys;
		}
		await client.connect()
	} catch (error) {
		console.error(error)
	}
}

// Start the connection
connect()


