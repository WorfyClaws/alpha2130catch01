import Discord from 'discord.js';
import { token } from './token';

const client = new Discord.Client();
const channelId = '599371457771995149';
let interval;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    interval = client.setInterval(() => { client.channels.get(channelId).send('a'); }, 1500);
});

client.on('message', (msg) => {
    if(msg.channel.id === channelId && msg.author.username === 'Pokécord') {
        const embeds = msg.embeds;
        if(embeds && embeds.length > 0) {
            const embed = embeds.find((e) => e.title.match(/A wild pok.mon has appeared!/));
            if(embed) {
                console.log(embed.image.url);
            }
        }
    }
});

client.login(token);
