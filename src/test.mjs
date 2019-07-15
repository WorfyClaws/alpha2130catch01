import tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs-extra';

import { fileToTensor } from './data';
import { Model } from './model';
import { modelDir, pokecordImageDir } from './constants';

const model = new Model();

async function test() {
    await model.init();
    await model.loadModel(modelDir);

    const directories = await fs.readdir(pokecordImageDir);
    const images = [];

    for(let pokemon of directories) {
        const directory = path.join(pokecordImageDir, pokemon);
        const directoryContents = await fs.readdir(directory);

        directoryContents.filter(e => e.endsWith('.png') || e.endsWith('.jpg'))
            .forEach(e => images.push({
                label: pokemon,
                filename: path.join(directory, e),
            }));
    }

    let correct = 0;
    let mislabeled = 0;

    await Promise.all(images.map(async image => {
        const filename = image.filename;
        const label = image.label;
        const imageTensor = await fileToTensor(filename);

        tf.tidy(() => {
            const prediction = model.getPrediction(imageTensor);
            const result = {
                filename,
                class: prediction.label,
                probability: (
                    Number(prediction.confidence) * 100
                ).toFixed(1)
            };

            if (prediction.label === label) {
                console.log('correct: ', result);
                correct++;
            } else {
                console.log('mislabeled: ', result);
                mislabeled++;
            }
        });
    }));

    console.log('--------------------------------------------------------------------------------');
    console.log(`correct: ${correct}, mislabeled: ${mislabeled}, accuracy: ${(correct / (correct + mislabeled + 0.0) * 100)}%`)
}

test();
