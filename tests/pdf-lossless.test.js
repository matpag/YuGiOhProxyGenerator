import test from 'node:test';
import assert from 'node:assert/strict';
import {predictRows,imageRegistry,preparePdfImage} from '../app/js/printing/lossless.js';
import {inflateSync} from 'node:zlib';

// Decode the exported PDF predictor with an independent implementation.
function restore(data,width,height,channels){
  const stride=width*channels,result=new Uint8Array(stride*height);
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
    const position=y*stride+x,left=x>=channels?result[position-channels]:0;
    const up=y?result[position-stride]:0,corner=y&&x>=channels?result[position-stride-channels]:0;
    const type=data[y*(stride+1)];let prediction=0;
    if(type===1)prediction=left;
    if(type===2)prediction=up;
    if(type===3)prediction=Math.floor((left+up)/2);
    if(type===4){
      const distances=[Math.abs(up-corner),Math.abs(left-corner),Math.abs(left+up-2*corner)];
      prediction=[left,up,corner][distances.indexOf(Math.min(...distances))];
    }
    result[position]=(data[y*(stride+1)+1+x]+prediction)&255;
  }
  return result;
}
test('PDF predictors preserve every byte for grayscale, RGB, tiny and irregular rows',()=>{
  for(const channels of [1,3])for(const [width,height] of [[1,1],[1,19],[37,23]]){
    for(const pattern of [i=>i*73+i*i,i=>Math.floor(i/(width*channels))*7,()=>255,()=>0]){
      const original=Uint8Array.from({length:width*height*channels},(_,i)=>pattern(i)&255);
      assert.deepEqual(restore(predictRows(original,width,height,channels),width,height,channels),original);
    }
  }
});
test('identical PNG bytes share images; edited bytes and typed-array slices do not collide',()=>{
  const registry=imageRegistry(),image={},other={};
  const original=new Uint8Array([1,2,3]);registry.add(original,image);
  assert.equal(registry.find(original),image);
  assert.equal(registry.find(new Uint8Array([0,1,2,3,0]).subarray(1,4)),image);
  assert.equal(registry.find(new Uint8Array([1,2,4])),undefined);
  registry.add(new Uint8Array([1,2,4]),other);
  assert.equal(registry.find(new Uint8Array([1,2,4])),other);
});
test('unsupported image formats remain on the original PDFKit path',async()=>{
  for(const image of [{},{image:{hasAlphaChannel:false}},{image:{hasAlphaChannel:true,bits:16}}]){
    assert.equal(await preparePdfImage(image),image);
  }
});
test('PDF image integration preserves grayscale/RGB and all alpha values, including hidden color',async()=>{
  for(const colors of [1,3]){
    const width=7,height=11,count=width*height;
    const pixels=Uint8Array.from({length:count*(colors+1)},(_,i)=>(i*53+17)&255);
    for(let pixel=0;pixel<count;pixel++)pixels[pixel*(colors+1)+colors]=[0,1,127,128,254,255][pixel%6];
    const image={width,height,imgData:Buffer.from([1]),image:{hasAlphaChannel:true,bits:8,
      palette:[],colors,colorSpace:colors===1?'DeviceGray':'DeviceRGB',decodePixels:resolve=>resolve(pixels)}};
    assert.equal(await preparePdfImage(image),image);
    const refs=[],document={ref(data){const ref={data,end(bytes){this.bytes=bytes;}};refs.push(ref);return ref;}};
    image.embed(document);image.embed(document);assert.equal(refs.length,2);
    const decode=(ref,channels)=>ref.data.DecodeParms?restore(inflateSync(ref.bytes),width,height,channels):inflateSync(ref.bytes);
    const rgb=decode(refs[0],colors),alpha=decode(refs[1],1);
    for(let pixel=0;pixel<count;pixel++){
      for(let color=0;color<colors;color++)assert.equal(rgb[pixel*colors+color],pixels[pixel*(colors+1)+color]);
      assert.equal(alpha[pixel],pixels[pixel*(colors+1)+colors]);
    }
    if(refs[0].data.DecodeParms)assert.equal(refs[0].data.DecodeParms.Colors,colors);
    if(refs[1].data.DecodeParms)assert.equal(refs[1].data.DecodeParms.Colors,1);
  }
});
