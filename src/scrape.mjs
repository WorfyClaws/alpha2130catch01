import request from 'request';
import cheerio from 'cheerio';
import path from 'path';
import fs from 'fs-extra';

import { bulbapediaImageDir } from './constants';

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

const getImageFromSrcSet = (srcSet) => {
    const images = srcSet.split(',')
        .map(e => e.trim())
        .map(e => e.split(' ')[0]);

    return images[images.length - 1];
};

const downloadAndWritePokemon = async (number, name, url, index = null) => {
    const body = await rq({url: `https:${url}`, encoding: null});

    const imageParts = url.split('.');
    const extension = imageParts[imageParts.length - 1];
    const dir = path.join(bulbapediaImageDir, name);
    const file = path.join(dir, `bulbapedia${index == null ? '' : `_${index}`}.${extension}`);
    await fs.ensureDir(dir);
    await fs.outputFile(file, body);

    console.log(`Wrote pokemon ${number}: `, file);
};

const scrapePokemonImage = async (number, url) => {
    const $ = await rq(baseurl + url);
    const tableSelector = `table.roundy[style^='float:right; text-align:center; width:33%;']`;
    const name = $(`${tableSelector} td big big b`).text();
    const alolanName = "Alolan " + name;

    const alolanSrcSet = $(`${tableSelector} a[title^='Alolan '] img`).attr('srcset');
    if(alolanSrcSet) {
        await downloadAndWritePokemon(number, alolanName, getImageFromSrcSet(alolanSrcSet));
    }

    let defaultSrcSet = $(`${tableSelector} a[title='${name}'] img`).attr('srcset');

    if(defaultSrcSet) {
        await downloadAndWritePokemon(number, name, getImageFromSrcSet(defaultSrcSet));
    } else {
        if(alolanSrcSet) {
            throw new Error(`Unable to get image for pokemon: ${name}`);
        } else {
            // No default or alolan srcset, grab all images
            const srcSets = $(`${tableSelector} a[title] img`).map((_, e) => $(e).attr('srcset')).get();

            if(!srcSets || srcSets.length <= 0) {
                throw new Error(`Unable to get image for pokemon: ${name}`);
            }

            let index = 1;
            for(let srcSet of srcSets) {
                await downloadAndWritePokemon(number, name, getImageFromSrcSet(srcSet), index++);
            }
        }
    }
};


const scrape = async () => {
    if(start === 0) {
        console.log("Cleaning directory...");
        await fs.remove(bulbapediaImageDir);
    }
    await fs.ensureDir(bulbapediaImageDir);

    const $ = await rq(`${baseurl}/wiki/List_of_Pok%C3%A9mon_by_National_Pok%C3%A9dex_number`);
    const results = {};

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

        if(!results[number]) {
            results[number] = url;
        }
    });

    for(let [number, url] of Object.entries(results)) {
        await scrapePokemonImage(number, url);
    }
};

scrape();
