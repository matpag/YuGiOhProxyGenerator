export function parseDecklist(text) {
  const entries=[],errors=[];
  text.split(/\r?\n/).forEach((raw,index)=>{
    const line=raw.trim();
    if (!line || /^[#!]|^\/\//.test(line)) return;
    const match=/^(?:(\d+)\s+)?(.+?)(?:\s*\[(\d+)\])?$/.exec(line);
    if(!match){errors.push({line:index+1,message:'Riga non valida'});return;}
    const quantity=Number(match[1]||1),query=match[2].trim(),variant=Number(match[3]||0);
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>999||!Number.isSafeInteger(variant)) {
      errors.push({line:index+1,message:'Quantità o variante non valida'});return;
    }
    const numeric=/^\d+$/.test(query);
    if(numeric && query.length>8){errors.push({line:index+1,message:'ID carta troppo lungo'});return;}
    entries.push({query:numeric?query.padStart(8,'0'):query,kind:numeric?'id':'name',quantity,variant,line:index+1});
  });
  return {entries,errors};
}
