import sharp from 'sharp';

const SIZE = 32;
const LOW = 8;
const RASTER_MIME = new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif']);

function median(values) {
  const copy = [...values].sort((a,b)=>a-b);
  const mid = Math.floor(copy.length/2);
  return copy.length % 2 ? copy[mid] : (copy[mid-1]+copy[mid])/2;
}

function bitsToHex(bits) {
  let value = 0n;
  for (const bit of bits) value = (value << 1n) | (bit ? 1n : 0n);
  return value.toString(16).padStart(Math.ceil(bits.length/4),'0');
}

function hexHamming(left, right) {
  if (!left || !right || left.length !== right.length) return 999;
  let a = BigInt('0x'+left);
  let b = BigInt('0x'+right);
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

async function grayscalePixels(buffer, width, height) {
  const { data } = await sharp(buffer)
    .resize(width,height,{fit:'fill',kernel:'lanczos3'})
    .grayscale()
    .raw()
    .toBuffer({resolveWithObject:true});
  return data;
}

async function phash(buffer) {
  const pixels = await grayscalePixels(buffer,SIZE,SIZE);
  const coeffs = [];
  for (let u=0;u<LOW;u+=1) {
    for (let v=0;v<LOW;v+=1) {
      let sum=0;
      for (let x=0;x<SIZE;x+=1) {
        const cx=Math.cos(((2*x+1)*u*Math.PI)/(2*SIZE));
        for (let y=0;y<SIZE;y+=1) {
          const cy=Math.cos(((2*y+1)*v*Math.PI)/(2*SIZE));
          sum += pixels[y*SIZE+x]*cx*cy;
        }
      }
      const au=u===0?1/Math.sqrt(2):1;
      const av=v===0?1/Math.sqrt(2):1;
      coeffs.push(0.25*au*av*sum);
    }
  }
  const threshold=median(coeffs.slice(1));
  return bitsToHex(coeffs.map((value,index)=>index===0?false:value>threshold));
}

async function dhash(buffer) {
  const width=9;
  const height=8;
  const pixels=await grayscalePixels(buffer,width,height);
  const bits=[];
  for (let y=0;y<height;y+=1) {
    for (let x=0;x<8;x+=1) {
      bits.push(pixels[y*width+x] > pixels[y*width+x+1]);
    }
  }
  return bitsToHex(bits);
}

async function centerCrop(buffer, width, height, ratio) {
  const w=Math.max(8,Math.floor(width*ratio));
  const h=Math.max(8,Math.floor(height*ratio));
  const left=Math.max(0,Math.floor((width-w)/2));
  const top=Math.max(0,Math.floor((height-h)/2));
  return sharp(buffer).extract({left,top,width:w,height:h}).toBuffer();
}

export function supportsPerceptualFingerprint(mimeType) {
  return RASTER_MIME.has(String(mimeType||'').toLowerCase());
}

export async function fingerprintImage(bytes, mimeType) {
  if (!supportsPerceptualFingerprint(mimeType)) return null;

  const normalized = await sharp(bytes,{animated:false,failOn:'warning'})
    .rotate()
    .removeAlpha()
    .png({compressionLevel:9})
    .toBuffer({resolveWithObject:true});

  const width=normalized.info.width;
  const height=normalized.info.height;
  if (!width || !height || width < 16 || height < 16) {
    throw new Error('Image is too small for perceptual fingerprinting');
  }

  const variants=[normalized.data];
  for (const ratio of [0.92,0.84]) {
    if (width >= 32 && height >= 32) {
      variants.push(await centerCrop(normalized.data,width,height,ratio));
    }
  }

  const phashes=[];
  for (const variant of variants) phashes.push(await phash(variant));

  return {
    algorithm:'phash-dct64-crops-v1',
    width,
    height,
    phashPrimary:phashes[0],
    phashVariants:phashes,
    dhashPrimary:await dhash(normalized.data),
  };
}

export function compareFingerprints(left, right) {
  if (!left || !right) return null;
  const leftVariants=Array.isArray(left.phashVariants)?left.phashVariants:[left.phashPrimary].filter(Boolean);
  const rightVariants=Array.isArray(right.phashVariants)?right.phashVariants:[right.phashPrimary].filter(Boolean);
  if (!leftVariants.length || !rightVariants.length) return null;

  let phashDistance=999;
  for (const a of leftVariants) {
    for (const b of rightVariants) {
      phashDistance=Math.min(phashDistance,hexHamming(a,b));
    }
  }
  const dhashDistance=hexHamming(left.dhashPrimary,right.dhashPrimary);
  const strong = phashDistance <= 5 || (phashDistance <= 7 && dhashDistance <= 8);
  const score = Math.max(0, 1 - phashDistance/64);

  return {phashDistance,dhashDistance,score,strong};
}

export const _test = {hexHamming};
