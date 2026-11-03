const router=require('express').Router(),multer=require('multer');
const auth=require('../middleware/auth'),requireAdmin=require('../middleware/requireAdmin'),service=require('../services/studioArchive'),codec=require('../utils/workspaceArchive');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:codec.MAX_UPLOAD_BYTES,files:1,fields:3,fieldSize:2048,parts:5}}).single('archive');
const requireOwner=async(req,res,next)=>{try{if(req.saas||require('../saas/tenantContext').currentWorkspace())throw require('../services/studioSecurity').fail('Workspace data operations are for the personal installation only.',403);await require('../services/studioSecurity').assertOwner(req.user.id);next();}catch(error){res.status(error.status||503).json({error:error.status?error.message:'Owner checks are unavailable.'});}};
router.use(auth,requireAdmin,requireOwner,(_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');next();});
const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(error){res.status(error.status||(error.code===11000?409:503)).json({error:error.status?error.message:'The workspace operation failed. No partial change was committed.'});}};
const args=req=>({actorId:req.user.id,password:req.body?.password,confirmation:req.body?.confirmation,currentSessionId:req.sessionId});
function uploaded(req,res,next){upload(req,res,error=>{if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:'Upload one encrypted workspace archive no larger than 48 MB.'});if(!req.file)return res.status(400).json({error:'Choose an encrypted workspace archive.'});try{req.archive=codec.parseUpload(req.file.buffer);next();}catch(error){res.status(error.status||400).json({error:error.message});}});}
function invalidate(req,result){const io=req.app.get('io');io?.to('admin').emit('workspace_data_changed',{dataVersion:result.dataVersion});for(const socket of io?.sockets?.sockets?.values?.()||[])socket.disconnect(true);}
router.get('/workspace-data',wrap(async(req,res)=>res.json(await service.getStatus(args(req)))));
router.get('/workspace-backups',wrap(async(req,res)=>res.json(await service.listBackups(args(req)))));
router.post('/workspace-backups',wrap(async(req,res)=>{const result=await service.createPortableArchive(args(req));res.status(201).json({backupId:result.backupId,summary:result.summary,...result.summary});}));
router.get('/workspace-backups/:id/download',wrap(async(req,res)=>{const archive=await service.readStoredArchive({actorId:req.user.id,backupId:req.params.id});res.set('Content-Disposition','attachment; filename="studio-workspace-'+req.params.id+'.teamalpha.json"');res.json(archive);}));
router.post('/workspace-restore/inspect',uploaded,wrap(async(req,res)=>res.json(await service.inspectPortableArchive({actorId:req.user.id,archive:req.archive}))));
router.post('/workspace-restore',uploaded,wrap(async(req,res)=>{const result=await service.restorePortableArchive({...args(req),archive:req.archive});invalidate(req,result);res.json(result);}));
router.post('/workspace-reset',wrap(async(req,res)=>{const result=await service.resetWorkspace(args(req));invalidate(req,result);res.json(result);}));
router.post('/workspace-resume',wrap(async(req,res)=>res.json(await service.resumeIntegrations(args(req)))));
module.exports=router;
