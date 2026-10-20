import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, '../docs/store/vk');
const fixed = k => ({ a: 0, k });
const color = hex => [...hex.matchAll(/[a-f\d]{2}/gi)].map(part => parseInt(part[0], 16) / 255).concat(1);
const animated = stops => ({ a: 1, k: stops.map(([t, value], index) => ({
  t, s: Array.isArray(value) ? value : [value],
  ...(index < stops.length - 1 ? { o: { x: .33, y: 0 }, i: { x: .67, y: 1 } } : {}),
})) });
const transform = overrides => ({ ty: 'tr', p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]), r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0), ...overrides });
const fill = hex => ({ ty: 'fl', c: fixed(color(hex)), o: fixed(100), r: 1, bm: 0 });
const stroke = (hex, width) => ({ ty: 'st', c: fixed(color(hex)), o: fixed(100), w: fixed(width), lc: 2, lj: 2, ml: 4, bm: 0 });
const group = (name, shapes, style, tr = {}) => ({ ty: 'gr', nm: name, it: [...shapes, style, transform(tr)], np: shapes.length + 1, cix: 2, bm: 0 });
const ellipse = (name, x, y, w, h, hex, tr = {}) => group(name, [{ ty: 'el', p: fixed([x, y]), s: fixed([w, h]), d: 1 }], fill(hex), tr);
const curve = (name, vertices, incoming, outgoing, hex, width, closed = false) => group(name, [{
  ty: 'sh', ks: fixed({ v: vertices, i: incoming, o: outgoing, c: closed }),
}], stroke(hex, width));
const zeroTangents = vertices => vertices.map(() => [0, 0]);
const line = (name, vertices, hex, width) => curve(name, vertices, zeroTangents(vertices), zeroTangents(vertices), hex, width);
const bob = animated([[0, [48, 48, 0]], [45, [48, 46.4, 0]], [90, [48, 48, 0]]]);
const sway = animated([[0, -.8], [45, .8], [90, -.8]]);
const layers = [];
function layer(name, shapes, moving = true, opacity = fixed(100)) {
  layers.push({ ddd: 0, ind: layers.length + 1, ty: 4, nm: name, sr: 1,
    ks: { o: opacity, r: moving ? sway : fixed(0), p: moving ? bob : fixed([48, 48, 0]), a: fixed([48, 48, 0]), s: fixed([100, 100, 100]) },
    ao: 0, shapes, ip: 0, op: 90, st: 0, bm: 0,
  });
}

