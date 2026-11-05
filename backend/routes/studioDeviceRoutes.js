const express=require('express');
const crypto=require('node:crypto');
const auth=require('../middleware/auth'), requireAdmin=require('../middleware/requireAdmin');
const Device=require('../models/StudioPushDevice');
const {pushConfigured,sealToken}=require('../services/studioPush');
const router=express.Router();
const workspace=req=>req.saas?String(req.saas.workspace._id):'legacy';
const installation=value=>typeof value==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
router.use(auth,requireAdmin);
router.get('/status',(req,res)=>res.json({configured:pushConfigured(),platform:'ios'}));
router.post('/',async(req,res)=>{
 if(!pushConfigured())return res.status(409).json({error:'Native push needs Apple APNs configuration on this server.'});
 if(!installation(req.body?.installationId)||typeof req.body?.token!=='string'||!/^[a-f\d]{64,200}$/i.test(req.body.token)||!req.sessionId)return res.status(400).json({error:'A valid app registration and signed-in session are required.'});
 try{
  await Device.init();
  const token=req.body.token.toLowerCase(), now=new Date();
  await Device.updateMany({installationId:req.body.installationId,tokenHash:{$ne:crypto.createHash('sha256').update(token).digest('hex')}},{$set:{enabled:false}});
  await Device.findOneAndUpdate({tokenHash:crypto.createHash('sha256').update(token).digest('hex')},{$set:{encryptedToken:sealToken(token),installationId:req.body.installationId,workspaceKey:workspace(req),userId:req.user.id,sessionId:req.sessionId,enabled:true,lastSeenAt:now,expiresAt:new Date(now.getTime()+30*86400000)}},{upsert:true,runValidators:true});
  res.json({registered:true,expiresInDays:30});
 }catch{res.status(503).json({error:'This phone could not register for push. Retry from device settings.'});}
});
router.delete('/:installationId',async(req,res)=>{
 if(!installation(req.params.installationId))return res.status(400).json({error:'Choose a valid app installation.'});
 try{await Device.updateMany({installationId:req.params.installationId,userId:req.user.id,workspaceKey:workspace(req),sessionId:req.sessionId},{$set:{enabled:false}});res.json({registered:false});}
 catch{res.status(503).json({error:'Device notifications could not be disconnected. Retry.'});}
});
module.exports=router;
