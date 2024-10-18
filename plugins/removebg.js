const {
    Function,
    isPublic
} = require("../lib/");
const Config = require('../config');
const fs = require('fs');
const got = require('got');
const FormData = require('form-data');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

Function({
    pattern: 'rmbg ?(.*)',
    fromMe: true,
    desc: 'Remove background from an image'
}, async (message, match) => {
    if (!message.reply_message) return await message.reply('Please reply to an image.');
    if (!/image/.test(message.mine)) return await message.reply('Please reply to an image.');
    if (!Config.RBG_API_KEY) return await message.reply('No API key provided for remove.bg.');

    const loadingMessage = await message.reply('Processing...');
    
    try {
        // Step 1: Download image and save locally
        const location = await message.reply_message.downloadAndSaveMedia();
        const form = new FormData();
        form.append('image_file', fs.createReadStream(location));
        form.append('size', 'auto');

        // Step 2: API call to remove.bg
        const rbgResponse = await got.post('https://api.remove.bg/v1.0/removebg', {
            body: form,
            headers: {
                'X-Api-Key': Config.RBG_API_KEY
            },
            responseType: 'buffer' // ensure we get a buffer in response
        });

        // Check if response is valid (Status Code 200 OK)
        if (rbgResponse.statusCode !== 200) {
            console.log(`API Error: Status Code: ${rbgResponse.statusCode}, Body: ${rbgResponse.body.toString()}`);
            await message.reply(`Failed to process image. Status Code: ${rbgResponse.statusCode}`);
            return;
        }

        // Step 3: Save the returned image
        fs.writeFileSync('rbg.png', rbgResponse.body);

        // Step 4: Send the processed image to the user
        await message.client.sendMessage(message.jid, {
            image: fs.readFileSync('rbg.png')
        });

    } catch (error) {
        // Log the full error details for debugging
        console.error('Error Details:', error.message || error);
        if (error.response) {
            console.error('API Response:', error.response.body.toString());
        }
        await message.reply('Error processing the image.');
    } finally {
        // Step 5: Clean up - Delete loading message
        await message.client.sendMessage(message.jid, {
            delete: loadingMessage.key
        });
    }
});
