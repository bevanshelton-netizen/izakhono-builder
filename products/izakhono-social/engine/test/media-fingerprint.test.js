import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { compareFingerprints, fingerprintImage } from '../src/media-fingerprint.js';

function patternedRaw(seed = 1) {
  const width=128, height=128, channels=3;
  const data=Buffer.alloc(width*height*channels);
  let state=seed>>>0;
  for (let y=0;y<height;y+=1) {
    for (let x=0;x<width;x+=1) {
      state=(1664525*state+1013904223)>>>0;
      const i=(y*width+x)*channels;
      const checker=((Math.floor(x/16)+Math.floor(y/16))%2)*90;
      data[i]=(x*2+checker+(state&31))%256;
      data[i+1]=(y*2+((state>>>8)&63))%256;
      data[i+2]=((x+y)*3+((state>>>16)&63))%256;
    }
  }
  return {data,width,height,channels};
}

async function pngFromPattern(seed) {
  const raw=patternedRaw(seed);
  return sharp(raw.data,{raw:{width:raw.width,height:raw.height,channels:raw.channels}})
    .png()
    .toBuffer();
}

test('cropped resized recompressed copy is a strong perceptual match', async () => {
  const original=await pngFromPattern(7);
  const altered=await sharp(original)
    .extract({left:6,top:6,width:116,height:116})
    .resize(128,128)
    .jpeg({quality:72})
    .toBuffer();

  const first=await fingerprintImage(original,'image/png');
  const second=await fingerprintImage(altered,'image/jpeg');
  const comparison=compareFingerprints(first,second);

  assert.equal(comparison?.strong,true);
  assert.ok(comparison.phashDistance <= 7);
});

test('unrelated patterned image is not a strong perceptual match', async () => {
  const first=await fingerprintImage(await pngFromPattern(11),'image/png');
  const second=await fingerprintImage(await pngFromPattern(99991),'image/png');
  const comparison=compareFingerprints(first,second);

  assert.equal(comparison?.strong,false);
});
