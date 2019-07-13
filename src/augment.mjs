import sharp from 'sharp';
import fg from 'fast-glob';
import fse from 'fs-extra';
import path from 'path';

import { imageDir } from './dirs';


async function run() {
    const images = await readImagesDirectory(imageDir);

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
        const newNames = await augmentBrightness(files);
    }
}

async function augmentBrightness(files, brightnessDelta = 0.2) {
    let names = [];

    for (const item of files) {
        const baseDir = path.join(item.parsed.dir, "brightness");
        const baseName = path.join(baseDir, item.parsed.name);

        let writePromises = [];
        await fse.ensureDir(baseDir);

        const brighter = item.image.clone().linear(1 + brightnessDelta);
        const darker = item.image.clone().linear(1 - brightnessDelta);
        names.push(baseName + "_b" + item.parsed.ext);
        writePromises.push(brighter.toFile(names[names.length - 1]));
        names.push(baseName + "_d" + item.parsed.ext);
        writePromises.push(darker.toFile(names[names.length - 1]));

        await Promise.all(writePromises);
    }
}

async function getDirectories(imagesDirectory) {
    return await fse.readdir(imagesDirectory);
}

async function getImagesInDirectory(directory) {
    return await fg([
        path.join(directory, "*.png"),
        path.join(directory, "*.jpg")
    ]);
}

async function readImagesDirectory(imagesDirectory) {
    const directories = await getDirectories(imagesDirectory);
    const result = await Promise.all(
        directories.map(async directory => {
            const p = path.join(imagesDirectory, directory);
            return getImagesInDirectory(p).then(images => {
                return { label: directory, images: images };
            });
        })
    );

    return result;
}

run();
