const router=require('express').Router(),multer=require('multer');
const Finance=require('../models/Finance'),Receipt=require('../models/FinanceReceipt');
const {validateCover}=require('./documentCoverRoutes');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:4*1024*1024,files:1,fields:0,parts:2}}).single('receipt');
const valid=id=>/^[a-f\d]{24}$/i.test(id);
router.use(require('../middleware/auth'),require('../middleware/requireAdmin'));
router.get('/ledger/:id/receipt',async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!valid(req.params.id))return res.sendStatus(404);
 try{if(!await Finance.exists({_id:req.params.id,type:'expense'}))return res.sendStatus(404);const file=await Receipt.findOne({financeId:req.params.id}).select('+data');if(!file)return res.sendStatus(404);res.set({'Content-Type':file.mimeType,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':'inline; filename="receipt.'+(file.mimeType==='image/png'?'png':file.mimeType==='image/webp'?'webp':'jpg')+'"'});res.send(file.data);}
 catch{res.status(503).json({error:'The receipt could not be opened.'});}
});
router.post('/ledger/:id/receipt',(req,res)=>{
 if(!valid(req.params.id))return res.status(404).json({error:'Expense not found.'});
 upload(req,res,async error=>{
  if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:'Choose one receipt image no larger than 4 MB.'});
  try{
   if(!await Finance.exists({_id:req.params.id,type:'expense'}))return res.status(404).json({error:'Expense not found.'});
   validateCover(req.file);
   await Receipt.findOneAndUpdate({financeId:req.params.id},{$set:{mimeType:req.file.mimetype,bytes:req.file.size,data:req.file.buffer,uploadedBy:req.user.id}},{upsert:true,runValidators:true});
   const receipt={mimeType:req.file.mimetype,bytes:req.file.size,updatedAt:new Date()};
   await Finance.updateOne({_id:req.params.id,type:'expense'},{$set:{receipt}});
   res.status(201).json({receipt});
  }catch(failure){res.status(failure.status||503).json({error:failure.status?failure.message:'The expense exists, but the receipt was not attached. Retry attaching it.'});}
 });
});
module.exports=router;
