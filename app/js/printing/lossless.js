// PNG row predictors improve DEFLATE compression without changing a single byte
// of the decoded color or alpha channels. PDF Predictor 15 carries each row's type.
const paeth=(a,b,c)=>{
  const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
  return da<=db&&da<=dc?a:db<=dc?b:c;
};
export function predictRows(bytes,width,height,colors){
  const stride=width*colors;
  if(bytes.length!==stride*height)throw new Error('Invalid image channel length');
  const output=new Uint8Array((stride+1)*height);
  const candidates=Array.from({length:5},()=>new Uint8Array(stride));
  for(let row=0;row<height;row++){
    const scores=[0,0,0,0,0],offset=row*stride;
    for(let x=0;x<stride;x++){
      const value=bytes[offset+x],a=x>=colors?bytes[offset+x-colors]:0;
      const b=row?bytes[offset+x-stride]:0,c=row&&x>=colors?bytes[offset+x-stride-colors]:0;
      const predictions=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)];
      for(let type=0;type<5;type++){
        const delta=(value-predictions[type])&255;
        candidates[type][x]=delta;scores[type]+=Math.min(delta,256-delta);
      }
    }
    let best=0;
    for(let type=1;type<5;type++)if(scores[type]<scores[best])best=type;
    output[row*(stride+1)]=best;output.set(candidates[best],row*(stride+1)+1);
  }
  return output;
}
async function compress(bytes){
  const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function compressChannel(bytes,width,height,colors){
  const [raw,filtered]=await Promise.all([compress(bytes),compress(predictRows(bytes,width,height,colors))]);
  // Account for predictor metadata too: noisy/tiny images may be smaller raw.
  return filtered.length+80<raw.length?{bytes:filtered,predicted:true}:{bytes:raw,predicted:false};
}
// Isolate the PDFKit PNG integration here; imported PDFKit remains untouched.
export async function preparePdfImage(image){
  const png=image.image;
  if(typeof CompressionStream==='undefined'||!png?.hasAlphaChannel||png.bits!==8||
     png.palette.length||![1,3].includes(png.colors))return image;
  const pixels=await new Promise(resolve=>png.decodePixels(resolve));
  const count=image.width*image.height,colors=png.colors,colorSpace=png.colorSpace;
  const rgb=new Uint8Array(count*colors),alpha=new Uint8Array(count);
  for(let pixel=0,input=0,output=0;pixel<count;pixel++){
    for(let channel=0;channel<colors;channel++)rgb[output++]=pixels[input++];
    alpha[pixel]=pixels[input++];
  }
  const [colorData,alphaData]=await Promise.all([
    compressChannel(rgb,image.width,image.height,colors),
    compressChannel(alpha,image.width,image.height,1)
  ]);
  // PDFKit's bundled Buffer is required by PDFReference.write (Uint8Array is
  // otherwise stringified). Use the same constructor as its decoded PNG data.
  const BufferType=image.imgData.constructor;
  const predictedColor=colorData.predicted,predictedAlpha=alphaData.predicted;
  image.imgData=BufferType.from(colorData.bytes);image.alphaChannel=BufferType.from(alphaData.bytes);
  image.embed=function(document){
    if(this.obj)return;
    this.document=document;
    const params=channels=>({Predictor:15,Colors:channels,BitsPerComponent:8,Columns:this.width});
    this.obj=document.ref({Type:'XObject',Subtype:'Image',BitsPerComponent:8,
      Width:this.width,Height:this.height,Filter:'FlateDecode',ColorSpace:colorSpace,
      ...(predictedColor?{DecodeParms:params(colors)}:{})});
    const mask=document.ref({Type:'XObject',Subtype:'Image',BitsPerComponent:8,
      Width:this.width,Height:this.height,Filter:'FlateDecode',ColorSpace:'DeviceGray',
      Decode:[0,1],...(predictedAlpha?{DecodeParms:params(1)}:{})});
    mask.end(this.alphaChannel);this.obj.data.SMask=mask;
    this.obj.end(this.imgData);this.image=null;this.imgData=null;this.alphaChannel=null;
  };
  return image;
}

// Match complete PNG bytes, never a card ID: edits and artwork variants may
// share identifiers but must remain different images in the exported document.
export function imageRegistry(){
  const identities=new WeakMap(),buckets=new Map();
  return {find(bytes){
    if(identities.has(bytes))return identities.get(bytes);
    for(const entry of buckets.get(bytes.length)||[]){
      if(bytes.every((value,index)=>value===entry.bytes[index])){
        identities.set(bytes,entry.image);return entry.image;
      }
    }
  },add(bytes,image){
    identities.set(bytes,image);
    const bucket=buckets.get(bytes.length)||[];bucket.push({bytes,image});buckets.set(bytes.length,bucket);
  }};
}
