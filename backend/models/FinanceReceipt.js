const mongoose=require('mongoose');
const schema=new mongoose.Schema({financeId:{type:mongoose.Schema.Types.ObjectId,ref:'Finance',required:true,unique:true},mimeType:{type:String,enum:['image/jpeg','image/png','image/webp'],required:true},bytes:{type:Number,required:true,max:4194304},data:{type:Buffer,required:true,select:false},uploadedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},{timestamps:true});
module.exports=mongoose.models.FinanceReceipt||mongoose.model('FinanceReceipt',schema);
