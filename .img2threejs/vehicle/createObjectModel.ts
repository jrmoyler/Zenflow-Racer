import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

// Plan 1.3 F.6 — sweep a thin 2D cross-section along a 3D spine so a curved
// form (hooked blade, handle) reads correctly from EVERY camera angle, not just
// the reference angle a flat extrude happens to match. Uses ExtrudeGeometry's
// native extrudePath; bevelEnabled: false keeps sharp tips (same rule as F.5).
function buildCurveSweepGeometry(
  sweep: { spine: [number, number, number][]; crossSection: { points: [number, number][] }; closed?: boolean },
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const cs = sweep.crossSection.points;
  if (cs.length > 0) {
    shape.moveTo(cs[0][0], cs[0][1]);
    for (let i = 1; i < cs.length; i += 1) shape.lineTo(cs[i][0], cs[i][1]);
    shape.closePath();
  }
  const spine = sweep.spine.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = new THREE.CatmullRomCurve3(spine, sweep.closed ?? false);
  return new THREE.ExtrudeGeometry(shape, {
    extrudePath: path,
    steps: Math.max(24, spine.length * 8),
    bevelEnabled: false,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ['base'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: ZenFlow sculpted kart
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createZenFlowSculptedKartModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "ZenFlow sculpted kart";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["dark"] = createSculptMaterial(
    "dark",
    {"id": "dark", "name": "dark", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#13243C", "color": "#13243C", "albedo": {"dominant": "#13243C", "secondary": ["#6E614B", "#A08F70"], "samplingNotes": "Use image-observed local color zones, not a single averaged color."}, "colorVariation": {"palette": ["#13243C"], "pattern": "mottled", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.5, "variation": 0.15, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "dark-edge", "description": "Edge clearcoat response in reference highlights", "roughness": 0.15}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Flat dielectric material observed; lighting gradients are not baked albedo.", "referencePbr": {"version": "1.0", "sourceImage": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/dark-sample.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence, not inverse rendering", "usable": true, "verdict": "pass", "confidence": 0.712, "estimatedFidelity": 0.712, "targetThreshold": 0.7, "maps": {"albedo": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-dark/dark_albedo.png", "url": "dark_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-dark/dark_roughness.png", "url": "dark_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-dark/dark_height.png", "url": "dark_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-dark/dark_normal.png", "url": "dark_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-dark/dark_ao.png", "url": "dark_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}}},
    options
  );
  materialMap["white"] = createSculptMaterial(
    "white",
    {"id": "white", "name": "white", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#EDF8FF", "color": "#EDF8FF", "albedo": {"dominant": "#6687B7", "secondary": ["#C9EBFB", "#B1D5EE", "#7B9FC5"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_albedo.png", "url": "white_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#6687B7", "#C9EBFB", "#B1D5EE", "#7B9FC5", "#95BADA"], "pattern": "reference-derived pixel palette", "amplitude": 0.181, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.431, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.171, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.067, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.68, "variation": 0.05, "map": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_roughness.png", "url": "white_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.162, "map": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_normal.png", "url": "white_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_height.png", "url": "white_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.01, "map": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_height.png", "url": "white_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_ao.png", "url": "white_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "white-edge", "description": "Edge clearcoat response in reference highlights", "roughness": 0.15}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Flat dielectric material observed; lighting gradients are not baked albedo.", "referencePbr": {"version": "1.0", "sourceImage": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/white-sample.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.793, "estimatedFidelity": 0.793, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_albedo.png", "url": "white_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_roughness.png", "url": "white_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_height.png", "url": "white_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_normal.png", "url": "white_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-white/white_ao.png", "url": "white_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 128, "sourceHeight": 128, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 80, "height": 107}, "mask": {"backgroundColor": "#EDFFFC", "backgroundNoise": 19.313, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.2387}, "mapStats": {"valueRange": 0.4321, "heightP90Gradient": 0.00497, "roughnessBase": 0.68, "roughnessVariation": 0.05, "normalStrength": 0.162, "blurRadius": 21}, "palette": ["#6687B7", "#C9EBFB", "#B1D5EE", "#7B9FC5", "#95BADA"]}, "warnings": ["low high-frequency detail weakens normal/roughness inference"]}},
    options
  );
  materialMap["aura"] = createSculptMaterial(
    "aura",
    {"id": "aura", "name": "aura", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#19BDFF", "color": "#19BDFF", "albedo": {"dominant": "#19BDFF", "secondary": ["#6E614B", "#A08F70"], "samplingNotes": "Use image-observed local color zones, not a single averaged color."}, "colorVariation": {"palette": ["#19BDFF"], "pattern": "mottled", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.18, "variation": 0.15, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "aura-edge", "description": "Edge clearcoat response in reference highlights", "roughness": 0.15}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Flat dielectric material observed; lighting gradients are not baked albedo.", "referencePbr": {"version": "1.0", "sourceImage": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/aura-head-sample.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence, not inverse rendering", "usable": true, "verdict": "pass", "confidence": 0.909, "estimatedFidelity": 0.909, "targetThreshold": 0.7, "maps": {"albedo": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-aura/aura_albedo.png", "url": "aura_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-aura/aura_roughness.png", "url": "aura_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-aura/aura_height.png", "url": "aura_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-aura/aura_normal.png", "url": "aura_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-aura/aura_ao.png", "url": "aura_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}}},
    options
  );
  materialMap["wheel"] = createSculptMaterial(
    "wheel",
    {"id": "wheel", "name": "wheel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#73E9FF", "color": "#73E9FF", "albedo": {"dominant": "#73E9FF", "secondary": ["#6E614B", "#A08F70"], "samplingNotes": "Use image-observed local color zones, not a single averaged color."}, "colorVariation": {"palette": ["#73E9FF"], "pattern": "mottled", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.15, "variation": 0.15, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "wheel-edge", "description": "Edge clearcoat response in reference highlights", "roughness": 0.15}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Flat dielectric material observed; lighting gradients are not baked albedo.", "referencePbr": {"version": "1.0", "sourceImage": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/wheel-sample.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence, not inverse rendering", "usable": true, "verdict": "pass", "confidence": 0.742, "estimatedFidelity": 0.742, "targetThreshold": 0.7, "maps": {"albedo": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-wheel/wheel_albedo.png", "url": "wheel_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-wheel/wheel_roughness.png", "url": "wheel_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-wheel/wheel_height.png", "url": "wheel_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-wheel/wheel_normal.png", "url": "wheel_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle/pbr-wheel/wheel_ao.png", "url": "wheel_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "root__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "root-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "dark", "materialLayers": ["dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "root-contour", "type": "contour", "description": "Visible reference silhouette: root", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 36, 60, 1)", "secondaryAlbedo": "rgba(19, 36, 60, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_root_0.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "root-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "root-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "dark", "materialLayers": ["dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "root-contour", "type": "contour", "description": "Visible reference silhouette: root", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 36, 60, 1)", "secondaryAlbedo": "rgba(19, 36, 60, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);
  const socket_root_root_socket_0 = new THREE.Object3D();
  socket_root_root_socket_0.name = "root-socket";
  socket_root_root_socket_0.position.set(0.0, 0.0, 0.0);
  socket_root_root_socket_0.rotation.set(0, 0, 0);
  socket_root_root_socket_0.userData.socket = {"id": "root-socket", "position": [0, 0, 0]};
  node_root_0.add(socket_root_root_socket_0);
  sockets["root:root-socket"] = socket_root_root_socket_0;

  const attachment_shell_1 = {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.85, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_shell_1 = makeAttachmentEndpoint(attachment_shell_1);
  const node_shell_1 = new THREE.Group();
  node_shell_1.name = "shell__pivot";
  if (endpoint_shell_1) {
    node_shell_1.position.copy(endpoint_shell_1.start);
    node_shell_1.rotation.set(0, 0, 0);
    node_shell_1.scale.set(1, 1, 1);
  } else {
    node_shell_1.position.set(0.0, 0.5, 0.0);
    node_shell_1.rotation.set(0.0, 0.0, 0.0);
    node_shell_1.scale.set(1.0, 1.0, 1.0);
  }
  node_shell_1.userData.sculptComponent = {"id": "shell", "name": "shell", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.85, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 2.2, "height": 0.85, "depth": 4.3, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.5, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "shell-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "white", "materialLayers": ["white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "shell-contour", "type": "contour", "description": "Visible reference silhouette: shell", "evidenceRefs": ["full-object"]}, {"id": "detail-1", "type": "contour", "description": "white continuous cockpit rim", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-2", "type": "contour", "description": "rounded sloping hood", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-3", "type": "contour", "description": "inset colored hood panel", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-4", "type": "contour", "description": "cyan upper flank light band", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-5", "type": "contour", "description": "sculpted lower front fascia", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-15", "type": "contour", "description": "rear sculpted bumper", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 248, 255, 1)", "secondaryAlbedo": "rgba(237, 248, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_shell_1.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "shell-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_shell_1);
  nodes["shell"] = node_shell_1;
  const mesh_shell_1Geometry = endpoint_shell_1
    ? new THREE.CylinderGeometry(endpoint_shell_1.endRadius, endpoint_shell_1.baseRadius, endpoint_shell_1.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_shell_1 = new THREE.Mesh(
    mesh_shell_1Geometry,
    materialMap["white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shell_1.name = "shell";
  if (endpoint_shell_1) {
    mesh_shell_1.position.copy(endpoint_shell_1.midpoint);
    mesh_shell_1.quaternion.copy(endpoint_shell_1.quaternion);
  }
  mesh_shell_1.castShadow = options.castShadow ?? true;
  mesh_shell_1.receiveShadow = options.receiveShadow ?? true;
  mesh_shell_1.userData.sculptComponent = {"id": "shell", "name": "shell", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.85, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 2.2, "height": 0.85, "depth": 4.3, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.5, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "shell-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "white", "materialLayers": ["white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "shell-contour", "type": "contour", "description": "Visible reference silhouette: shell", "evidenceRefs": ["full-object"]}, {"id": "detail-1", "type": "contour", "description": "white continuous cockpit rim", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-2", "type": "contour", "description": "rounded sloping hood", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-3", "type": "contour", "description": "inset colored hood panel", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-4", "type": "contour", "description": "cyan upper flank light band", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-5", "type": "contour", "description": "sculpted lower front fascia", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-15", "type": "contour", "description": "rear sculpted bumper", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 248, 255, 1)", "secondaryAlbedo": "rgba(237, 248, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_shell_1.add(mesh_shell_1);
  meshes["shell"] = mesh_shell_1;
  colliders["shell"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["shell"] ??= [];
  destructionGroups["shell"].push(node_shell_1);
  const socket_shell_shell_socket_0 = new THREE.Object3D();
  socket_shell_shell_socket_0.name = "shell-socket";
  socket_shell_shell_socket_0.position.set(0.0, 0.0, 0.0);
  socket_shell_shell_socket_0.rotation.set(0, 0, 0);
  socket_shell_shell_socket_0.userData.socket = {"id": "shell-socket", "position": [0, 0, 0]};
  node_shell_1.add(socket_shell_shell_socket_0);
  sockets["shell:shell-socket"] = socket_shell_shell_socket_0;

  const attachment_pilot_2 = {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_pilot_2 = makeAttachmentEndpoint(attachment_pilot_2);
  const node_pilot_2 = new THREE.Group();
  node_pilot_2.name = "pilot__pivot";
  if (endpoint_pilot_2) {
    node_pilot_2.position.copy(endpoint_pilot_2.start);
    node_pilot_2.rotation.set(0, 0, 0);
    node_pilot_2.scale.set(1, 1, 1);
  } else {
    node_pilot_2.position.set(0.0, 1.0, -0.15);
    node_pilot_2.rotation.set(0.0, 0.0, 0.0);
    node_pilot_2.scale.set(1.0, 1.0, 1.0);
  }
  node_pilot_2.userData.sculptComponent = {"id": "pilot", "name": "pilot", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.85, "height": 2, "depth": 1.3, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1, -0.15], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "pilot-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilot-contour", "type": "contour", "description": "Visible reference silhouette: pilot", "evidenceRefs": ["full-object"]}, {"id": "detail-9", "type": "contour", "description": "open black cockpit seat", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-10", "type": "contour", "description": "adult-proportioned exposed head and neck", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-11", "type": "contour", "description": "clavicle and shoulder transition", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-12", "type": "contour", "description": "elbows bent toward steering wheel", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-13", "type": "contour", "description": "hands contacting steering grips", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-14", "type": "contour", "description": "bent knees inside cockpit", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_pilot_2.userData.actionProfile = {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "pilot-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_pilot_2);
  nodes["pilot"] = node_pilot_2;
  const mesh_pilot_2Geometry = endpoint_pilot_2
    ? new THREE.CylinderGeometry(endpoint_pilot_2.endRadius, endpoint_pilot_2.baseRadius, endpoint_pilot_2.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_pilot_2 = new THREE.Mesh(
    mesh_pilot_2Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pilot_2.name = "pilot";
  if (endpoint_pilot_2) {
    mesh_pilot_2.position.copy(endpoint_pilot_2.midpoint);
    mesh_pilot_2.quaternion.copy(endpoint_pilot_2.quaternion);
  }
  mesh_pilot_2.castShadow = options.castShadow ?? true;
  mesh_pilot_2.receiveShadow = options.receiveShadow ?? true;
  mesh_pilot_2.userData.sculptComponent = {"id": "pilot", "name": "pilot", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.85, "height": 2, "depth": 1.3, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1, -0.15], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "pilot-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilot-contour", "type": "contour", "description": "Visible reference silhouette: pilot", "evidenceRefs": ["full-object"]}, {"id": "detail-9", "type": "contour", "description": "open black cockpit seat", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-10", "type": "contour", "description": "adult-proportioned exposed head and neck", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-11", "type": "contour", "description": "clavicle and shoulder transition", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-12", "type": "contour", "description": "elbows bent toward steering wheel", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-13", "type": "contour", "description": "hands contacting steering grips", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-14", "type": "contour", "description": "bent knees inside cockpit", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_pilot_2.add(mesh_pilot_2);
  meshes["pilot"] = mesh_pilot_2;
  colliders["pilot"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["pilot"] ??= [];
  destructionGroups["pilot"].push(node_pilot_2);
  const socket_pilot_pilot_socket_0 = new THREE.Object3D();
  socket_pilot_pilot_socket_0.name = "pilot-socket";
  socket_pilot_pilot_socket_0.position.set(0.0, 0.0, 0.0);
  socket_pilot_pilot_socket_0.rotation.set(0, 0, 0);
  socket_pilot_pilot_socket_0.userData.socket = {"id": "pilot-socket", "position": [0, 0, 0]};
  node_pilot_2.add(socket_pilot_pilot_socket_0);
  sockets["pilot:pilot-socket"] = socket_pilot_pilot_socket_0;

  const attachment_hood_3 = {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.35, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_hood_3 = makeAttachmentEndpoint(attachment_hood_3);
  const node_hood_3 = new THREE.Group();
  node_hood_3.name = "hood__pivot";
  if (endpoint_hood_3) {
    node_hood_3.position.copy(endpoint_hood_3.start);
    node_hood_3.rotation.set(0, 0, 0);
    node_hood_3.scale.set(1, 1, 1);
  } else {
    node_hood_3.position.set(0.0, 0.35, -1.1);
    node_hood_3.rotation.set(0.0, 0.0, 0.0);
    node_hood_3.scale.set(1.0, 1.0, 1.0);
  }
  node_hood_3.userData.sculptComponent = {"id": "hood", "name": "hood", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.35, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 1.7, "height": 0.35, "depth": 1.5, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.35, -1.1], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "hood-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hood", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "white", "materialLayers": ["white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hood-contour", "type": "contour", "description": "Visible reference silhouette: hood", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 248, 255, 1)", "secondaryAlbedo": "rgba(237, 248, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_hood_3.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "hood-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hood", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["shell"] ?? root).add(node_hood_3);
  nodes["hood"] = node_hood_3;
  const mesh_hood_3Geometry = endpoint_hood_3
    ? new THREE.CylinderGeometry(endpoint_hood_3.endRadius, endpoint_hood_3.baseRadius, endpoint_hood_3.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_hood_3 = new THREE.Mesh(
    mesh_hood_3Geometry,
    materialMap["white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hood_3.name = "hood";
  if (endpoint_hood_3) {
    mesh_hood_3.position.copy(endpoint_hood_3.midpoint);
    mesh_hood_3.quaternion.copy(endpoint_hood_3.quaternion);
  }
  mesh_hood_3.castShadow = options.castShadow ?? true;
  mesh_hood_3.receiveShadow = options.receiveShadow ?? true;
  mesh_hood_3.userData.sculptComponent = {"id": "hood", "name": "hood", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.35, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 1.7, "height": 0.35, "depth": 1.5, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.35, -1.1], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "hood-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hood", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "white", "materialLayers": ["white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hood-contour", "type": "contour", "description": "Visible reference silhouette: hood", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 248, 255, 1)", "secondaryAlbedo": "rgba(237, 248, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_hood_3.add(mesh_hood_3);
  meshes["hood"] = mesh_hood_3;
  colliders["hood"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hood"] ??= [];
  destructionGroups["hood"].push(node_hood_3);
  const socket_hood_hood_socket_0 = new THREE.Object3D();
  socket_hood_hood_socket_0.name = "hood-socket";
  socket_hood_hood_socket_0.position.set(0.0, 0.0, 0.0);
  socket_hood_hood_socket_0.rotation.set(0, 0, 0);
  socket_hood_hood_socket_0.userData.socket = {"id": "hood-socket", "position": [0, 0, 0]};
  node_hood_3.add(socket_hood_hood_socket_0);
  sockets["hood:hood-socket"] = socket_hood_hood_socket_0;

  const attachment_rim_4 = {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.25, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_rim_4 = makeAttachmentEndpoint(attachment_rim_4);
  const node_rim_4 = new THREE.Group();
  node_rim_4.name = "rim__pivot";
  if (endpoint_rim_4) {
    node_rim_4.position.copy(endpoint_rim_4.start);
    node_rim_4.rotation.set(0, 0, 0);
    node_rim_4.scale.set(1, 1, 1);
  } else {
    node_rim_4.position.set(0.0, 0.5, 0.25);
    node_rim_4.rotation.set(0.0, 0.0, 0.0);
    node_rim_4.scale.set(1.0, 1.0, 1.0);
  }
  node_rim_4.userData.sculptComponent = {"id": "rim", "name": "rim", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.25, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 1.8, "height": 0.25, "depth": 2.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.5, 0.25], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "rim-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "white", "materialLayers": ["white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-contour", "type": "contour", "description": "Visible reference silhouette: rim", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 248, 255, 1)", "secondaryAlbedo": "rgba(237, 248, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_rim_4.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "rim-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["shell"] ?? root).add(node_rim_4);
  nodes["rim"] = node_rim_4;
  const mesh_rim_4Geometry = endpoint_rim_4
    ? new THREE.CylinderGeometry(endpoint_rim_4.endRadius, endpoint_rim_4.baseRadius, endpoint_rim_4.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_rim_4 = new THREE.Mesh(
    mesh_rim_4Geometry,
    materialMap["white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rim_4.name = "rim";
  if (endpoint_rim_4) {
    mesh_rim_4.position.copy(endpoint_rim_4.midpoint);
    mesh_rim_4.quaternion.copy(endpoint_rim_4.quaternion);
  }
  mesh_rim_4.castShadow = options.castShadow ?? true;
  mesh_rim_4.receiveShadow = options.receiveShadow ?? true;
  mesh_rim_4.userData.sculptComponent = {"id": "rim", "name": "rim", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.25, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 1.8, "height": 0.25, "depth": 2.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.5, 0.25], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "rim-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "white", "materialLayers": ["white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-contour", "type": "contour", "description": "Visible reference silhouette: rim", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 248, 255, 1)", "secondaryAlbedo": "rgba(237, 248, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_rim_4.add(mesh_rim_4);
  meshes["rim"] = mesh_rim_4;
  colliders["rim"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["rim"] ??= [];
  destructionGroups["rim"].push(node_rim_4);
  const socket_rim_rim_socket_0 = new THREE.Object3D();
  socket_rim_rim_socket_0.name = "rim-socket";
  socket_rim_rim_socket_0.position.set(0.0, 0.0, 0.0);
  socket_rim_rim_socket_0.rotation.set(0, 0, 0);
  socket_rim_rim_socket_0.userData.socket = {"id": "rim-socket", "position": [0, 0, 0]};
  node_rim_4.add(socket_rim_rim_socket_0);
  sockets["rim:rim-socket"] = socket_rim_rim_socket_0;

  const attachment_flank_5 = {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.3, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_flank_5 = makeAttachmentEndpoint(attachment_flank_5);
  const node_flank_5 = new THREE.Group();
  node_flank_5.name = "flank__pivot";
  if (endpoint_flank_5) {
    node_flank_5.position.copy(endpoint_flank_5.start);
    node_flank_5.rotation.set(0, 0, 0);
    node_flank_5.scale.set(1, 1, 1);
  } else {
    node_flank_5.position.set(0.0, 0.12, 0.0);
    node_flank_5.rotation.set(0.0, 0.0, 0.0);
    node_flank_5.scale.set(1.0, 1.0, 1.0);
  }
  node_flank_5.userData.sculptComponent = {"id": "flank", "name": "flank", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.3, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 2, "height": 0.3, "depth": 3.6, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.12, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "flank-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "flank", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "flank-contour", "type": "contour", "description": "Visible reference silhouette: flank", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_flank_5.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "flank-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "flank", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["shell"] ?? root).add(node_flank_5);
  nodes["flank"] = node_flank_5;
  const mesh_flank_5Geometry = endpoint_flank_5
    ? new THREE.CylinderGeometry(endpoint_flank_5.endRadius, endpoint_flank_5.baseRadius, endpoint_flank_5.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_flank_5 = new THREE.Mesh(
    mesh_flank_5Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_flank_5.name = "flank";
  if (endpoint_flank_5) {
    mesh_flank_5.position.copy(endpoint_flank_5.midpoint);
    mesh_flank_5.quaternion.copy(endpoint_flank_5.quaternion);
  }
  mesh_flank_5.castShadow = options.castShadow ?? true;
  mesh_flank_5.receiveShadow = options.receiveShadow ?? true;
  mesh_flank_5.userData.sculptComponent = {"id": "flank", "name": "flank", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.3, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 2, "height": 0.3, "depth": 3.6, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.12, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "flank-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "flank", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "flank-contour", "type": "contour", "description": "Visible reference silhouette: flank", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_flank_5.add(mesh_flank_5);
  meshes["flank"] = mesh_flank_5;
  colliders["flank"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["flank"] ??= [];
  destructionGroups["flank"].push(node_flank_5);
  const socket_flank_flank_socket_0 = new THREE.Object3D();
  socket_flank_flank_socket_0.name = "flank-socket";
  socket_flank_flank_socket_0.position.set(0.0, 0.0, 0.0);
  socket_flank_flank_socket_0.rotation.set(0, 0, 0);
  socket_flank_flank_socket_0.userData.socket = {"id": "flank-socket", "position": [0, 0, 0]};
  node_flank_5.add(socket_flank_flank_socket_0);
  sockets["flank:flank-socket"] = socket_flank_flank_socket_0;

  const attachment_bumper_6 = {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.4, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_bumper_6 = makeAttachmentEndpoint(attachment_bumper_6);
  const node_bumper_6 = new THREE.Group();
  node_bumper_6.name = "bumper__pivot";
  if (endpoint_bumper_6) {
    node_bumper_6.position.copy(endpoint_bumper_6.start);
    node_bumper_6.rotation.set(0, 0, 0);
    node_bumper_6.scale.set(1, 1, 1);
  } else {
    node_bumper_6.position.set(0.0, -0.2, 1.8);
    node_bumper_6.rotation.set(0.0, 0.0, 0.0);
    node_bumper_6.scale.set(1.0, 1.0, 1.0);
  }
  node_bumper_6.userData.sculptComponent = {"id": "bumper", "name": "bumper", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.4, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 1.9, "height": 0.4, "depth": 0.35, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.2, 1.8], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "bumper-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "dark", "materialLayers": ["dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bumper-contour", "type": "contour", "description": "Visible reference silhouette: bumper", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 36, 60, 1)", "secondaryAlbedo": "rgba(19, 36, 60, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_bumper_6.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "bumper-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["shell"] ?? root).add(node_bumper_6);
  nodes["bumper"] = node_bumper_6;
  const mesh_bumper_6Geometry = endpoint_bumper_6
    ? new THREE.CylinderGeometry(endpoint_bumper_6.endRadius, endpoint_bumper_6.baseRadius, endpoint_bumper_6.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_bumper_6 = new THREE.Mesh(
    mesh_bumper_6Geometry,
    materialMap["dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bumper_6.name = "bumper";
  if (endpoint_bumper_6) {
    mesh_bumper_6.position.copy(endpoint_bumper_6.midpoint);
    mesh_bumper_6.quaternion.copy(endpoint_bumper_6.quaternion);
  }
  mesh_bumper_6.castShadow = options.castShadow ?? true;
  mesh_bumper_6.receiveShadow = options.receiveShadow ?? true;
  mesh_bumper_6.userData.sculptComponent = {"id": "bumper", "name": "bumper", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.4, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 1.9, "height": 0.4, "depth": 0.35, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.2, 1.8], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "bumper-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "dark", "materialLayers": ["dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bumper-contour", "type": "contour", "description": "Visible reference silhouette: bumper", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 36, 60, 1)", "secondaryAlbedo": "rgba(19, 36, 60, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_bumper_6.add(mesh_bumper_6);
  meshes["bumper"] = mesh_bumper_6;
  colliders["bumper"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bumper"] ??= [];
  destructionGroups["bumper"].push(node_bumper_6);
  const socket_bumper_bumper_socket_0 = new THREE.Object3D();
  socket_bumper_bumper_socket_0.name = "bumper-socket";
  socket_bumper_bumper_socket_0.position.set(0.0, 0.0, 0.0);
  socket_bumper_bumper_socket_0.rotation.set(0, 0, 0);
  socket_bumper_bumper_socket_0.userData.socket = {"id": "bumper-socket", "position": [0, 0, 0]};
  node_bumper_6.add(socket_bumper_bumper_socket_0);
  sockets["bumper:bumper-socket"] = socket_bumper_bumper_socket_0;

  const attachment_steering_7 = {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_steering_7 = makeAttachmentEndpoint(attachment_steering_7);
  const node_steering_7 = new THREE.Group();
  node_steering_7.name = "steering__pivot";
  if (endpoint_steering_7) {
    node_steering_7.position.copy(endpoint_steering_7.start);
    node_steering_7.rotation.set(0, 0, 0);
    node_steering_7.scale.set(1, 1, 1);
  } else {
    node_steering_7.position.set(0.0, 0.8, -0.5);
    node_steering_7.rotation.set(0.0, 0.0, 0.0);
    node_steering_7.scale.set(1.0, 1.0, 1.0);
  }
  node_steering_7.userData.sculptComponent = {"id": "steering", "name": "steering", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.7, "height": 0.7, "depth": 0.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.8, -0.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "steering-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "steering", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "dark", "materialLayers": ["dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "steering-contour", "type": "contour", "description": "Visible reference silhouette: steering", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 36, 60, 1)", "secondaryAlbedo": "rgba(19, 36, 60, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_steering_7.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "steering-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "steering", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["shell"] ?? root).add(node_steering_7);
  nodes["steering"] = node_steering_7;
  const mesh_steering_7Geometry = endpoint_steering_7
    ? new THREE.CylinderGeometry(endpoint_steering_7.endRadius, endpoint_steering_7.baseRadius, endpoint_steering_7.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.08, 24, 96);
  const mesh_steering_7 = new THREE.Mesh(
    mesh_steering_7Geometry,
    materialMap["dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_steering_7.name = "steering";
  if (endpoint_steering_7) {
    mesh_steering_7.position.copy(endpoint_steering_7.midpoint);
    mesh_steering_7.quaternion.copy(endpoint_steering_7.quaternion);
  }
  mesh_steering_7.castShadow = options.castShadow ?? true;
  mesh_steering_7.receiveShadow = options.receiveShadow ?? true;
  mesh_steering_7.userData.sculptComponent = {"id": "steering", "name": "steering", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shell", "attachment": {"parentSocket": "shell-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.7, "height": 0.7, "depth": 0.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.8, -0.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "steering-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "steering", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "dark", "materialLayers": ["dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "steering-contour", "type": "contour", "description": "Visible reference silhouette: steering", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 36, 60, 1)", "secondaryAlbedo": "rgba(19, 36, 60, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_steering_7.add(mesh_steering_7);
  meshes["steering"] = mesh_steering_7;
  colliders["steering"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["steering"] ??= [];
  destructionGroups["steering"].push(node_steering_7);
  const socket_steering_steering_socket_0 = new THREE.Object3D();
  socket_steering_steering_socket_0.name = "steering-socket";
  socket_steering_steering_socket_0.position.set(0.0, 0.0, 0.0);
  socket_steering_steering_socket_0.rotation.set(0, 0, 0);
  socket_steering_steering_socket_0.userData.socket = {"id": "steering-socket", "position": [0, 0, 0]};
  node_steering_7.add(socket_steering_steering_socket_0);
  sockets["steering:steering-socket"] = socket_steering_steering_socket_0;

  const attachment_wheel_fl_8 = {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_wheel_fl_8 = makeAttachmentEndpoint(attachment_wheel_fl_8);
  const node_wheel_fl_8 = new THREE.Group();
  node_wheel_fl_8.name = "wheel-fl__pivot";
  if (endpoint_wheel_fl_8) {
    node_wheel_fl_8.position.copy(endpoint_wheel_fl_8.start);
    node_wheel_fl_8.rotation.set(0, 0, 0);
    node_wheel_fl_8.scale.set(1, 1, 1);
  } else {
    node_wheel_fl_8.position.set(-1.22, 0.6, -1.3);
    node_wheel_fl_8.rotation.set(0.0, 0.0, 0.0);
    node_wheel_fl_8.scale.set(1.0, 1.0, 1.0);
  }
  node_wheel_fl_8.userData.sculptComponent = {"id": "wheel-fl", "name": "wheel-fl", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [-1.22, 0.6, -1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-fl-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-fl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-fl-contour", "type": "contour", "description": "Visible reference silhouette: wheel-fl", "evidenceRefs": ["full-object"]}, {"id": "detail-6", "type": "contour", "description": "four thick rounded tires", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-7", "type": "contour", "description": "luminous outer wheel rings", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-8", "type": "contour", "description": "dark recessed wheel hubs", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_fl_8.userData.actionProfile = {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-fl-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-fl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_wheel_fl_8);
  nodes["wheel-fl"] = node_wheel_fl_8;
  const mesh_wheel_fl_8Geometry = endpoint_wheel_fl_8
    ? new THREE.CylinderGeometry(endpoint_wheel_fl_8.endRadius, endpoint_wheel_fl_8.baseRadius, endpoint_wheel_fl_8.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_wheel_fl_8 = new THREE.Mesh(
    mesh_wheel_fl_8Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_fl_8.name = "wheel-fl";
  if (endpoint_wheel_fl_8) {
    mesh_wheel_fl_8.position.copy(endpoint_wheel_fl_8.midpoint);
    mesh_wheel_fl_8.quaternion.copy(endpoint_wheel_fl_8.quaternion);
  }
  mesh_wheel_fl_8.castShadow = options.castShadow ?? true;
  mesh_wheel_fl_8.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_fl_8.userData.sculptComponent = {"id": "wheel-fl", "name": "wheel-fl", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [-1.22, 0.6, -1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-fl-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-fl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-fl-contour", "type": "contour", "description": "Visible reference silhouette: wheel-fl", "evidenceRefs": ["full-object"]}, {"id": "detail-6", "type": "contour", "description": "four thick rounded tires", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-7", "type": "contour", "description": "luminous outer wheel rings", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}, {"id": "detail-8", "type": "contour", "description": "dark recessed wheel hubs", "evidenceRefs": ["select-reference.jpg:vehicle-center", "race-reference.jpg:player-rear"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_fl_8.add(mesh_wheel_fl_8);
  meshes["wheel-fl"] = mesh_wheel_fl_8;
  colliders["wheel-fl"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wheel-fl"] ??= [];
  destructionGroups["wheel-fl"].push(node_wheel_fl_8);
  const socket_wheel_fl_wheel_fl_socket_0 = new THREE.Object3D();
  socket_wheel_fl_wheel_fl_socket_0.name = "wheel-fl-socket";
  socket_wheel_fl_wheel_fl_socket_0.position.set(0.0, 0.0, 0.0);
  socket_wheel_fl_wheel_fl_socket_0.rotation.set(0, 0, 0);
  socket_wheel_fl_wheel_fl_socket_0.userData.socket = {"id": "wheel-fl-socket", "position": [0, 0, 0]};
  node_wheel_fl_8.add(socket_wheel_fl_wheel_fl_socket_0);
  sockets["wheel-fl:wheel-fl-socket"] = socket_wheel_fl_wheel_fl_socket_0;

  const attachment_wheel_fr_9 = {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_wheel_fr_9 = makeAttachmentEndpoint(attachment_wheel_fr_9);
  const node_wheel_fr_9 = new THREE.Group();
  node_wheel_fr_9.name = "wheel-fr__pivot";
  if (endpoint_wheel_fr_9) {
    node_wheel_fr_9.position.copy(endpoint_wheel_fr_9.start);
    node_wheel_fr_9.rotation.set(0, 0, 0);
    node_wheel_fr_9.scale.set(1, 1, 1);
  } else {
    node_wheel_fr_9.position.set(1.22, 0.6, -1.3);
    node_wheel_fr_9.rotation.set(0.0, 0.0, 0.0);
    node_wheel_fr_9.scale.set(1.0, 1.0, 1.0);
  }
  node_wheel_fr_9.userData.sculptComponent = {"id": "wheel-fr", "name": "wheel-fr", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [1.22, 0.6, -1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-fr-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-fr", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-fr-contour", "type": "contour", "description": "Visible reference silhouette: wheel-fr", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_fr_9.userData.actionProfile = {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-fr-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-fr", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_wheel_fr_9);
  nodes["wheel-fr"] = node_wheel_fr_9;
  const mesh_wheel_fr_9Geometry = endpoint_wheel_fr_9
    ? new THREE.CylinderGeometry(endpoint_wheel_fr_9.endRadius, endpoint_wheel_fr_9.baseRadius, endpoint_wheel_fr_9.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_wheel_fr_9 = new THREE.Mesh(
    mesh_wheel_fr_9Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_fr_9.name = "wheel-fr";
  if (endpoint_wheel_fr_9) {
    mesh_wheel_fr_9.position.copy(endpoint_wheel_fr_9.midpoint);
    mesh_wheel_fr_9.quaternion.copy(endpoint_wheel_fr_9.quaternion);
  }
  mesh_wheel_fr_9.castShadow = options.castShadow ?? true;
  mesh_wheel_fr_9.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_fr_9.userData.sculptComponent = {"id": "wheel-fr", "name": "wheel-fr", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [1.22, 0.6, -1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-fr-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-fr", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-fr-contour", "type": "contour", "description": "Visible reference silhouette: wheel-fr", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_fr_9.add(mesh_wheel_fr_9);
  meshes["wheel-fr"] = mesh_wheel_fr_9;
  colliders["wheel-fr"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wheel-fr"] ??= [];
  destructionGroups["wheel-fr"].push(node_wheel_fr_9);
  const socket_wheel_fr_wheel_fr_socket_0 = new THREE.Object3D();
  socket_wheel_fr_wheel_fr_socket_0.name = "wheel-fr-socket";
  socket_wheel_fr_wheel_fr_socket_0.position.set(0.0, 0.0, 0.0);
  socket_wheel_fr_wheel_fr_socket_0.rotation.set(0, 0, 0);
  socket_wheel_fr_wheel_fr_socket_0.userData.socket = {"id": "wheel-fr-socket", "position": [0, 0, 0]};
  node_wheel_fr_9.add(socket_wheel_fr_wheel_fr_socket_0);
  sockets["wheel-fr:wheel-fr-socket"] = socket_wheel_fr_wheel_fr_socket_0;

  const attachment_wheel_rl_10 = {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_wheel_rl_10 = makeAttachmentEndpoint(attachment_wheel_rl_10);
  const node_wheel_rl_10 = new THREE.Group();
  node_wheel_rl_10.name = "wheel-rl__pivot";
  if (endpoint_wheel_rl_10) {
    node_wheel_rl_10.position.copy(endpoint_wheel_rl_10.start);
    node_wheel_rl_10.rotation.set(0, 0, 0);
    node_wheel_rl_10.scale.set(1, 1, 1);
  } else {
    node_wheel_rl_10.position.set(-1.22, 0.6, 1.3);
    node_wheel_rl_10.rotation.set(0.0, 0.0, 0.0);
    node_wheel_rl_10.scale.set(1.0, 1.0, 1.0);
  }
  node_wheel_rl_10.userData.sculptComponent = {"id": "wheel-rl", "name": "wheel-rl", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [-1.22, 0.6, 1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-rl-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-rl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-rl-contour", "type": "contour", "description": "Visible reference silhouette: wheel-rl", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_rl_10.userData.actionProfile = {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-rl-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-rl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_wheel_rl_10);
  nodes["wheel-rl"] = node_wheel_rl_10;
  const mesh_wheel_rl_10Geometry = endpoint_wheel_rl_10
    ? new THREE.CylinderGeometry(endpoint_wheel_rl_10.endRadius, endpoint_wheel_rl_10.baseRadius, endpoint_wheel_rl_10.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_wheel_rl_10 = new THREE.Mesh(
    mesh_wheel_rl_10Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_rl_10.name = "wheel-rl";
  if (endpoint_wheel_rl_10) {
    mesh_wheel_rl_10.position.copy(endpoint_wheel_rl_10.midpoint);
    mesh_wheel_rl_10.quaternion.copy(endpoint_wheel_rl_10.quaternion);
  }
  mesh_wheel_rl_10.castShadow = options.castShadow ?? true;
  mesh_wheel_rl_10.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_rl_10.userData.sculptComponent = {"id": "wheel-rl", "name": "wheel-rl", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [-1.22, 0.6, 1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-rl-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-rl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-rl-contour", "type": "contour", "description": "Visible reference silhouette: wheel-rl", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_rl_10.add(mesh_wheel_rl_10);
  meshes["wheel-rl"] = mesh_wheel_rl_10;
  colliders["wheel-rl"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wheel-rl"] ??= [];
  destructionGroups["wheel-rl"].push(node_wheel_rl_10);
  const socket_wheel_rl_wheel_rl_socket_0 = new THREE.Object3D();
  socket_wheel_rl_wheel_rl_socket_0.name = "wheel-rl-socket";
  socket_wheel_rl_wheel_rl_socket_0.position.set(0.0, 0.0, 0.0);
  socket_wheel_rl_wheel_rl_socket_0.rotation.set(0, 0, 0);
  socket_wheel_rl_wheel_rl_socket_0.userData.socket = {"id": "wheel-rl-socket", "position": [0, 0, 0]};
  node_wheel_rl_10.add(socket_wheel_rl_wheel_rl_socket_0);
  sockets["wheel-rl:wheel-rl-socket"] = socket_wheel_rl_wheel_rl_socket_0;

  const attachment_wheel_rr_11 = {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_wheel_rr_11 = makeAttachmentEndpoint(attachment_wheel_rr_11);
  const node_wheel_rr_11 = new THREE.Group();
  node_wheel_rr_11.name = "wheel-rr__pivot";
  if (endpoint_wheel_rr_11) {
    node_wheel_rr_11.position.copy(endpoint_wheel_rr_11.start);
    node_wheel_rr_11.rotation.set(0, 0, 0);
    node_wheel_rr_11.scale.set(1, 1, 1);
  } else {
    node_wheel_rr_11.position.set(1.22, 0.6, 1.3);
    node_wheel_rr_11.rotation.set(0.0, 0.0, 0.0);
    node_wheel_rr_11.scale.set(1.0, 1.0, 1.0);
  }
  node_wheel_rr_11.userData.sculptComponent = {"id": "wheel-rr", "name": "wheel-rr", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [1.22, 0.6, 1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-rr-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-rr", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-rr-contour", "type": "contour", "description": "Visible reference silhouette: wheel-rr", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_rr_11.userData.actionProfile = {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-rr-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-rr", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_wheel_rr_11);
  nodes["wheel-rr"] = node_wheel_rr_11;
  const mesh_wheel_rr_11Geometry = endpoint_wheel_rr_11
    ? new THREE.CylinderGeometry(endpoint_wheel_rr_11.endRadius, endpoint_wheel_rr_11.baseRadius, endpoint_wheel_rr_11.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_wheel_rr_11 = new THREE.Mesh(
    mesh_wheel_rr_11Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_rr_11.name = "wheel-rr";
  if (endpoint_wheel_rr_11) {
    mesh_wheel_rr_11.position.copy(endpoint_wheel_rr_11.midpoint);
    mesh_wheel_rr_11.quaternion.copy(endpoint_wheel_rr_11.quaternion);
  }
  mesh_wheel_rr_11.castShadow = options.castShadow ?? true;
  mesh_wheel_rr_11.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_rr_11.userData.sculptComponent = {"id": "wheel-rr", "name": "wheel-rr", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.6, "height": 1.2, "depth": 1.2, "units": "relative", "confidence": 0.8}, "transform": {"position": [1.22, 0.6, 1.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "articulated", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "wheel-rr-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wheel-rr", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "wheel", "materialLayers": ["wheel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-rr-contour", "type": "contour", "description": "Visible reference silhouette: wheel-rr", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(115, 233, 255, 1)", "secondaryAlbedo": "rgba(115, 233, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_wheel_rr_11.add(mesh_wheel_rr_11);
  meshes["wheel-rr"] = mesh_wheel_rr_11;
  colliders["wheel-rr"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wheel-rr"] ??= [];
  destructionGroups["wheel-rr"].push(node_wheel_rr_11);
  const socket_wheel_rr_wheel_rr_socket_0 = new THREE.Object3D();
  socket_wheel_rr_wheel_rr_socket_0.name = "wheel-rr-socket";
  socket_wheel_rr_wheel_rr_socket_0.position.set(0.0, 0.0, 0.0);
  socket_wheel_rr_wheel_rr_socket_0.rotation.set(0, 0, 0);
  socket_wheel_rr_wheel_rr_socket_0.userData.socket = {"id": "wheel-rr-socket", "position": [0, 0, 0]};
  node_wheel_rr_11.add(socket_wheel_rr_wheel_rr_socket_0);
  sockets["wheel-rr:wheel-rr-socket"] = socket_wheel_rr_wheel_rr_socket_0;

  const attachment_torso_12 = {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_torso_12 = makeAttachmentEndpoint(attachment_torso_12);
  const node_torso_12 = new THREE.Group();
  node_torso_12.name = "torso__pivot";
  if (endpoint_torso_12) {
    node_torso_12.position.copy(endpoint_torso_12.start);
    node_torso_12.rotation.set(0, 0, 0);
    node_torso_12.scale.set(1, 1, 1);
  } else {
    node_torso_12.position.set(0.0, 0.5, 0.0);
    node_torso_12.rotation.set(0.0, 0.0, 0.0);
    node_torso_12.scale.set(1.0, 1.0, 1.0);
  }
  node_torso_12.userData.sculptComponent = {"id": "torso", "name": "torso", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.82, "height": 1.2, "depth": 0.45, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.5, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "torso-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "torso-contour", "type": "contour", "description": "Visible reference silhouette: torso", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_torso_12.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "torso-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pilot"] ?? root).add(node_torso_12);
  nodes["torso"] = node_torso_12;
  const mesh_torso_12Geometry = endpoint_torso_12
    ? new THREE.CylinderGeometry(endpoint_torso_12.endRadius, endpoint_torso_12.baseRadius, endpoint_torso_12.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_torso_12 = new THREE.Mesh(
    mesh_torso_12Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_torso_12.name = "torso";
  if (endpoint_torso_12) {
    mesh_torso_12.position.copy(endpoint_torso_12.midpoint);
    mesh_torso_12.quaternion.copy(endpoint_torso_12.quaternion);
  }
  mesh_torso_12.castShadow = options.castShadow ?? true;
  mesh_torso_12.receiveShadow = options.receiveShadow ?? true;
  mesh_torso_12.userData.sculptComponent = {"id": "torso", "name": "torso", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 1.2, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.82, "height": 1.2, "depth": 0.45, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.5, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "torso-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "torso-contour", "type": "contour", "description": "Visible reference silhouette: torso", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_torso_12.add(mesh_torso_12);
  meshes["torso"] = mesh_torso_12;
  colliders["torso"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["torso"] ??= [];
  destructionGroups["torso"].push(node_torso_12);
  const socket_torso_torso_socket_0 = new THREE.Object3D();
  socket_torso_torso_socket_0.name = "torso-socket";
  socket_torso_torso_socket_0.position.set(0.0, 0.0, 0.0);
  socket_torso_torso_socket_0.rotation.set(0, 0, 0);
  socket_torso_torso_socket_0.userData.socket = {"id": "torso-socket", "position": [0, 0, 0]};
  node_torso_12.add(socket_torso_torso_socket_0);
  sockets["torso:torso-socket"] = socket_torso_torso_socket_0;

  const attachment_head_13 = {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.58, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_head_13 = makeAttachmentEndpoint(attachment_head_13);
  const node_head_13 = new THREE.Group();
  node_head_13.name = "head__pivot";
  if (endpoint_head_13) {
    node_head_13.position.copy(endpoint_head_13.start);
    node_head_13.rotation.set(0, 0, 0);
    node_head_13.scale.set(1, 1, 1);
  } else {
    node_head_13.position.set(0.0, 1.45, 0.0);
    node_head_13.rotation.set(0.0, 0.0, 0.0);
    node_head_13.scale.set(1.0, 1.0, 1.0);
  }
  node_head_13.userData.sculptComponent = {"id": "head", "name": "head", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.58, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.42, "height": 0.58, "depth": 0.4, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.45, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "head-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "head-contour", "type": "contour", "description": "Visible reference silhouette: head", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_head_13.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "head-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pilot"] ?? root).add(node_head_13);
  nodes["head"] = node_head_13;
  const mesh_head_13Geometry = endpoint_head_13
    ? new THREE.CylinderGeometry(endpoint_head_13.endRadius, endpoint_head_13.baseRadius, endpoint_head_13.length, 32, 12)
    : buildLatheGeometry({"points": [[0.3, -0.5], [0.15, 0.0], [0.3, 0.5]], "segments": 24});
  const mesh_head_13 = new THREE.Mesh(
    mesh_head_13Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_head_13.name = "head";
  if (endpoint_head_13) {
    mesh_head_13.position.copy(endpoint_head_13.midpoint);
    mesh_head_13.quaternion.copy(endpoint_head_13.quaternion);
  }
  mesh_head_13.castShadow = options.castShadow ?? true;
  mesh_head_13.receiveShadow = options.receiveShadow ?? true;
  mesh_head_13.userData.sculptComponent = {"id": "head", "name": "head", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.58, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.42, "height": 0.58, "depth": 0.4, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.45, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "head-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "head-contour", "type": "contour", "description": "Visible reference silhouette: head", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_head_13.add(mesh_head_13);
  meshes["head"] = mesh_head_13;
  colliders["head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["head"] ??= [];
  destructionGroups["head"].push(node_head_13);
  const socket_head_head_socket_0 = new THREE.Object3D();
  socket_head_head_socket_0.name = "head-socket";
  socket_head_head_socket_0.position.set(0.0, 0.0, 0.0);
  socket_head_head_socket_0.rotation.set(0, 0, 0);
  socket_head_head_socket_0.userData.socket = {"id": "head-socket", "position": [0, 0, 0]};
  node_head_13.add(socket_head_head_socket_0);
  sockets["head:head-socket"] = socket_head_head_socket_0;

  const attachment_arm_l_14 = {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_arm_l_14 = makeAttachmentEndpoint(attachment_arm_l_14);
  const node_arm_l_14 = new THREE.Group();
  node_arm_l_14.name = "arm-l__pivot";
  if (endpoint_arm_l_14) {
    node_arm_l_14.position.copy(endpoint_arm_l_14.start);
    node_arm_l_14.rotation.set(0, 0, 0);
    node_arm_l_14.scale.set(1, 1, 1);
  } else {
    node_arm_l_14.position.set(-0.4, 0.9, 0.0);
    node_arm_l_14.rotation.set(0.0, 0.0, 0.0);
    node_arm_l_14.scale.set(1.0, 1.0, 1.0);
  }
  node_arm_l_14.userData.sculptComponent = {"id": "arm-l", "name": "arm-l", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.24, "height": 0.75, "depth": 0.55, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.4, 0.9, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "arm-l-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arm-l-contour", "type": "contour", "description": "Visible reference silhouette: arm-l", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_arm_l_14.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "arm-l-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pilot"] ?? root).add(node_arm_l_14);
  nodes["arm-l"] = node_arm_l_14;
  const mesh_arm_l_14Geometry = endpoint_arm_l_14
    ? new THREE.CylinderGeometry(endpoint_arm_l_14.endRadius, endpoint_arm_l_14.baseRadius, endpoint_arm_l_14.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_arm_l_14 = new THREE.Mesh(
    mesh_arm_l_14Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_l_14.name = "arm-l";
  if (endpoint_arm_l_14) {
    mesh_arm_l_14.position.copy(endpoint_arm_l_14.midpoint);
    mesh_arm_l_14.quaternion.copy(endpoint_arm_l_14.quaternion);
  }
  mesh_arm_l_14.castShadow = options.castShadow ?? true;
  mesh_arm_l_14.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_l_14.userData.sculptComponent = {"id": "arm-l", "name": "arm-l", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.24, "height": 0.75, "depth": 0.55, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.4, 0.9, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "arm-l-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arm-l-contour", "type": "contour", "description": "Visible reference silhouette: arm-l", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_arm_l_14.add(mesh_arm_l_14);
  meshes["arm-l"] = mesh_arm_l_14;
  colliders["arm-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["arm-l"] ??= [];
  destructionGroups["arm-l"].push(node_arm_l_14);
  const socket_arm_l_arm_l_socket_0 = new THREE.Object3D();
  socket_arm_l_arm_l_socket_0.name = "arm-l-socket";
  socket_arm_l_arm_l_socket_0.position.set(0.0, 0.0, 0.0);
  socket_arm_l_arm_l_socket_0.rotation.set(0, 0, 0);
  socket_arm_l_arm_l_socket_0.userData.socket = {"id": "arm-l-socket", "position": [0, 0, 0]};
  node_arm_l_14.add(socket_arm_l_arm_l_socket_0);
  sockets["arm-l:arm-l-socket"] = socket_arm_l_arm_l_socket_0;

  const attachment_arm_r_15 = {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_arm_r_15 = makeAttachmentEndpoint(attachment_arm_r_15);
  const node_arm_r_15 = new THREE.Group();
  node_arm_r_15.name = "arm-r__pivot";
  if (endpoint_arm_r_15) {
    node_arm_r_15.position.copy(endpoint_arm_r_15.start);
    node_arm_r_15.rotation.set(0, 0, 0);
    node_arm_r_15.scale.set(1, 1, 1);
  } else {
    node_arm_r_15.position.set(0.4, 0.9, 0.0);
    node_arm_r_15.rotation.set(0.0, 0.0, 0.0);
    node_arm_r_15.scale.set(1.0, 1.0, 1.0);
  }
  node_arm_r_15.userData.sculptComponent = {"id": "arm-r", "name": "arm-r", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.24, "height": 0.75, "depth": 0.55, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.4, 0.9, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "arm-r-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arm-r-contour", "type": "contour", "description": "Visible reference silhouette: arm-r", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_arm_r_15.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "arm-r-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pilot"] ?? root).add(node_arm_r_15);
  nodes["arm-r"] = node_arm_r_15;
  const mesh_arm_r_15Geometry = endpoint_arm_r_15
    ? new THREE.CylinderGeometry(endpoint_arm_r_15.endRadius, endpoint_arm_r_15.baseRadius, endpoint_arm_r_15.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_arm_r_15 = new THREE.Mesh(
    mesh_arm_r_15Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_r_15.name = "arm-r";
  if (endpoint_arm_r_15) {
    mesh_arm_r_15.position.copy(endpoint_arm_r_15.midpoint);
    mesh_arm_r_15.quaternion.copy(endpoint_arm_r_15.quaternion);
  }
  mesh_arm_r_15.castShadow = options.castShadow ?? true;
  mesh_arm_r_15.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_r_15.userData.sculptComponent = {"id": "arm-r", "name": "arm-r", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.24, "height": 0.75, "depth": 0.55, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.4, 0.9, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "arm-r-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arm-r-contour", "type": "contour", "description": "Visible reference silhouette: arm-r", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_arm_r_15.add(mesh_arm_r_15);
  meshes["arm-r"] = mesh_arm_r_15;
  colliders["arm-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["arm-r"] ??= [];
  destructionGroups["arm-r"].push(node_arm_r_15);
  const socket_arm_r_arm_r_socket_0 = new THREE.Object3D();
  socket_arm_r_arm_r_socket_0.name = "arm-r-socket";
  socket_arm_r_arm_r_socket_0.position.set(0.0, 0.0, 0.0);
  socket_arm_r_arm_r_socket_0.rotation.set(0, 0, 0);
  socket_arm_r_arm_r_socket_0.userData.socket = {"id": "arm-r-socket", "position": [0, 0, 0]};
  node_arm_r_15.add(socket_arm_r_arm_r_socket_0);
  sockets["arm-r:arm-r-socket"] = socket_arm_r_arm_r_socket_0;

  const attachment_leg_l_16 = {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_leg_l_16 = makeAttachmentEndpoint(attachment_leg_l_16);
  const node_leg_l_16 = new THREE.Group();
  node_leg_l_16.name = "leg-l__pivot";
  if (endpoint_leg_l_16) {
    node_leg_l_16.position.copy(endpoint_leg_l_16.start);
    node_leg_l_16.rotation.set(0, 0, 0);
    node_leg_l_16.scale.set(1, 1, 1);
  } else {
    node_leg_l_16.position.set(-0.2, 0.0, -0.45);
    node_leg_l_16.rotation.set(0.0, 0.0, 0.0);
    node_leg_l_16.scale.set(1.0, 1.0, 1.0);
  }
  node_leg_l_16.userData.sculptComponent = {"id": "leg-l", "name": "leg-l", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.3, "height": 0.7, "depth": 0.9, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.2, 0, -0.45], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "leg-l-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "leg-l-contour", "type": "contour", "description": "Visible reference silhouette: leg-l", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_leg_l_16.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "leg-l-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pilot"] ?? root).add(node_leg_l_16);
  nodes["leg-l"] = node_leg_l_16;
  const mesh_leg_l_16Geometry = endpoint_leg_l_16
    ? new THREE.CylinderGeometry(endpoint_leg_l_16.endRadius, endpoint_leg_l_16.baseRadius, endpoint_leg_l_16.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_leg_l_16 = new THREE.Mesh(
    mesh_leg_l_16Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_l_16.name = "leg-l";
  if (endpoint_leg_l_16) {
    mesh_leg_l_16.position.copy(endpoint_leg_l_16.midpoint);
    mesh_leg_l_16.quaternion.copy(endpoint_leg_l_16.quaternion);
  }
  mesh_leg_l_16.castShadow = options.castShadow ?? true;
  mesh_leg_l_16.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_l_16.userData.sculptComponent = {"id": "leg-l", "name": "leg-l", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.3, "height": 0.7, "depth": 0.9, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.2, 0, -0.45], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "leg-l-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "leg-l-contour", "type": "contour", "description": "Visible reference silhouette: leg-l", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_leg_l_16.add(mesh_leg_l_16);
  meshes["leg-l"] = mesh_leg_l_16;
  colliders["leg-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["leg-l"] ??= [];
  destructionGroups["leg-l"].push(node_leg_l_16);
  const socket_leg_l_leg_l_socket_0 = new THREE.Object3D();
  socket_leg_l_leg_l_socket_0.name = "leg-l-socket";
  socket_leg_l_leg_l_socket_0.position.set(0.0, 0.0, 0.0);
  socket_leg_l_leg_l_socket_0.rotation.set(0, 0, 0);
  socket_leg_l_leg_l_socket_0.userData.socket = {"id": "leg-l-socket", "position": [0, 0, 0]};
  node_leg_l_16.add(socket_leg_l_leg_l_socket_0);
  sockets["leg-l:leg-l-socket"] = socket_leg_l_leg_l_socket_0;

  const attachment_leg_r_17 = {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01};
  const endpoint_leg_r_17 = makeAttachmentEndpoint(attachment_leg_r_17);
  const node_leg_r_17 = new THREE.Group();
  node_leg_r_17.name = "leg-r__pivot";
  if (endpoint_leg_r_17) {
    node_leg_r_17.position.copy(endpoint_leg_r_17.start);
    node_leg_r_17.rotation.set(0, 0, 0);
    node_leg_r_17.scale.set(1, 1, 1);
  } else {
    node_leg_r_17.position.set(0.2, 0.0, -0.45);
    node_leg_r_17.rotation.set(0.0, 0.0, 0.0);
    node_leg_r_17.scale.set(1.0, 1.0, 1.0);
  }
  node_leg_r_17.userData.sculptComponent = {"id": "leg-r", "name": "leg-r", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.3, "height": 0.7, "depth": 0.9, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.2, 0, -0.45], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "leg-r-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "leg-r-contour", "type": "contour", "description": "Visible reference silhouette: leg-r", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_leg_r_17.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "leg-r-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["pilot"] ?? root).add(node_leg_r_17);
  nodes["leg-r"] = node_leg_r_17;
  const mesh_leg_r_17Geometry = endpoint_leg_r_17
    ? new THREE.CylinderGeometry(endpoint_leg_r_17.endRadius, endpoint_leg_r_17.baseRadius, endpoint_leg_r_17.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_leg_r_17 = new THREE.Mesh(
    mesh_leg_r_17Geometry,
    materialMap["aura"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_r_17.name = "leg-r";
  if (endpoint_leg_r_17) {
    mesh_leg_r_17.position.copy(endpoint_leg_r_17.midpoint);
    mesh_leg_r_17.quaternion.copy(endpoint_leg_r_17.quaternion);
  }
  mesh_leg_r_17.castShadow = options.castShadow ?? true;
  mesh_leg_r_17.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_r_17.userData.sculptComponent = {"id": "leg-r", "name": "leg-r", "level": "meso", "role": "component", "importance": 1.0, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded volumetric continuous surface, with sampled nonuniform cross sections and smooth vertex normals; no visible primitive stack.", "geometryDescriptor": {"topologyIntent": "Continuous reference-derived rounded section surface", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pilot", "attachment": {"parentSocket": "pilot-socket", "localStart": [0, 0, 0], "localEnd": [0, 0.7, 0], "contactType": "overlap", "embedDepth": 0.04, "overlap": 0.04, "gapTolerance": 0.01}, "dimensions": {"width": 0.3, "height": 0.7, "depth": 0.9, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.2, 0, -0.45], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "leg-r-socket", "position": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "aura", "materialLayers": ["aura"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "leg-r-contour", "type": "contour", "description": "Visible reference silhouette: leg-r", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["Rounded continuous surface and attachment overlap >=0.03 units."], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 189, 255, 1)", "secondaryAlbedo": "rgba(25, 189, 255, 1)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_leg_r_17.add(mesh_leg_r_17);
  meshes["leg-r"] = mesh_leg_r_17;
  colliders["leg-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["leg-r"] ??= [];
  destructionGroups["leg-r"].push(node_leg_r_17);
  const socket_leg_r_leg_r_socket_0 = new THREE.Object3D();
  socket_leg_r_leg_r_socket_0.name = "leg-r-socket";
  socket_leg_r_leg_r_socket_0.position.set(0.0, 0.0, 0.0);
  socket_leg_r_leg_r_socket_0.rotation.set(0, 0, 0);
  socket_leg_r_leg_r_socket_0.userData.socket = {"id": "leg-r-socket", "position": [0, 0, 0]};
  node_leg_r_17.add(socket_leg_r_leg_r_socket_0);
  sockets["leg-r:leg-r-socket"] = socket_leg_r_leg_r_socket_0;

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createZenFlowSculptedKartLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "ZenFlow sculpted kart look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["Broad daylight key from upper front", "Cool fill", "Cyan rim from track emission", "Pastel background", "Contact shadow below wheels", "Exposure 1.0 with ACES filmic tone mapping."];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createZenFlowSculptedKartEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameZenFlowSculptedKartCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createZenFlowSculptedKartPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureZenFlowSculptedKartRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createZenFlowSculptedKartInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
