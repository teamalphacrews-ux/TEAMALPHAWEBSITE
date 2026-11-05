const router=require('express').Router();
router.use(require('../middleware/auth'),require('../middleware/requireAdmin'));
router.get('/',async(req,res)=>{
  res.set('Cache-Control','no-store');
  try {
    const groups=await require('../services/workspaceSearch').searchWorkspace(req.query.q,{
      Contact:require('../models/StudioContact'),Project:require('../models/StudioProject'),Lead:require('../models/Lead'),Quotation:require('../models/Quotation'),Invoice:require('../models/Invoice'),
    }, Object.entries({contacts:'/api/contacts',projects:'/api/studio-projects',enquiries:'/api/leads',quotations:'/api/studio/quotations',invoices:'/api/invoices'}).filter(([,path])=>!req.workspaceRole||require('../saas/access').requestAllowed(req.workspaceRole,'GET',path)).map(([kind])=>kind));
    res.json({groups});
  } catch(error) {res.status(error.status||503).json({error:error.status?error.message:'Workspace search is temporarily unavailable.'});}
});
module.exports=router;
