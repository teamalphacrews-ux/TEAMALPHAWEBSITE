const identifier = value => String(value?._id || value || '');
function projectLead(project, candidates) {
  const projectId = identifier(project._id), contactId = identifier(project.contactId), explicit = identifier(project.leadId);
  const linked = candidates.filter(lead => {
    const reverse = identifier(lead.studioProjectId);
    if (reverse && reverse !== projectId) return false;
    if (identifier(lead.contactId) && identifier(lead.contactId) !== contactId) return false;
    return reverse === projectId || (explicit && explicit === identifier(lead._id));
  });
  const unique = [...new Map(linked.map(lead => [identifier(lead._id), lead])).values()];
  if (unique.length !== 1 || (explicit && explicit !== identifier(unique[0]._id))) return null;
  return unique[0];
}
function projectCrew(names, roster) {
  return [...new Set((names || []).filter(name => typeof name === 'string' && name.trim()).map(name => name.trim()))].map(name => {
    const matches = roster.filter(person => person.name === name);
    return matches.length === 1 ? { _id:matches[0]._id, name, specialty:matches[0].specialty, email:matches[0].email || '', phone:matches[0].phone || '' } : { name, unresolved:true };
  });
}
module.exports = { identifier, projectLead, projectCrew };
