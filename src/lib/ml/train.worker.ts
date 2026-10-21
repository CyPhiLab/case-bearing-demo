// Trains logistic regression / MLP classifiers off the main thread, streaming per-epoch
// metrics (plus weights and decision-boundary grids) back to the page.
import { MLP } from './mlp';
import type { TrainRequest, WorkerMessage } from './trainTypes';

const MIN_EPOCH_MS = 15; // keep tiny models from finishing before anyone can watch the curves
let stopRequested = false;

const post = (m: WorkerMessage) => (self as unknown as Worker).postMessage(m);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function gridProbs(model: MLP, req: TrainRequest): number[][] | undefined {
  const g = req.grid;
  if (!g) return undefined;
  const out: number[][] = [];
  for (let j = 0; j < g.n; j++)
    for (let i = 0; i < g.n; i++)
      out.push(Array.from(model.predict([g.x0 + ((i + 0.5) / g.n) * (g.x1 - g.x0), g.y0 + ((j + 0.5) / g.n) * (g.y1 - g.y0)])));
  return out;
}

async function train(req: TrainRequest) {
  stopRequested = false;
  const { data, config, id } = req;
  const k = data.nClasses;
  const hidden = config.model === 'logistic' ? [] : config.hidden;
  const model = new MLP({
    sizes: [data.xTrain[0].length, ...hidden, k],
    activation: config.activation,
    dropout: config.dropout,
    l2: config.l2,
    lr: config.lr,
    seed: config.seed,
  });
  // "balanced" class weights, as in the Data lecture: up-weight the rarer class
  const counts = new Array(k).fill(0);
  data.yTrain.forEach((y) => counts[y]++);
  const classWeight = counts.map((c) => (c ? data.yTrain.length / (k * c) : 1));

  const every = Math.max(1, Math.floor(config.epochs / 60));
  const t0 = performance.now();
  for (let e = 0; e < config.epochs; e++) {
    const te = performance.now();
    const tr = model.epoch(data.xTrain, data.yTrain, config.batchSize, classWeight);
    const va = model.evaluate(data.xVal, data.yVal);
    const last = e === config.epochs - 1 || stopRequested;
    post({
      type: 'epoch', id, epoch: e + 1, loss: tr.loss, valLoss: va.loss, acc: tr.acc, valAcc: va.acc,
      weights: config.sendWeights && (e % every === 0 || last) ? model.kernels() : undefined,
      grid: e % Math.max(every, 4) === 0 || last ? gridProbs(model, req) : undefined,
    });
    await sleep(Math.max(0, MIN_EPOCH_MS - (performance.now() - te))); // also lets a 'stop' message in
    if (stopRequested) break;
  }

  const probs = data.xTest.map((x) => Array.from(model.predict(x)));
  const pred = probs.map((p) => p.indexOf(Math.max(...p)));
  const confusion = Array.from({ length: k }, () => new Array(k).fill(0));
  data.yTest.forEach((y, i) => confusion[y][pred[i]]++);
  post({
    type: 'done', id,
    testAcc: pred.filter((p, i) => p === data.yTest[i]).length / pred.length,
    confusion, testPred: pred, testProbs: probs,
    weights: model.kernels(), grid: gridProbs(model, req),
    seconds: (performance.now() - t0) / 1000, params: model.paramCount,
  });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'stop') stopRequested = true;
  else if (msg.type === 'train')
    train(msg as TrainRequest).catch((err) => post({ type: 'error', id: msg.id, message: String(err) }));
};
