import {appError} from '../errors.js';
export const SPECIAL_FRAMES=Object.freeze(['slifer','obelisk','ra']);
export const supportsSpecialFrame=(layout,pendulum=false)=>['Normal','Effect'].includes(layout)&&!pendulum;
export function validateSpecialFrame(frame,layout,pendulum=false){
 const value=frame??'';
 if(value==='')return null;
 if(!SPECIAL_FRAMES.includes(value)||!supportsSpecialFrame(layout,pendulum))
  throw appError('error.specialFrame','La cornice speciale richiede un mostro Normale o Effetto senza Pendulum.');
 return value;
}
