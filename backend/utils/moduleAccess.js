const MODULE_IDS = Object.freeze(['overview','enquiries','projects','quotations','invoices','finance','contacts','calendar','crew','production','support','email','whatsapp','settings','data','activity','integrations','team','galleries']);
const ids = new Set(MODULE_IDS);
const fail = (message,status=403) => Object.assign(new Error(message),{status});
function parseModuleAccess(value) {
  if(value===null)return null;
  if(!Array.isArray(value)||value.length>MODULE_IDS.length||value.some(id=>typeof id!=='string'||!ids.has(id))||new Set(value).size!==value.length)throw fail('Choose valid, unique studio modules.',400);
  return MODULE_IDS.filter(id=>value.includes(id));
}
function isStudioOwner(user,{env=process.env,workspace=require('../saas/tenantContext').currentWorkspace()}={}) {
  return !!(user?.role==='admin'&&(user.studioOwner===true||(!workspace&&typeof env.ADMIN_EMAIL==='string'&&env.ADMIN_EMAIL.trim()&&(typeof user.email === 'string' ? user.email.trim().toLowerCase() : '')===env.ADMIN_EMAIL.trim().toLowerCase())));
}
function accessFor(user) {
  if(isStudioOwner(user)||user?.moduleAccess==null)return null;
  try{return parseModuleAccess(user.moduleAccess);}catch{return [];}
}
const hasFullAccess = user=>user?.role==='admin'&&accessFor(user)===null;
const hasModule = (user,id)=>user?.role==='admin'&&(hasFullAccess(user)||accessFor(user).includes(id));
const canManageTeam = user=>hasModule(user,'team');
const accessPayload = user=>({moduleAccess:user?.role==='admin'?accessFor(user):[],studioOwner:isStudioOwner(user),canManageTeam:canManageTeam(user)});
function assertGrant(actor,requested) {
  if(!canManageTeam(actor))throw fail('Team management access required.');
  const parsed=parseModuleAccess(requested);
  if(!hasFullAccess(actor)&&(parsed===null||parsed.some(id=>!hasModule(actor,id))))throw fail('You can grant only modules available to your account.');
  return parsed;
}
function assertManagedTarget(actor,target) {
  if(!canManageTeam(actor))throw fail('Team management access required.');
  if(String(actor.id||actor._id)===String(target._id||target.id))throw fail('Use your profile to update your own account. Team access cannot be changed for yourself.');
  if(isStudioOwner(target))throw fail('The studio owner account cannot be changed from Team & access.');
  if(!isStudioOwner(actor)&&target.role!=='admin')throw fail('Only the studio owner can manage legacy client accounts.');
  if(!hasFullAccess(actor)){const scope=accessFor(target);if(scope===null||scope.some(id=>!hasModule(actor,id)))throw fail('This member has access beyond your account. Ask the studio owner to manage them.');}
}
function assertTeamEmail(email, env=process.env) {
  const reserved=typeof env.ADMIN_EMAIL==='string'?env.ADMIN_EMAIL.trim().toLowerCase():'';
  if(reserved&&typeof email==='string'&&email.trim().toLowerCase()===reserved)throw fail('This email is reserved for the studio owner. Choose a different team email.',400);
}
function pathname(req) {
  try{const path=decodeURIComponent(String(req.originalUrl||req.url||'').split('?')[0]);if(path.includes('\\')||path.includes('\0')||path.includes('//')||/(?:^|\/)\.\.?(?:\/|$)/.test(path))return '';return path.replace(/\/+$/,'').toLowerCase();}catch{return '';}
}
const under=(path,prefix)=>path===prefix||path.startsWith(prefix+'/');
function requestAllowed(user,req) {
  if(user?.role!=='admin'||hasFullAccess(user))return true;
  const path=pathname(req),method=String(req.method||'GET').toUpperCase();
  if(['/api/auth/me','/api/auth/profile','/api/studio/preferences','/api/studio/security/access','/api/studio/security/activity','/api/studio/security/logout','/api/studio/security/sessions','/api/studio/security/sessions/revoke-all'].includes(path)||/^\/api\/studio\/security\/sessions\/[a-f\d]{24}$/.test(path))return true;
  // Cross-module/opaque aggregates fail closed, including future unknown APIs.
  if(['/api/dashboard','/api/notifications','/api/studio/search','/api/google-sheets','/api/studio/devices','/api/chats','/api/finance'].some(prefix=>under(path,prefix)))return false;
  if(/\/(?:export|exports|backup|backups|recovery)(?:\/|$)/.test(path))return false;
  if(under(path,'/api/studio/security')||path==='/api/admin-users/update-master'||under(path,'/api/saas'))return false;
  // Accepted-quote capabilities also authorize invoice, production and support.
  if(/^\/api\/studio\/quotations\/[^/]+\/(?:client-link|share|email|email-history|schedule)(?:\/|$)/.test(path))return false;
  if(/^\/api\/studio\/quotations\/[^/]+\//.test(path)&&!['GET','HEAD'].includes(method))return false;
  if(path==='/api/studio/settings'&&method==='GET')return true;
  if(path==='/api/studio/document-covers')return ['settings','quotations','invoices'].some(id=>hasModule(user,id));
  const routes=[['enquiries','/api/leads'],['projects','/api/studio-projects'],['quotations','/api/studio/quotations','/api/studio/quote-templates','/api/studio/document-covers'],['invoices','/api/invoices'],['finance','/api/finance','/api/studio/finance','/api/studio/ledger','/api/studio/booking-payments'],['contacts','/api/contacts','/api/contact-documents','/api/studio/clients'],['calendar','/api/calendar','/api/auth/google'],['crew','/api/photographers'],['production','/api/tasks'],['support','/api/project-support','/api/chats'],['email','/api/integrations/gmail','/api/studio/email'],['whatsapp','/api/integrations/whatsapp'],['settings','/api/studio/settings','/api/studio/profile-images'],['data','/api/studio/assets'],['integrations','/api/webhooks/enquiries/status','/api/integrations/assistants'],['team','/api/admin-users'],['galleries','/api/gallery','/api/drive-gallery','/api/media']];
  const match=routes.find(([, ...prefixes])=>prefixes.some(prefix=>under(path,prefix)));
  if(!match||!hasModule(user,match[0]))return false;
  if(/^\/api\/leads\/[^/]+\/project$/.test(path)&&!hasModule(user,'projects'))return false;
  if(/^\/api\/leads\/[^/]+\/tasks$/.test(path)&&!hasModule(user,'production'))return false;
  if(/^\/api\/studio-projects\/[^/]+\/crew$/.test(path)&&!hasModule(user,'crew'))return false;
  if(under(path,'/api/studio/booking-payments')&&!hasModule(user,'enquiries'))return false;
  if(under(path,'/api/studio/clients')&&!['GET','HEAD'].includes(method))return false;
  return true;
}
const financeFields=['paymentStatus','totalAmount','depositAmount'];
const quoteFields=['quotationId','quotationStatus','quotationNumber'];
const galleryFields=['galleryTag','cloudLink','cloudPassword'];
function assertOperationalWrite(user,req) {
  if(hasFullAccess(user)||!req.body||typeof req.body!=='object')return;
  const path=pathname(req);
  if(!hasModule(user,'crew')&&((under(path,'/api/calendar')&&Object.hasOwn(req.body,'teamMembers'))||((under(path,'/api/tasks')||/^\/api\/leads\/[^/]+\/tasks$/.test(path))&&Object.hasOwn(req.body,'assignee'))))throw fail('Your account cannot change crew assignments.');
  if(!under(path,'/api/leads'))return;
  for(const [moduleId,fields]of [['finance',financeFields],['galleries',galleryFields],['crew',['people']],['production',['tasks']]])if(!hasModule(user,moduleId)&&fields.some(field=>Object.hasOwn(req.body,field)))throw fail('Your account cannot change fields from a hidden module.');
  if(req.body.createAccount)throw fail('Only the studio owner can provision legacy client accounts.');
}
function sanitizeOperational(value,user) {
  if(hasFullAccess(user)||value==null)return value;
  const raw=typeof value.toJSON==='function'?value.toJSON():value;
  if(Array.isArray(raw))return raw.map(item=>sanitizeOperational(item,user));
  if(raw instanceof Date||typeof raw!=='object'||raw._bsontype||Buffer.isBuffer(raw))return raw;
  const hidden=new Set(['password','passwordHash','vaultPassword','iv','cloudPassword','googleAccessToken','googleRefreshToken']);
  if(!hasModule(user,'finance'))financeFields.forEach(key=>hidden.add(key));
  if(!hasModule(user,'quotations'))[...quoteFields,'sourceQuotation'].forEach(key=>hidden.add(key));
  if(!hasModule(user,'invoices'))['invoiceId','invoiceGeneratedAt','invoiceReady'].forEach(key=>hidden.add(key));
  if(!hasModule(user,'galleries'))galleryFields.forEach(key=>hidden.add(key));
  if(!hasModule(user,'production'))hidden.add('tasks');
  if(!hasModule(user,'crew'))['people','teamMembers','assignee','crew','roster'].forEach(key=>hidden.add(key));
  return Object.fromEntries(Object.entries(raw).filter(([key])=>!hidden.has(key)).map(([key,item])=>[key,sanitizeOperational(item,user)]));
}
function safeSettings(value,user) {
  if(hasFullAccess(user)||value==null)return value;
  const raw=value.toObject?.()||value;
  const fields=new Set(['_id','studioName','legalName','gstin','profilePhotoUrl','logoUrl','whatsappNumber','whatsappMessage','instagramUrl','facebookUrl','email','phone','website','address','coverImage','colorTheme','fontTheme','currency','timezone']);
  if(hasModule(user,'quotations'))['quotationValidityDays','quotationTerms','defaultDeliverables','billingDefaults','automation','communication','clientLinkDefaults'].forEach(key=>fields.add(key));
  if(hasModule(user,'invoices'))['invoicePrefix','billingDefaults','automation','communication','clientLinkDefaults'].forEach(key=>fields.add(key));
  if(['finance','quotations','invoices'].some(id=>hasModule(user,id)))['paymentInstructions','bankDetails','upiId'].forEach(key=>fields.add(key));
  if(hasModule(user,'production'))fields.add('productionDefaults');
  return Object.fromEntries(Object.entries(raw).filter(([key])=>fields.has(key)));
}
function installResponseProjection(req,res) {
  if(req.moduleProjectionInstalled||hasFullAccess(req.user))return;
  req.moduleProjectionInstalled=true;const json=res.json;
  res.json=function(value){return json.call(this,sanitizeOperational(pathname(req)==='/api/studio/settings'?safeSettings(value,req.user):value,req.user));};
}
module.exports={MODULE_IDS,parseModuleAccess,isStudioOwner,accessFor,accessPayload,hasFullAccess,hasModule,canManageTeam,assertGrant,assertManagedTarget,assertTeamEmail,pathname,requestAllowed,assertOperationalWrite,sanitizeOperational,safeSettings,installResponseProjection};
