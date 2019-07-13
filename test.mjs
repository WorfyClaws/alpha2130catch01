import tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs-extra';

import { Data } from './data';
import { Model } from './model';
import { modelDir, testsDir } from './dirs';

const data = new Data();
const model = new Model();

async function test() {
    await model.init();
    await model.loadModel(modelDir);

    const directoryContents = await fs.readdir(testsDir);
    const images = directoryContents.filter(e => e.endsWith('.png'))
        .map(e => ({
            filename: e,
            label: e.substring(0, e.length - 4)
        }));

    Promise.all(images.map(async image => {
        const filename = image.filename;
        const label = image.label;
        const imageTensor = await data.fileToTensor(path.join(testsDir, filename));
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
                console.log("correct: ", result);
            } else {
                console.log("mislabeled: ", result);
            }
        });
    }));
}

test();
