// Stable error codes belong to the application; vendor/browser errors keep a text fallback.
export class AppError extends Error {
 constructor(code,params={},message=code,{cause}={}){
  super(message,{cause});this.name='AppError';this.code=code;this.params=params;
 }
}
export const appError=(code,message,params={},cause)=>new AppError(code,params,message,{cause});
export function errorIssue(error){
 if(typeof error?.code==='string'&&(error.code.startsWith('error.')||['emptyDeck','external'].includes(error.code)))
  return {code:error.code,params:error.params||{},...(error.message||error.fallback?{fallback:error.message||error.fallback}:{})};
 return {code:'external',params:{message:String(error?.message||error)}};
}
export function rowError(error,{line,query}){
 const code=query===undefined?'error.row':'error.rowCard';
 return new AppError(code,{line,...(query===undefined?{}:{card:query}),error:errorIssue(error)},query===undefined?'Riga '+line+': '+error.message:'Riga '+line+' ('+query+'): '+error.message,{cause:error});
}
export function deckErrors(errors){
 const issues=errors.map(error=>rowError(new AppError(error.code,{},error.message),{line:error.line}));
 return new AppError('error.list',{errors:issues.map(errorIssue)},issues.map(error=>error.message).join('; '));
}
