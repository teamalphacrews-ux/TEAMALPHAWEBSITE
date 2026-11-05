export function createButtonActionGuard() {
  let locked=false;
  const release=()=>{locked=false;};
  return {run(event,action,unavailable=false){
    if(unavailable||locked){event?.preventDefault?.();event?.stopPropagation?.();return {accepted:false,result:undefined};}
    locked=true;
    try{const result=action?.(event);if(result&&typeof result.then==='function')Promise.resolve(result).then(release,release);else queueMicrotask(release);return {accepted:true,result};}
    catch(error){release();throw error;}
  }};
}
