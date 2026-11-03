const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 kind:{type:String,enum:['manual','drive','pre-reset','pre-restore'],required:true},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 sourceCreatedAt:{type:Date,required:true},counts:{type:Map,of:Number},historicalAccounts:{type:Number,default:0},unresolvedReferences:{type:Number,default:0},bytes:{type:Number,required:true},
 encryptedBytes:{type:Number,required:true},chunkCount:{type:Number,required:true,min:1,max:64},
 checksum:{type:String,required:true},expiresAt:{type:Date,required:true,index:{expires:0}},
},{timestamps:true});
module.exports=mongoose.models.StudioArchive||mongoose.model('StudioArchive',schema);
