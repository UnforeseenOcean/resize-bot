'use strict';

const fs = require('fs');
const crypto = require('crypto');

var key;
try {
	key = fs.readFileSync('./key').toString();
} catch (err) {
	console.log('Generating key');
	key = crypto.randomBytes(64).toString('hex');
	fs.writeFileSync('./key', key);
}

var token;

try {
	let tk = fs.readFileSync('./token.txt').toString();
	if (tk.indexOf('.') !== -1) {
		token = tk;
		let cipher = crypto.createCipher('aes-256-cbc', key);
		let encrypted = cipher.update(tk, 'utf8', 'hex') + cipher.final('hex');
		fs.writeFileSync('./token.txt', encrypted);
	} else if (tk.indexOf('.') == -1) {
		let decipher = crypto.createDecipher('aes-256-cbc', key);
		token = decipher.update(tk, 'hex', 'utf8') + decipher.final('utf8');
	} else {
		throw 'Invalid token format';
	}
} catch (err) {
	console.error(err);
	process.exit(1);
}

let config;

try {
    if (!fs.existsSync('./config.json')) {
        fs.writeFileSync('./config.json', JSON.stringify({
            serverWhitelist: [],
            serverBlacklist: [],
            channelWhitelist: [],
            channelBlacklist: [],
            targetSize: [500, 200]
        }, null, '\t'));
    }

    config = require('./config.json');
} catch (err) {
    console.error('Error while loading configuration file: ', err);
    process.exit(1);
}

const Discord = require('discord.js');
const client = new Discord.Client();
const gm = require('gm');
const request = require('request');
const path = require('path');

client.on('ready', () => {
    console.log(`Logged in as ${client.user.username}!`);
});

client.on('message', message => {
    if (message.author.id == client.user.id) {
        return;
    }

    if (config.serverBlacklist.length && config.serverBlacklist.indexOf(message.guild.id) != -1) {
        return;
    }

    if (config.serverWhitelist.length && config.serverWhitelist.indexOf(message.guild.id) == -1) {
        return;
    }

    if (config.channelBlacklist.length && config.channelBlacklist.indexOf(message.channel.id) != -1) {
        return;
    }

    if (config.channelWhitelist.length && config.channelWhitelist.indexOf(message.channel.id) == -1) {
        return;
    }

    // if (!message.content.startsWith('-res')) {
    //     return;
    // }

    message.content += ' ' + message.attachments.array().reduce((p, u) => p + ' ' + u.url, '');

    console.log('Message: ', message.content);

    let urls = message.content.split(/ +/g).filter(u => /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi.test(u));

    if (urls.length == 0) {
        return;
    }

    let url = urls[0];

    console.log('Resizing image: ', url);

    let [w, h] = config.targetSize;

    let hash = crypto.createHash('sha256').update(crypto.randomBytes(32).toString() + url).digest('hex');
    let file = path.join(process.cwd(), 'temp', hash + '.tmp');
    let dest = path.join(process.cwd(), 'temp', hash + '.png')
    console.log(`Downloading into ${file}`);

    request(url).pipe(fs.createWriteStream(file)).on('close', () => {
        console.log('Download finished');
        gm(file)
        .resize(w, h, '>')
        .write(dest, (err) => {
            if (err) {
                try {
                    fs.unlinkSync(file);
                    fs.unlinkSync(dest);
                } catch(err2) {
                    console.error(err2);
                }
                message.channel.send(`Failed to resize: ${err.message}`);
                return;
            }

            message.channel.send(new Discord.Attachment(dest)).then(() => {
                try {
                    fs.unlinkSync(file);
                    fs.unlinkSync(dest);
                } catch(err) {
                    console.error(err);
                }
            });
        })
    });
});

client.login(token);