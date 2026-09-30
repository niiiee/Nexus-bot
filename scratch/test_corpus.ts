import { goldenCorpusEvaluator } from '../src/modules/operability/goldenCorpus.js';

const report = goldenCorpusEvaluator.evaluateClassifier();
console.log(JSON.stringify(report, null, 2));
