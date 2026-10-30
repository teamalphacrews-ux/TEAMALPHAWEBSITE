function pushDestination(value) {
 if(typeof value!=='string'||value.length>600||/[\\\r\n]/.test(value)||!value.startsWith('/admin'))return '/admin';
 try{
  const u=new URL(value,'https://studio.invalid');
  if(u.origin!=='https://studio.invalid'||!/^\/admin(?:\/(?:crm|studio-projects|quotations|invoices|calendar|post-production|chats|finance|activity-log)(?:\/[a-f\d]{24}|\/new)?)?$/.test(u.pathname))return '/admin';
  const p=new URLSearchParams();
  for(const k of ['lead','event','quote','invoice','project','task']){const id=u.searchParams.get(k);if(id&&/^[a-f\d]{24}$/i.test(id))p.set(k,id);}
  if(u.pathname==='/admin/finance'&&u.searchParams.get('view')==='due')p.set('view','due');
  return u.pathname+(p.size?'?'+p:'');
 }catch{return '/admin';}
}
module.exports={pushDestination};
