export async function prepareReceipt(file){
 if(!file||file.size>20*1024*1024||!file.type.startsWith('image/'))throw new Error('Choose a receipt photo smaller than 20 MB.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>80000000)throw new Error('Choose a smaller receipt image.');
  const scale=Math.min(1,2200/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  const context=canvas.getContext('2d');if(!context)throw new Error('Image preparation is unavailable.');
  context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
  if(!blob||blob.size>4*1024*1024)throw new Error('This receipt is too large. Choose a smaller image.');
  return new File([blob],'receipt.jpg',{type:'image/jpeg'});
 }catch(error){throw new Error(error.message||'This photo could not be opened. Choose a JPEG or PNG receipt.');}
 finally{URL.revokeObjectURL(url);}
}
