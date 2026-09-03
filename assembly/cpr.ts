const MAX_RAY_STEPS: i32 = 512;

let volume = new Uint16Array(0);
let signedVolume = false;
let dimensionX: i32 = 0;
let dimensionY: i32 = 0;
let dimensionZ: i32 = 0;
let spacingX: f64 = 1;
let spacingY: f64 = 1;
let spacingZ: f64 = 1;

let curveX = new Float32Array(0);
let curveY = new Float32Array(0);
let curveArcLength = new Float32Array(0);
let output = new Float32Array(0);
let outputWidth: i32 = 0;
let outputHeight: i32 = 0;

export function setVolume(
  voxelCount: i32,
  isSigned: i32,
  dx: i32,
  dy: i32,
  dz: i32,
  sx: f64,
  sy: f64,
  sz: f64,
): usize {
  volume = new Uint16Array(voxelCount);
  signedVolume = isSigned != 0;
  dimensionX = dx;
  dimensionY = dy;
  dimensionZ = dz;
  spacingX = sx;
  spacingY = sy;
  spacingZ = sz;
  return volume.dataStart;
}

export function setCurve(sampleCount: i32): void {
  curveX = new Float32Array(sampleCount);
  curveY = new Float32Array(sampleCount);
  curveArcLength = new Float32Array(sampleCount);
}

export function getCurveXPointer(): usize {
  return curveX.dataStart;
}

export function getCurveYPointer(): usize {
  return curveY.dataStart;
}

export function getCurveArcLengthPointer(): usize {
  return curveArcLength.dataStart;
}

export function getOutputWidth(): i32 {
  return outputWidth;
}

export function getOutputHeight(): i32 {
  return outputHeight;
}

@inline
function voxel(index: i32): f64 {
  const value = unchecked(volume[index]);
  return signedVolume ? <f64><i16>value : <f64>value;
}

function sampleBilinearYZ(xt: i32, yt: f64, zt: f64): f64 {
  const y0 = <i32>Math.floor(yt);
  const y1 = y0 + 1;
  const z0 = <i32>Math.floor(zt);
  const z1 = z0 + 1;
  if (
    xt < 0 || xt >= dimensionX
    || y0 < 0 || y1 >= dimensionY
    || z0 < 0 || z1 >= dimensionZ
  ) return 0;

  const wy = yt - <f64>y0;
  const wz = zt - <f64>z0;
  const complementY = 1 - wy;
  const complementZ = 1 - wz;
  const planeSize = dimensionX * dimensionY;
  let result = voxel(z0 * planeSize + y0 * dimensionX + xt) * complementZ * complementY;
  if (z1 < dimensionZ) {
    result += voxel(z1 * planeSize + y0 * dimensionX + xt) * wz * complementY;
  }
  if (y1 < dimensionY) {
    result += voxel(z0 * planeSize + y1 * dimensionX + xt) * complementZ * wy;
  }
  if (z1 < dimensionZ && y1 < dimensionY) {
    result += voxel(z1 * planeSize + y1 * dimensionX + xt) * wz * wy;
  }
  return result;
}

function sampleBilinearXZ(xt: f64, yt: i32, zt: f64): f64 {
  const x0 = <i32>Math.floor(xt);
  const x1 = x0 + 1;
  const z0 = <i32>Math.floor(zt);
  const z1 = z0 + 1;
  if (
    x0 < 0 || x0 >= dimensionX
    || yt < 0 || yt >= dimensionY
    || z0 < 0 || z0 >= dimensionZ
  ) return 0;

  const wx = xt - <f64>x0;
  const wz = zt - <f64>z0;
  const complementX = 1 - wx;
  const complementZ = 1 - wz;
  const planeSize = dimensionX * dimensionY;
  let result = voxel(z0 * planeSize + yt * dimensionX + x0) * complementZ * complementX;
  if (z1 < dimensionZ) {
    result += voxel(z1 * planeSize + yt * dimensionX + x0) * wz * complementX;
  }
  if (x1 < dimensionX) {
    result += voxel(z0 * planeSize + yt * dimensionX + x1) * complementZ * wx;
  }
  if (z1 < dimensionZ && x1 < dimensionX) {
    result += voxel(z1 * planeSize + yt * dimensionX + x1) * wz * wx;
  }
  return result;
}

function sampleBilinearXY(xt: f64, yt: f64, zt: i32): f64 {
  const x0 = <i32>Math.floor(xt);
  const x1 = x0 + 1;
  const y0 = <i32>Math.floor(yt);
  const y1 = y0 + 1;
  if (
    x0 < 0 || x0 >= dimensionX
    || y0 < 0 || y0 >= dimensionY
    || zt < 0 || zt >= dimensionZ
  ) return 0;

  const wx = xt - <f64>x0;
  const wy = yt - <f64>y0;
  const complementX = 1 - wx;
  const complementY = 1 - wy;
  const planeSize = dimensionX * dimensionY;
  let result = voxel(zt * planeSize + y0 * dimensionX + x0) * complementY * complementX;
  if (y1 < dimensionY) {
    result += voxel(zt * planeSize + y1 * dimensionX + x0) * wy * complementX;
  }
  if (x1 < dimensionX) {
    result += voxel(zt * planeSize + y0 * dimensionX + x1) * complementY * wx;
  }
  if (y1 < dimensionY && x1 < dimensionX) {
    result += voxel(zt * planeSize + y1 * dimensionX + x1) * wy * wx;
  }
  return result;
}

