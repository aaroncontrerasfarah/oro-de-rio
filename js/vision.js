import * as ort from '../vendor/ort.wasm.min.mjs';
import { materiales, mapaEspuma } from './trampas.js';
ort.env.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href; ort.env.wasm.numThreads = 1;
const sesion = ort.InferenceSession.create(new URL('../models/segformer.onnx', import.meta.url).href, { executionProviders: ['wasm'] });
sesion.then(() => postMessage({ listo: true }), e => postMessage({ error: String(e) }));
onmessage = async ({ data: { id, rgba } }) => {
  try {
    const s = await sesion, n = 512 * 512, t = new Float32Array(3 * n), m = [.485, .456, .406], d = [.229, .224, .225];
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) t[c * n + i] = (rgba[i * 4 + c] / 255 - m[c]) / d[c];
    const r = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, 512, 512]) });
    postMessage({ id, mat: materiales(r[s.outputNames[0]].data), espuma: mapaEspuma(rgba) });
  } catch (e) { postMessage({ id, error: String(e) }); }
};
