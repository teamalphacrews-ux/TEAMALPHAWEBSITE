const fields = {
  contacts: ['firstName','lastName','company','email','phone'],
  projects: ['name','type','location'],
  enquiries: ['name','email','phone','eventLocation'],
  quotations: ['documentNumber','clientName','title','email'],
  invoices: ['invoiceNumber','clientName','clientEmail','title'],
};
function parseSearch(value) {
  if (typeof value !== 'string' || value.trim().length > 80) throw Object.assign(new Error('Enter a search of 2–80 characters.'), {status:400});
  return value.trim();
}
function searchFilter(kind, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return {$or: fields[kind].map(key => ({[key]: new RegExp(escaped,'i')}))};
}
async function searchWorkspace(text, models, allowedKinds=Object.keys(fields)) {
  const query = parseSearch(text);
  if (query.length < 2) return [];
  const limit=6;
  const specs = [
    ['contacts',models.Contact,'firstName lastName company email phone', row=>({label:[row.firstName,row.lastName].filter(Boolean).join(' '),subtitle:row.company||row.email,path:'/admin/contacts/'+row._id})],
    ['projects',models.Project,'name type status startDate', row=>({label:row.name,subtitle:[row.type,row.status].filter(Boolean).join(' · '),path:'/admin/studio-projects/'+row._id})],
    ['enquiries',models.Lead,'name status eventType',row=>({label:row.name,subtitle:[row.eventType,row.status].filter(Boolean).join(' · '),path:'/admin/crm?lead='+row._id})],
    ['quotations',models.Quotation,'documentNumber clientName title status',row=>({label:row.documentNumber||row.title||'Quotation',subtitle:row.clientName,path:'/admin/quotations?quote='+row._id})],
    ['invoices',models.Invoice,'invoiceNumber clientName documentStatus',row=>({label:row.invoiceNumber||'Invoice',subtitle:row.clientName,path:'/admin/invoices/'+row._id})],
  ];
  const groups=await Promise.all(specs.filter(([kind])=>allowedKinds.includes(kind)).map(async([kind,Model,selection,format])=>{
    const rows=await Model.find(searchFilter(kind,query)).select(selection).sort({updatedAt:-1}).limit(limit).maxTimeMS(2500).lean();
    return {kind,results:rows.map(row=>({id:String(row._id),...format(row)}))};
  }));
  return groups;
}
module.exports={parseSearch,searchFilter,searchWorkspace};