@inline
function accumulate(accumulator: f64, value: f64, mode: i32): f64 {
  if (mode == 2) return value < accumulator ? value : accumulator;
  if (mode == 3) return value > accumulator ? value : accumulator;
  return accumulator + value;
}

function rayMarchAxisAligned(
  x: f64,
  y: f64,
  z: f64,
  nx: f64,
  ny: f64,
  nz: f64,
  thickness: f64,
  mode: i32,
): f64 {
  const absoluteX = Math.abs(nx);
  const absoluteY = Math.abs(ny);
  const absoluteZ = Math.abs(nz);
  const thicknessSquared = thickness * thickness;
  let accumulator = mode == 2
    ? f64.POSITIVE_INFINITY
    : mode == 3 ? f64.NEGATIVE_INFINITY : 0;
  let count: i32 = 0;

  if (absoluteX >= absoluteY && absoluteX >= absoluteZ) {
    const xFloor = <i32>Math.floor(x);
    for (let step: i32 = 1; step < MAX_RAY_STEPS; step++) {
      const sampleX = xFloor + step;
      if (sampleX >= dimensionX) break;
      const sampleY = y + <f64>step * (ny / nx);
      const sampleZ = z + <f64>step * (nz / nx);
      const deltaX = <f64>sampleX - x;
      const deltaY = sampleY - y;
      const deltaZ = sampleZ - z;
      if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > thicknessSquared) break;
      if (sampleY < 0 || sampleY >= dimensionY || sampleZ < 0 || sampleZ >= dimensionZ) break;
      accumulator = accumulate(accumulator, sampleBilinearYZ(sampleX, sampleY, sampleZ), mode);
      count++;
    }
    for (let step: i32 = 0; step >= -MAX_RAY_STEPS; step--) {
      const sampleX = xFloor + step;
      if (sampleX < 0) break;
      const sampleY = y + <f64>step * (ny / nx);
      const sampleZ = z + <f64>step * (nz / nx);
      const deltaX = <f64>sampleX - x;
      const deltaY = sampleY - y;
      const deltaZ = sampleZ - z;
      if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > thicknessSquared) break;
      if (sampleY < 0 || sampleY >= dimensionY || sampleZ < 0 || sampleZ >= dimensionZ) break;
      accumulator = accumulate(accumulator, sampleBilinearYZ(sampleX, sampleY, sampleZ), mode);
      count++;
    }
  } else if (absoluteY >= absoluteX && absoluteY >= absoluteZ) {
    const yFloor = <i32>Math.floor(y);
    for (let step: i32 = 1; step < MAX_RAY_STEPS; step++) {
      const sampleY = yFloor + step;
      if (sampleY >= dimensionY) break;
      const sampleX = x + <f64>step * (nx / ny);
      const sampleZ = z + <f64>step * (nz / ny);
      const deltaX = sampleX - x;
      const deltaY = <f64>sampleY - y;
      const deltaZ = sampleZ - z;
      if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > thicknessSquared) break;
      if (sampleX < 0 || sampleX >= dimensionX || sampleZ < 0 || sampleZ >= dimensionZ) break;
      accumulator = accumulate(accumulator, sampleBilinearXZ(sampleX, sampleY, sampleZ), mode);
      count++;
    }
    for (let step: i32 = 0; step >= -MAX_RAY_STEPS; step--) {
      const sampleY = yFloor + step;
      if (sampleY < 0) break;
      const sampleX = x + <f64>step * (nx / ny);
      const sampleZ = z + <f64>step * (nz / ny);
      const deltaX = sampleX - x;
      const deltaY = <f64>sampleY - y;
      const deltaZ = sampleZ - z;
      if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > thicknessSquared) break;
      if (sampleX < 0 || sampleX >= dimensionX || sampleZ < 0 || sampleZ >= dimensionZ) break;
      accumulator = accumulate(accumulator, sampleBilinearXZ(sampleX, sampleY, sampleZ), mode);
      count++;
    }
  } else {
    const zFloor = <i32>Math.floor(z);
    for (let step: i32 = 1; step < MAX_RAY_STEPS; step++) {
      const sampleZ = zFloor + step;
      if (sampleZ >= dimensionZ) break;
      const sampleX = x + <f64>step * (nx / nz);
      const sampleY = y + <f64>step * (ny / nz);
      const deltaX = sampleX - x;
      const deltaY = sampleY - y;
      const deltaZ = <f64>sampleZ - z;
      if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > thicknessSquared) break;
      if (sampleX < 0 || sampleX >= dimensionX || sampleY < 0 || sampleY >= dimensionY) break;
      accumulator = accumulate(accumulator, sampleBilinearXY(sampleX, sampleY, sampleZ), mode);
      count++;
    }
    for (let step: i32 = 0; step >= -MAX_RAY_STEPS; step--) {
      const sampleZ = zFloor + step;
      if (sampleZ < 0) break;
      const sampleX = x + <f64>step * (nx / nz);
      const sampleY = y + <f64>step * (ny / nz);
      const deltaX = sampleX - x;
      const deltaY = sampleY - y;
      const deltaZ = <f64>sampleZ - z;
      if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > thicknessSquared) break;
      if (sampleX < 0 || sampleX >= dimensionX || sampleY < 0 || sampleY >= dimensionY) break;
      accumulator = accumulate(accumulator, sampleBilinearXY(sampleX, sampleY, sampleZ), mode);
      count++;
    }
  }

  return mode == 1 && count > 0 ? accumulator / <f64>count : accumulator;
}

