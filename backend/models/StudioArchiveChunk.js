const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 archive:{type:mongoose.Schema.Types.ObjectId,ref:'StudioArchive',required:true,index:true},
 index:{type:Number,required:true,min:0,max:63},data:{type:String,required:true,select:false},
 expiresAt:{type:Date,required:true,index:{expires:0}},
});
schema.index({archive:1,index:1},{unique:true});
module.exports=mongoose.models.StudioArchiveChunk||mongoose.model('StudioArchiveChunk',schema);
