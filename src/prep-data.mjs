import sharp from 'sharp';
import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';

import { bulbapediaImageDir, pokecordImageDir, trainingImageDir } from './constants';

async function augmentBrightness(files, brightnessDelta = 0.2) {
    let names = [];

    for (const item of files) {
        const baseDir = path.join(item.parsed.dir, "brightness");
        const baseName = path.join(baseDir, item.parsed.name);

        let writePromises = [];
        await fs.ensureDir(baseDir);

        const brighter = item.image.clone().linear(1 + brightnessDelta);
        const darker = item.image.clone().linear(1 - brightnessDelta);
        names.push(baseName + "_b" + item.parsed.ext);
        writePromises.push(brighter.toFile(names[names.length - 1]));
        names.push(baseName + "_d" + item.parsed.ext);
        writePromises.push(darker.toFile(names[names.length - 1]));

        await Promise.all(writePromises);
    }
}

const getDirectories = async (imagesDirectory) => fs.readdir(imagesDirectory);

const getImagesInDirectory = async (directory) => fg([
    path.join(directory, "*.png"),
    path.join(directory, "*.jpg")
]);

const readImagesDirectory = async (imagesDirectory) => {
    const directories = await getDirectories(imagesDirectory);
    return Promise.all(
        directories.map(async directory => {
            const p = path.join(imagesDirectory, directory);
            return getImagesInDirectory(p).then(images => {
                return { label: directory, images: images };
            });
        })
    );
};

const copyImagesFromDirectory = async (name, source, destination) => {
    const images = await fs.readdir(source);

    for(let image of images) {
        console.log(`Copying image for ${name}: ${image}`);
        await fs.copy(path.join(source, image), path.join(destination, image));
    }
};

const copyImagesToTrainingDir = async () => {
    const directories = await fs.readdir(bulbapediaImageDir);
    for(let directory of directories) {
        const trainingDir = path.join(trainingImageDir, directory);
        await fs.ensureDir(trainingDir);

        const bulbapediaDir = path.join(bulbapediaImageDir, directory);
        await copyImagesFromDirectory(directory, bulbapediaDir, trainingDir);

        const pokecordDir = path.join(pokecordImageDir, directory);
        if(await fs.exists(pokecordDir)) {
            await copyImagesFromDirectory(directory, pokecordDir, trainingDir);
        }
    }
};

async function run() {
    console.log('Cleaning directory...');
    await fs.remove(trainingImageDir);
    await fs.ensureDir(trainingImageDir);
    await copyImagesToTrainingDir();

    const images = await readImagesDirectory(trainingImageDir);

    for (const item of images) {
        const files = await Promise.all(
            item.images.map(async name => {
                return {
                    image: await sharp(name),
                    parsed: path.parse(name)
                };
            })
        );

        console.log(`Adjusting Brightness: ${item.label}`);
        await augmentBrightness(files);
    }
}

run();