export function extract(
  totalArcLength: f64,
  thickness: f64,
  pixelSize: f64,
  depthMinimum: f64,
  depthMaximum: f64,
  mode: i32,
): usize {
  const sampleCount = curveX.length;
  const depthStart = Math.max(depthMinimum, 0);
  const depthEnd = Math.min(depthMaximum, <f64>dimensionZ * spacingZ);
  let computedHeight = <i32>Math.floor((depthEnd - depthStart) / pixelSize);
  if (computedHeight < 1) computedHeight = 1;
  outputHeight = computedHeight;
  let computedWidth = <i32>Math.floor(totalArcLength / pixelSize);
  if (computedWidth < 1) computedWidth = 1;
  outputWidth = computedWidth;
  output = new Float32Array(outputHeight * outputWidth);

  const columnX = new Float64Array(outputWidth);
  const columnY = new Float64Array(outputWidth);
  const columnNormalX = new Float64Array(outputWidth);
  const columnNormalY = new Float64Array(outputWidth);
  let segmentIndex: i32 = 0;
  const finalSegmentIndex = sampleCount - 2;

  for (let column: i32 = 0; column < outputWidth; column++) {
    const targetArcLength = <f64>column * pixelSize;
    while (
      segmentIndex < finalSegmentIndex
      && <f64>unchecked(curveArcLength[segmentIndex + 1]) < targetArcLength
    ) {
      segmentIndex++;
    }

    let nextSegmentIndex = segmentIndex + 1;
    if (nextSegmentIndex > sampleCount - 1) nextSegmentIndex = sampleCount - 1;
    const segmentStart = <f64>unchecked(curveArcLength[segmentIndex]);
    const segmentEnd = segmentIndex < sampleCount - 1
      ? <f64>unchecked(curveArcLength[nextSegmentIndex])
      : segmentStart + pixelSize;
    const segmentLength = segmentEnd - segmentStart;
    const localPosition = segmentLength > 0
      ? (targetArcLength - segmentStart) / segmentLength
      : 0;
    const startX = <f64>unchecked(curveX[segmentIndex]);
    const startY = <f64>unchecked(curveY[segmentIndex]);
    const deltaX = <f64>unchecked(curveX[nextSegmentIndex]) - startX;
    const deltaY = <f64>unchecked(curveY[nextSegmentIndex]) - startY;
    columnX[column] = startX + deltaX * localPosition;
    columnY[column] = startY + deltaY * localPosition;

    const derivativeX = deltaX * (spacingX / Math.max(segmentLength, 1e-9));
    const derivativeY = deltaY * (spacingY / Math.max(segmentLength, 1e-9));
    const normalX = -derivativeY / spacingX;
    const normalY = derivativeX / spacingY;
    const normalLength = Math.sqrt(normalX * normalX + normalY * normalY);
    columnNormalX[column] = normalLength > 1e-9 ? normalX / normalLength : 0;
    columnNormalY[column] = normalLength > 1e-9 ? normalY / normalLength : 0;
  }

  const averageSpacing = (spacingX + spacingY + spacingZ) / 3;
  const thicknessVoxels = thickness / averageSpacing;
  for (let row: i32 = 0; row < outputHeight; row++) {
    const z = <f64>(dimensionZ - 1) - (depthStart + <f64>row * pixelSize) / spacingZ;
    for (let column: i32 = 0; column < outputWidth; column++) {
      unchecked(output[row * outputWidth + column] = <f32>rayMarchAxisAligned(
        unchecked(columnX[column]),
        unchecked(columnY[column]),
        z,
        unchecked(columnNormalX[column]),
        unchecked(columnNormalY[column]),
        0,
        thicknessVoxels,
        mode,
      ));
    }
  }

  return output.dataStart;
}

export function dispose(): void {
  volume = new Uint16Array(0);
  curveX = new Float32Array(0);
  curveY = new Float32Array(0);
  curveArcLength = new Float32Array(0);
  output = new Float32Array(0);
  outputWidth = 0;
  outputHeight = 0;
}