// Layers are ordered from front to back. All artwork is native Lottie geometry.
layer('Eyes, smile and rosy cheeks', [
  ellipse('Left eye', 0, 0, 3.4, 5.4, '#4f4b49', { p: fixed([39, 44]), s: animated([[0, [100, 100]], [35, [100, 100]], [38, [100, 12]], [41, [100, 100]], [90, [100, 100]]]) }),
  ellipse('Right eye', 0, 0, 3.4, 5.4, '#4f4b49', { p: fixed([57, 44]), s: animated([[0, [100, 100]], [35, [100, 100]], [38, [100, 12]], [41, [100, 100]], [90, [100, 100]]]) }),
  ellipse('Left cheek', 33, 51, 8, 4.2, '#e9b4a5'),
  ellipse('Right cheek', 63, 51, 8, 4.2, '#e9b4a5'),
  line('Nose', [[45.5, 49], [48, 51], [50.5, 49]], '#b48a80', 2),
  line('Philtrum', [[48, 51], [48, 53]], '#b48a80', 1.3),
  curve('Smile left', [[48, 53], [44.5, 55], [41.5, 53.5]], [[0, 0], [1.5, 0], [1, 1.4]], [[-1, 1.4], [-1.5, 0], [0, 0]], '#b48a80', 1.2),
  curve('Smile right', [[48, 53], [51.5, 55], [54.5, 53.5]], [[0, 0], [-1.5, 0], [-1, 1.4]], [[1, 1.4], [1.5, 0], [0, 0]], '#b48a80', 1.2),
]);
layer('Soft cream face', [ellipse('Face', 48, 44, 50, 41, '#f7f0e5')]);
layer('Pink inner ears', [
  ellipse('Left inner ear', 0, 0, 5.2, 26, '#e8b4ae', { p: fixed([36, 23]), r: fixed(-12) }),
  ellipse('Right inner ear', 0, 0, 5.2, 26, '#e8b4ae', { p: fixed([60, 23]), r: fixed(12) }),
]);
layer('Long ears', [
  ellipse('Left ear', 0, 0, 12.5, 39, '#f1e8da', { p: fixed([36, 25]), r: fixed(-12) }),
  ellipse('Right ear', 0, 0, 12.5, 39, '#f1e8da', { p: fixed([60, 25]), r: fixed(12) }),
]);
layer('Belly, little paws and feet', [
  ellipse('Belly', 48, 70, 23, 26, '#faf5eb'),
  ellipse('Left foot', 35, 82, 20, 9, '#eee3d5'),
  ellipse('Right foot', 61, 82, 20, 9, '#eee3d5'),
  curve('Left paw', [[34, 64], [31, 69], [32, 73]], [[0, 0], [0, -2], [-1, -1.5]], [[-2, 1.5], [0, 2], [0, 0]], '#cfbfaa', 2),
  curve('Right paw', [[62, 64], [65, 69], [64, 73]], [[0, 0], [0, -2], [1, -1.5]], [[2, 1.5], [0, 2], [0, 0]], '#cfbfaa', 2),
]);
layer('Round body and fluffy tail', [ellipse('Body', 48, 70, 38, 33, '#e7dac9'), ellipse('Tail', 68, 75, 14, 14, '#f7f1e7')]);
const star = [[0, -4], [1.2, -1.2], [4, 0], [1.2, 1.2], [0, 4], [-1.2, 1.2], [-4, 0], [-1.2, -1.2]];
layer('Warm little sparkle', [group('Star', [{ ty: 'sh', ks: fixed({ v: star, i: zeroTangents(star), o: zeroTangents(star), c: true }) }], fill('#e4bf69'), { p: fixed([78, 20]) })], false, animated([[0, 50], [45, 100], [90, 50]]));
layer('Blush dot', [ellipse('Dot', 16, 68, 5.5, 5.5, '#d9a8a0')], false, animated([[0, 85], [45, 50], [90, 85]]));
layer('Ground shadow', [ellipse('Shadow', 48, 87, 48, 5, '#cbd4b7')], false);
layer('Sage green backdrop', [group('Rounded square', [{ ty: 'rc', p: fixed([48, 48]), s: fixed([90, 90]), r: fixed(22), d: 1 }], fill('#dce7c9'))], false);

const animation = { v: '5.7.4', fr: 30, ip: 0, op: 90, w: 96, h: 96, nm: 'Лапки и краски — зайчик', ddd: 0, assets: [], layers, markers: [] };
const json = JSON.stringify(animation);
if (Buffer.byteLength(json) > 24_000) throw new Error('VK launch icon exceeds 24 KB');
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'launch-bunny-96.json'), json + '\n');
execFileSync('python3', ['-c', `import pathlib,sys,zipfile
folder=pathlib.Path(sys.argv[1])
name='launch-bunny-96.json'
with zipfile.ZipFile(folder/'vk-launch-icon.zip','w',zipfile.ZIP_DEFLATED) as archive:
    archive.write(folder/name,arcname=name)
with zipfile.ZipFile(folder/'vk-launch-icon.zip') as archive:
    assert archive.namelist()==[name] and archive.testzip() is None
    assert archive.read(name)==(folder/name).read_bytes()
`, out]);
console.log(`Lottie JSON: 96×96, 30 fps, 3-second loop, ${Buffer.byteLength(json) + 1} bytes; ZIP verified.`);
