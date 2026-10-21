export type Activation = 'relu' | 'tanh' | 'sigmoid';

export interface TrainConfig {
  model: 'logistic' | 'mlp';
  hidden: number[];
  activation: Activation;
  lr: number;
  epochs: number;
  batchSize: number;
  dropout: number;
  l2: number;
  seed: number;
  sendWeights: boolean;
}

export interface TrainData {
  xTrain: number[][];
  yTrain: number[];
  xVal: number[][];
  yVal: number[];
  xTest: number[][];
  yTest: number[];
  nClasses: number;
}

export interface Grid {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  n: number;
}

export interface TrainRequest {
  type: 'train';
  id: number;
  config: TrainConfig;
  data: TrainData;
  grid?: Grid;
}

export interface EpochMessage {
  type: 'epoch';
  id: number;
  epoch: number;
  loss: number;
  valLoss: number;
  acc: number;
  valAcc: number;
  weights?: number[][][];
  grid?: number[][];
}

export interface DoneMessage {
  type: 'done';
  id: number;
  testAcc: number;
  confusion: number[][];
  testPred: number[];
  testProbs: number[][];
  weights: number[][][];
  grid?: number[][];
  seconds: number;
  params: number;
}

export type WorkerMessage = EpochMessage | DoneMessage | { type: 'error'; id: number; message: string };
