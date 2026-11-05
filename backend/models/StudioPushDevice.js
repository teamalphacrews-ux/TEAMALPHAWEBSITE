const mongoose = require('mongoose');
const schema = new mongoose.Schema({
 tokenHash:{type:String,required:true,unique:true,select:false}, encryptedToken:{type:String,required:true,select:false},
 installationId:{type:String,required:true,index:true}, workspaceKey:{type:String,required:true,index:true},
 userId:{type:String,required:true,index:true}, sessionId:{type:String,required:true},
 enabled:{type:Boolean,default:true}, lastSeenAt:{type:Date,default:Date.now}, lastNotificationId:String,
 expiresAt:{type:Date,required:true,index:{expires:0}},
},{timestamps:true});
schema.index({installationId:1,workspaceKey:1,userId:1});
module.exports = mongoose.connection.models.StudioPushDevice || mongoose.connection.model('StudioPushDevice',schema);
