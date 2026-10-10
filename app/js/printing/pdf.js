import {appError} from '../errors.js';
export const PRINT_PROFILE={widthMm:59,heightMm:86,dpi:300};
const sizes={A4:[595.28,841.89],LETTER:[612,792],A3:[841.89,1190.55]};
export function pageLayout(settings) {
  const size=sizes[String(settings.paper||'A4').toUpperCase()];
  const scale=Number(settings.scale),margin=Number(settings.margin),gap=Number(settings.gap);
  if(!size||![scale,margin,gap].every(Number.isFinite)||scale<=0||margin<0||gap<0)throw appError('error.printSettings','Formato o misure di stampa non validi');
  const width=PRINT_PROFILE.widthMm*72/25.4*scale,height=PRINT_PROFILE.heightMm*72/25.4*scale;
  const columns=Math.floor((size[0]-2*margin+gap)/(width+gap)),rows=Math.floor((size[1]-2*margin+gap)/(height+gap));
  if(columns<1||rows<1)throw appError('error.printFit','Una carta non entra nel foglio con queste impostazioni');
  return {size,width,height,columns,rows,capacity:columns*rows,margin,gap};
}
export async function createPdf(items,settings){
  const layout=pageLayout(settings);
  const doc=new window.PDFDocument({size:layout.size,margin:0,autoFirstPage:true});
  const stream=doc.pipe(window.blobStream());
  const result=new Promise((resolve,reject)=>{stream.on('finish',()=>resolve(stream.toBlob('application/pdf')));stream.on('error',reject);doc.on('error',reject);});
  let index=0;
  for(const item of items){
    const image=doc.openImage(item.render.pngBytes.buffer.slice(item.render.pngBytes.byteOffset, item.render.pngBytes.byteOffset + item.render.pngBytes.byteLength));
    for(let copy=0;copy<item.entry.quantity;copy++){
      if(index>0&&index%layout.capacity===0)doc.addPage();
      const pos=index%layout.capacity;
      doc.image(image,layout.margin+(pos%layout.columns)*(layout.width+layout.gap),layout.margin+Math.floor(pos/layout.columns)*(layout.height+layout.gap),{width:layout.width,height:layout.height});
      index++;
    }
  }
  doc.end();return result;
}
