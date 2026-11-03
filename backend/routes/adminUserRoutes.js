const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AdminSettings = require('../models/AdminSettings');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const bcrypt = require('bcryptjs');
const { assertOwner } = require('../services/studioSecurity');
const modules = require('../utils/moduleAccess');
const { parseAdminUserInput, emailPattern } = require('../utils/adminUserInput');
const requireOwner = async (req,res,next) => { try { await assertOwner(req.user.id); next(); } catch(e) { res.status(e.status||503).json({msg:e.status?e.message:'Account permission checks are unavailable.'}); } };
const requireTeam = (req,res,next) => modules.canManageTeam(req.user) ? next() : res.status(403).json({msg:'Team management access required.'});
const wrap = fn => async (req,res) => { try { await fn(req,res); } catch(e) { res.status(e.status||(e.code===11000?409:503)).json({msg:e.status?e.message:e.code===11000?'An account already uses this email address.':'The account change could not be completed.'}); } };
const validId = id => { if(!/^[a-f\d]{24}$/i.test(id||'')) throw Object.assign(new Error('Invalid team member.'),{status:400}); return id; };
const publicMember = user => {
  const raw=user.toObject?.()||user;
  const fields=['_id','firstName','lastName','email','role','accountDisabled','workspaceDataVersion','createdAt','updatedAt'];
  return {...Object.fromEntries(fields.filter(key=>raw[key]!==undefined).map(key=>[key,raw[key]])),...modules.accessPayload(raw)};
};
async function revokeSessions(req,userId) {
  for(const socket of req.app?.get('io')?.sockets?.sockets?.values?.()||[]) if(String(socket.user?.id)===String(userId))socket.disconnect(true);
  await require('../models/AdminSession').updateMany({user:userId},{$set:{revokedAt:new Date()}});
}
// Passwords, provider tokens and delivery credentials never belong in a team directory.
router.get('/',auth,requireAdmin,requireTeam,wrap(async(req,res)=>{
  const users=await User.find(modules.isStudioOwner(req.user)?{}:{role:'admin'}).sort({createdAt:-1});
  res.set?.('Cache-Control','no-store');res.json(users.map(publicMember));
}));
router.post('/create',auth,requireAdmin,requireTeam,wrap(async(req,res)=>{
  const values=parseAdminUserInput(req.body),role=values.role||'admin';
  modules.assertTeamEmail(values.email);
  if(role!=='admin'&&!modules.isStudioOwner(req.user))return res.status(403).json({msg:'Only the studio owner can manage legacy client accounts.'});
  const moduleAccess=role==='admin'?modules.assertGrant(req.user,Object.hasOwn(values,'moduleAccess')?values.moduleAccess:[...modules.MODULE_IDS]):null;
  if(await User.findOne({email:{$regex:emailPattern(values.email),$options:'i'}}))return res.status(409).json({msg:'An account already uses this email address.'});
  const user=await new User({firstName:values.firstName,lastName:values.lastName,email:values.email,password:await bcrypt.hash(values.password,12),role,moduleAccess}).save();
  res.status(201).json({msg:'Team member created successfully',user:publicMember(user)});
}));
router.put('/:id',auth,requireAdmin,requireTeam,wrap(async(req,res)=>{
  const update=parseAdminUserInput(req.body,{partial:true});
  if(update.email!==undefined)modules.assertTeamEmail(update.email);
  const user=await User.findById(validId(req.params.id)).select('+sessionVersion');
  if(!user)return res.status(404).json({msg:'User not found'});
  modules.assertManagedTarget(req.user,user);
  if(user.accountDisabled && !modules.isStudioOwner(req.user)) return res.status(403).json({msg:'Only the studio owner can reactivate a restored account.'});
  if(update.role!==undefined&&update.role!==user.role)return res.status(403).json({msg:'Account roles cannot be changed through Team & access.'});
  if(update.email&&await User.findOne({_id:{$ne:user._id},email:{$regex:emailPattern(update.email),$options:'i'}}))return res.status(409).json({msg:'An account already uses this email address.'});
  if(update.moduleAccess!==undefined){if(user.role!=='admin')return res.status(400).json({msg:'Only studio team accounts use module access.'});user.moduleAccess=modules.assertGrant(req.user,update.moduleAccess);}
  for(const field of ['firstName','lastName','email'])if(update[field]!==undefined)user[field]=update[field];
  if(update.password){user.accountDisabled=false;user.password=await bcrypt.hash(update.password,12);user.vaultPassword=undefined;user.iv=undefined;}
  user.sessionVersion=(user.sessionVersion||0)+1;
  await user.save();await revokeSessions(req,user._id);
  res.json({msg:'Team member updated successfully',user:publicMember(user)});
}));
router.post('/update-master',auth,requireAdmin,requireOwner,async(req,res)=>{
  const {currentPassword,newPassword}=req.body||{};
  if(typeof currentPassword!=='string'||typeof newPassword!=='string'||newPassword.length<8||newPassword.length>256)return res.status(400).json({msg:'Use a master password between 8 and 256 characters.'});
  try{
    const settings=await AdminSettings.findOne();if(!settings)return res.status(404).json({msg:'Master password not setup'});
    if(!await bcrypt.compare(currentPassword,settings.masterPasswordHash))return res.status(400).json({msg:'Current master password incorrect'});
    settings.masterPasswordHash=await bcrypt.hash(newPassword,12);settings.lastUpdated=Date.now();await settings.save();res.json({msg:'Master password updated successfully'});
  }catch{res.status(500).json({msg:'Master password update failed'});}
});
router.delete('/:id',auth,requireAdmin,requireTeam,wrap(async(req,res)=>{
  const user=await User.findById(validId(req.params.id)).select('+sessionVersion');
  if(!user)return res.status(404).json({msg:'User not found'});
  modules.assertManagedTarget(req.user,user);
  // Increment before revocation/deletion so a partially failed request fails closed.
  user.sessionVersion=(user.sessionVersion||0)+1;await user.save();await revokeSessions(req,user._id);
  await User.findByIdAndDelete(user._id);res.json({msg:'Team member removed'});
}));
module.exports=router;
