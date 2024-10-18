const axios = require('axios');

Function({
    pattern: 'ss ?(.*)',
    fromMe: isPublic,
    desc: 'Take a website screenshot',
    type: 'download'
}, async (message, match) => {
    match = getUrl(match || message.reply_message.text);
    if (!match) return await message.send('_Need a URL_\n*Example: ss https://example.com/*');

    const screenshotUrl = `https://hermit-api.koyeb.app/screenshot?url=${encodeURIComponent(match)}`;

    try {
        const response = await axios.get(screenshotUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        await message.send(imageBuffer, 'image');
    } catch (error) {
        console.error("Error fetching screenshot:", error);
        return await message.send("_Failed to capture the screenshot. Please try again._");
    }
});

Function({
    pattern: 'fullss ?(.*)',
    fromMe: isPublic,
    desc: 'Take a full website screenshot',
    type: 'download'
}, async (message, match) => {
    match = getUrl(match || message.reply_message.text);
    if (!match) return await message.send('_Need a URL_\n*Example: fullss https://example.com/*');

    const fullScreenshotUrl = `https://hermit-api.koyeb.app/screenshot?full=true&url=${encodeURIComponent(match)}`;

    try {
        const response = await axios.get(fullScreenshotUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        await message.send(imageBuffer, 'image');
    } catch (error) {
        console.error("Error fetching full screenshot:", error);
        return await message.send("_Failed to capture the full screenshot. Please try again._");
    }
});
