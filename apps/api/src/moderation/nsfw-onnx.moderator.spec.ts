import sharp from 'sharp';
import { NsfwOnnxModerator, softmax } from './nsfw-onnx.moderator';

describe('NsfwOnnxModerator', () => {
  it('softmax turns logits into probabilities', () => {
    const [normal, nsfw] = softmax([2.5, -2.6]);
    expect(normal + nsfw).toBeCloseTo(1);
    expect(nsfw).toBeLessThan(0.01);
  });

  it('accepts everything when the model file is missing', async () => {
    const moderator = new NsfwOnnxModerator('/no/such/model.onnx', 0.8);
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).jpeg().toBuffer();

    await expect(moderator.check(image)).resolves.toEqual({ flagged: false });
  });
  // The real model is not exercised here: onnxruntime-node rejects Float32Arrays created
  // inside Jest's sandbox (different realm). Check it with a plain Node script instead.
});
