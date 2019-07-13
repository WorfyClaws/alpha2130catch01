import request from 'request';
import cheerio from 'cheerio';
import path from 'path';
import fs from 'fs-extra';

import { imageDir } from './dirs';

const start = parseInt(process.argv[2] || '0', 10);
if(start !== 0) {
    console.log(`Starting at: #${start}`);
}

const baseurl = 'https://bulbapedia.bulbagarden.net';

const rq = async (url) => new Promise((resolve, reject) => {
    request(url, (error, response, html) => {
        if (error || response.statusCode !== 200) {
            reject(new Error(`Error getting page from bulbapedia (${response.statusCode}, ${error}) for URL: ${url}`));
        } else {
            if(url.encoding !== null) {
                resolve(cheerio.load(html));
            } else {
                resolve(html);
            }
        }
    });
});

const scrapePokemonImage = async (number, url) => {
    const $ = await rq(baseurl + url);
    const name = $('table.roundy td big big b').text();
    const srcset = $(`table.roundy a[title] img`).attr('srcset');
    const images = srcset.split(',')
        .map(e => e.trim())
        .map(e => e.split(' ')[0]);

    const image = images[images.length - 1];
    const body = await rq({url: `https:${image}`, encoding: null});

    const imageParts = image.split('.');
    const extension = imageParts[imageParts.length - 1];
    const dir = path.join(imageDir, name);
    const file = path.join(dir, `${name}.${extension}`);
    await fs.ensureDir(dir);
    await fs.outputFile(file, body);

    console.log(`Wrote pokemon ${number}: `, file);
};


const scrape = async () => {
    await fs.remove(imageDir);
    const $ = await rq(`${baseurl}/wiki/List_of_Pok%C3%A9mon_by_National_Pok%C3%A9dex_number`);
    const results = [];

    $('table tr').each(async (i, tr) => {
        const children = $(tr).children('td');

        if(children.length < 4) {
            return;
        }

        const number = $(children[1]).text().trim();

        if(!number.startsWith('#') || number.startsWith('#?')) {
            return;
        }

        if(start !== 0 && parseInt(number.substring(1, number.length), 10) < start) {
            return;
        }

        const url = $($(children[3]).children('a')[0]).attr('href');

        results.push({
            number,
            url,
        })
    });

    for(let result of results) {
        await scrapePokemonImage(result.number, result.url);
    }
};

scrape();
