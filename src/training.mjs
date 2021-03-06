import fs from 'fs-extra';

import { Data } from './data';
import { Model } from './model';
import { trainingImageDir, modelDir } from './constants';

const data = new Data();
const model = new Model();

const trainingParams = {
    batchSizeFraction: 0.2,
    denseUnits: 100,
    epochs: 100,
    learningRate: 0.0001,
    trainStatus: () => {}
};

export const train = async () => {
    console.log('Cleaning directory...');
    await fs.remove(modelDir);

    console.log('Loading images...');
    await data.loadLabelsAndImages(trainingImageDir);

    console.log('Loading model...');
    await model.init();
    await data.loadTrainingData(model.decapitatedMobilenet);

    console.log('Training model...');
    const labels = data.labelsAndImages.map(element => element.label);
    const trainResult = await model.train(data.dataset, labels, trainingParams);

    console.log("Training Complete!");
    const losses = trainResult.history.loss;
    console.log(
        `Final Loss: ${Number(losses[losses.length - 1]).toFixed(5)}`
    );

    console.log(model.model.summary());

    await model.saveModel(modelDir);
};

train();
