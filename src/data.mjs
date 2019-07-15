import tf from '@tensorflow/tfjs-node';
import fg from 'fast-glob';
import fse from 'fs-extra';
import sharp from 'sharp';
import path from 'path';

export const fileToTensor = async (filename) => {
    const { data, info } = await sharp(filename)
        .flatten()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return imageToTensor(data, info);
};

const getDirectories = async (imagesDirectory) => fse.readdir(imagesDirectory);

const getImagesInDirectory = async (directory) => fg([
    path.join(directory, "*.png"),
    path.join(directory, "**/*.png"),
    path.join(directory, "*.jpg"),
    path.join(directory, "**/*.jpg")
]);

const imageToTensor = (pixelData, imageInfo) => {
    const outShape = [1, imageInfo.height, imageInfo.width, imageInfo.channels];

    return tf.tidy(() =>
        tf
        .tensor4d(pixelData, outShape, "int32")
        .toFloat()
        .resizeBilinear([224, 224])
        .div(tf.scalar(127))
        .sub(tf.scalar(1))
    );
};

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

export class Data {
    constructor() {
        this.dataset = null;
        this.labelsAndImages = null;
    }

    labelIndex(label) {
        return this.labelsAndImages.findIndex(item => item.label === label);
    }

    async loadLabelsAndImages(imagesDirectory) {
        this.labelsAndImages = await readImagesDirectory(imagesDirectory);
    }

    async loadTrainingData(model) {
        const numClasses = this.labelsAndImages.length;
        const numImages = this.labelsAndImages.reduce(
            (acc, item) => acc + item.images.length,
            0
        );

        const embeddingsShape = model.outputs[0].shape.slice(1);
        const embeddingsFlatSize = tf.util.sizeFromShape(embeddingsShape);
        embeddingsShape.unshift(numImages);
        const embeddings = new Float32Array(
            tf.util.sizeFromShape(embeddingsShape)
        );
        const labels = new Int32Array(numImages);

        // Loop through the files and populate the 'images' and 'labels' arrays
        let embeddingsOffset = 0;
        let labelsOffset = 0;
        console.log("Loading Training Data");
        console.time("Loading Training Data");
        for (const element of this.labelsAndImages) {
            let labelIndex = this.labelIndex(element.label);
            for (const image of element.images) {
                let t = await fileToTensor(image);
                tf.tidy(() => {
                    let prediction = model.predict(t);
                    embeddings.set(prediction.dataSync(), embeddingsOffset);
                    labels.set([labelIndex], labelsOffset);
                });
                t.dispose();

                embeddingsOffset += embeddingsFlatSize;
                labelsOffset += 1;
            }
            console.timeLog("Loading Training Data", {
                label: element.label,
                count: element.images.length
            });
        }

        this.dataset = {
            images: tf.tensor4d(embeddings, embeddingsShape),
            labels: tf.oneHot(tf.tensor1d(labels, "int32"), numClasses)
        };
    }
}
