export interface FraudModel {
  name: string;
  acc: number;
  prec: number;
  rec: number;
  f1: number;
  time: string;
  speed: string;
  best?: boolean;
}

export interface RocPoint {
  fpr: number;
  nn: number;
  rf: number;
  svm: number;
  lr: number;
}
