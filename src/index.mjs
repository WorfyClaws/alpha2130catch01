import tf from '@tensorflow/tfjs-node';
import Discord from 'discord.js';
import request from 'request';

import { token } from './token';
import { fileToTensor } from './data';
import { Model } from './model';
import { modelDir } from './constants';

const model = new Model();
const client = new Discord.Client();

let counter = 0;
const j2eChannelId = '598497945666453504';
const spamChannelId = '599371457771995149';
const spawnChannelId = '599941743491678230';
const failedChannelId = '600133329638916116';

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
    let lastUrl = null;
    await model.init();
    await model.loadModel(modelDir);

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
        client.setInterval(() => { client.channels.get(spamChannelId).send(counter++); }, 2000);
    });

    client.on('message', (msg) => {
        if((/*msg.channel.id === j2eChannelId ||*/ msg.channel.id === spawnChannelId) && msg.author.username === 'Pokécord') {
            if(msg.content.match(/This is the wrong pok.mon!/)) {
                    if(lastUrl) {
                        console.log('Unable to identify: ', lastUrl);
                        client.channels.get(failedChannelId).send(lastUrl);
                    }
                    lastUrl = null;
            }

            if(msg.content.match(/Congratulations .+! You caught a .+/)) {
                msg.acknowledge();

                if(msg.content.match(/.+ Added to Pokédex/)) {
                    msg.react('600011094341189662');
                }
            }

            const embeds = msg.embeds;
            if(embeds && embeds.length > 0) {
                const embed = embeds.find((e) => e.title.match(/A wild pok.mon has appeared!/));
                if(embed) {
                    const url = embed.image.url;
                    getPredictionForUrl(url)
                        .then(prediction => {
                            lastUrl = url;
                            msg.channel.send(`p!catch ${prediction.toLowerCase()}`);
                        });
                }
            }
        }
    });

    await client.login(token);
};

run();
