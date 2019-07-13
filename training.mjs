import { Data } from './data';
import { Model } from './model';

const data = new Data();
const model = new Model();

const imageDir = "data";
const modelDir = "model";
const trainingParams = {
    batch_size_fraction: 0.2,
    dense_units: 100,
    epochs: 50,
    learning_rate: 0.0001
}

export const train = async () => {
    console.log('Loading images...');
    await data.loadLabelsAndImages(imageDir);

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

    model.saveModel(modelDir);
}

train();
