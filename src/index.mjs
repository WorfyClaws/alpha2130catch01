import tf from '@tensorflow/tfjs-node';
import Discord from 'discord.js';
import request from 'request';
import fs from 'fs-extra';

import { token } from './token';
import { Data } from './data';
import { Model } from './model';
import { imageDir, modelDir } from './dirs';

const data = new Data();
const model = new Model();
const client = new Discord.Client();

const alolan = 'Alolan ';
const j2eChannelId = '598497945666453504';
const channelId = '599371457771995149';
const failedPredictions = [
    'Aegislash',
    'Frillish',
    'Tauros',
    'Minior',
    'Sandygast',
]

const getBufferForImageUrl = async (url) => {
    return new Promise((resolve, reject) => {
        request({url: url, encoding: null}, (error, response, data) => {
            if(error != null || response.statusCode != 200) {
                reject(new Error(`Error getting page from bulbapedia (${response.statusCode}, ${error}) for URL: ${url}`));
            } else {
                resolve(data);
            }
        });
    });
};

const predict = async (tensor) => {
    return new Promise((resolve, reject) => {
        tf.tidy(() => {
            resolve(model.getPrediction(tensor));
        });
    });
};

const getPredictionForUrl = async (url) => {
    const buffer = await getBufferForImageUrl(url);
    const tensor = await data.fileToTensor(buffer);
    const prediction = await predict(tensor);

    return prediction.label;
};

const run = async () => {
    let lastUrl = null;
    let nextPredictions = null;
    let nextPredictionIndex = null;
    const imageNames = await fs.readdir(imageDir);
    await model.init();
    await model.loadModel(modelDir);

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
        client.setInterval(() => { client.channels.get(channelId).send('a'); }, 2000);
    });

    client.on('message', (msg) => {
        if((/*msg.channel.id === j2eChannelId ||*/ msg.channel.id === channelId) && msg.author.username === 'Pokécord') {
            if(msg.content.match(/This is the wrong pok.mon!/)) {
                if(!nextPredictions || nextPredictionIndex >= nextPredictions.length) {
                    if(lastUrl) {
                        console.log('Unable to identify: ', lastUrl);
                    }
                    nextPredictions = null;
                    nextPredictionIndex = null;
                    lastUrl = null;
                } else {
                    msg.channel.send(`p!catch ${nextPredictions[nextPredictionIndex].toLowerCase()}`);
                    nextPredictionIndex++;
                }
            }

            const embeds = msg.embeds;
            if(embeds && embeds.length > 0) {
                const embed = embeds.find((e) => e.title.match(/A wild pok.mon has appeared!/));
                if(embed) {
                    getPredictionForUrl(embed.image.url)
                        .then(prediction => {
                            nextPredictions = [...failedPredictions];
                            nextPredictionIndex = 0;

                            if(prediction.startsWith(alolan)) {
                                nextPredictions.unshift(prediction.substring(alolan.length + 1, prediction.length));
                            } else if(imageNames.includes(alolan + prediction)) {
                                nextPredictions.unshift(alolan + prediction);
                            }

                            lastUrl = embed.image.url;
                            msg.channel.send(`p!catch ${prediction.toLowerCase()}`);
                        });
                }
            }
        }
    });

    client.login(token);
};

run();
