import tf from '@tensorflow/tfjs-node';
import Discord from 'discord.js';
import request from 'request';
import path from 'path';
import fs from 'fs-extra';

import { fileToTensor } from './data';
import { Model } from './model';
import { modelDir, pokecordImageDir } from './constants';
import { servers, token } from '../config';

const pokecordUserId = '365975655608745985';
const model = new Model();
const client = new Discord.Client();

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
        request({ url: url, encoding: null }, (error, response, data) => {
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

const createOnMessage = (user, server) => {
    const { id: serverId, prefix = "p!", failedChannelId, newPokedexReaction } = server;
    const caughtMatcher = new RegExp(`Congratulations <@${user.id}>! You caught a .+`);
    let lastPrediction = null;

    return async (msg) => {
        if(msg.channel.guild && msg.channel.guild.id === serverId && msg.author.id === pokecordUserId) {
            if(msg.content.match(/This is the wrong pokémon!/)) {
                const prediction = lastPrediction;
                lastPrediction = null;

                if(prediction) {
                    console.log('Unable to identify: ', prediction.url);

                    if(failedChannelId) {
                        await client.channels.get(failedChannelId).send(prediction.url);
                    }
                }
            }

            if(msg.content.match(caughtMatcher)) {
                const prediction = lastPrediction;
                lastPrediction = null;

                await msg.acknowledge();

                if(msg.content.match(/.+ Added to Pokédex./)) {
                    await msg.react(newPokedexReaction);
                }

                await attemptDownload(msg, prediction.name, prediction.url);
            }

            const embeds = msg.embeds;
            if(embeds && embeds.length > 0) {
                const embed = embeds.find((e) => e.title.match(/A wild pokémon has appeared!/));
                if(embed) {
                    const url = embed.image.url;
                    const prediction = await getPredictionForUrl(url);
                    lastPrediction = {
                        url,
                        name: prediction
                    };

                    await msg.channel.send(`${prefix}catch ${prediction.toLowerCase()}`);
                }
            }
        }
    };
};

const run = async () => {
    await model.init();
    await model.loadModel(modelDir);

    let counter = 0;

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);

        servers.forEach(server => {
            client.on('message', createOnMessage(client.user, server));

            if(server.spamChannelId) {
                client.setInterval(() => client.channels.get(server.spamChannelId).send(counter++), 2000);
            }
        });
    });

    await client.login(token);
};

run();
