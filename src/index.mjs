import tf from '@tensorflow/tfjs-node';
import Discord from 'discord.js';
import request from 'request';
import path from 'path';
import fs from 'fs-extra';

import { token } from './token';
import { fileToTensor } from './data';
import { Model } from './model';
import { modelDir, pokecordImageDir } from './constants';

const model = new Model();
const client = new Discord.Client();

let counter = 0;
const j2eChannelId = '598497945666453504';
const spamChannelId = '599371457771995149';
const spawnChannelId = '599941743491678230';
const failedChannelId = '600133329638916116';

const attemptDownload = async (msg, name, url) => {
    const directory = path.join(pokecordImageDir, name);
    const filename = path.join(directory, 'pokecord-auto.png');

    if(!await fs.exists(filename)) {
        await fs.ensureDir(directory);
        await fs.writeFile(filename, await getBufferForImageUrl(url));
        await msg.react('💾');
    }
};

const getBufferForImageUrl = async (url) => {
    return new Promise((resolve, reject) => {
        request({url: url, encoding: null}, (error, response, data) => {
            if(error != null || response.statusCode !== 200) {
                reject(new Error(`Error getting page from bulbapedia (${response.statusCode}, ${error}) for URL: ${url}`));
            } else {
                resolve(data);
            }
        });
    });
};

const predict = async (tensor) => {
    return new Promise((resolve) => {
        tf.tidy(() => {
            resolve(model.getPrediction(tensor));
        });
    });
};

const getPredictionForUrl = async (url) => {
    const buffer = await getBufferForImageUrl(url);
    const tensor = await fileToTensor(buffer);
    const prediction = await predict(tensor);

    return prediction.label;
};

const run = async () => {
    let lastPrediction = null;
    await model.init();
    await model.loadModel(modelDir);

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
        client.setInterval(async () => { await client.channels.get(spamChannelId).send(counter++); }, 2000);
    });

    client.on('message', async (msg) => {
        if((/*msg.channel.id === j2eChannelId ||*/ msg.channel.id === spawnChannelId) && msg.author.username === 'Pokécord') {
            if(msg.content.match(/This is the wrong pok.mon!/)) {
                const prediction = lastPrediction;
                lastPrediction = null;

                if(prediction) {
                    console.log('Unable to identify: ', prediction.url);
                    await client.channels.get(failedChannelId).send(prediction.url);
                }
            }

            if(msg.content.match(/Congratulations .+! You caught a .+/)) {
                const prediction = lastPrediction;
                lastPrediction = null;

                await msg.acknowledge();

                if(msg.content.match(/.+ Added to Pokédex/)) {
                    await msg.react('600011094341189662');
                }

                await attemptDownload(msg, prediction.name, prediction.url);
            }

            const embeds = msg.embeds;
            if(embeds && embeds.length > 0) {
                const embed = embeds.find((e) => e.title.match(/A wild pok.mon has appeared!/));
                if(embed) {
                    const url = embed.image.url;
                    const prediction = await getPredictionForUrl(url);
                    lastPrediction = {
                        url,
                        name: prediction
                    };

                    await msg.channel.send(`p!catch ${prediction.toLowerCase()}`);
                }
            }
        }
    });

    await client.login(token);
};

run();
