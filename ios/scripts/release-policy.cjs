'use strict';
const { isIP } = require('node:net');
const dns = require('node:dns/promises');
const configurationKeys = ['STUDIO_WEB_URL','STUDIO_API_URL','STUDIO_START_PATH','STUDIO_COMMERCIAL_BACKEND_VERIFIED','STUDIO_RELEASE_CHANNEL'];
const reserved = ['localhost','local','localdomain','lan','home','home.arpa','internal','intranet','corp','invalid','test','example','onion','example.com','example.net','example.org','teamalpha.photography','team-alpha-studio.onrender.com','team-alpha-api.onrender.com'];
function endpoint(value, label, errors) {
  try {
    const url = new URL(String(value || '')), host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.port && url.port !== '443')) throw new Error();
    if (isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || host.endsWith('.') || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || reserved.some(suffix => host === suffix || host.endsWith('.'+suffix))) throw new Error();
    return url;
  } catch { errors.push(label+' must be an owned commercial public HTTPS origin without credentials, path, query, fragment or custom port.'); return null; }
}
function validateConfig(values) {
  const errors = [], web = endpoint(values.STUDIO_WEB_URL,'STUDIO_WEB_URL',errors), api = endpoint(values.STUDIO_API_URL,'STUDIO_API_URL',errors);
  if (values.STUDIO_START_PATH !== '/studio-os/login') errors.push('STUDIO_START_PATH must be /studio-os/login.');
  if (![true,'true'].includes(values.STUDIO_COMMERCIAL_BACKEND_VERIFIED)) errors.push('Commercial backend verification must explicitly be true after recorded acceptance.');
  if (values.STUDIO_RELEASE_CHANNEL !== 'beta') errors.push('Only the beta release channel is permitted.');
  if (values.CONFIGURATION && values.CONFIGURATION !== 'Release') errors.push('Signed beta archives must use Release.');
  if (/(^|\s)DEBUG(\s|$)/.test(values.SWIFT_ACTIVE_COMPILATION_CONDITIONS||'') || /(^|\s)-D\s*DEBUG(\s|$)/.test(values.OTHER_SWIFT_FLAGS||'')) errors.push('Release cannot compile with DEBUG.');
  const minimum = String(values.IPHONEOS_DEPLOYMENT_TARGET || values.MinimumOSVersion || '');
  if (!/^\d+(\.\d+){0,2}$/.test(minimum) || Number(minimum.split('.')[0]) < 17) errors.push('Minimum iOS version must be 17 or later.');
  return {errors,web,api};
}
function validateATS(info) {
  const ats = info.NSAppTransportSecurity;
  if (ats === undefined) return [];
  if (!ats || typeof ats !== 'object' || Array.isArray(ats)) return ['ATS must be a dictionary.'];
  return ['NSAllowsArbitraryLoads','NSAllowsArbitraryLoadsInWebContent','NSAllowsArbitraryLoadsForMedia','NSAllowsLocalNetworking'].some(key=>Object.hasOwn(ats,key) && ats[key] !== false) || Object.keys(ats.NSExceptionDomains||{}).length ? ['Release cannot contain ATS exceptions or local networking allowances.'] : [];
}
function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const p = address.split('.').map(Number);
    return !(p[0]===0 || p[0]===10 || p[0]===127 || p[0]>=224 || (p[0]===100&&p[1]>=64&&p[1]<=127) || (p[0]===169&&p[1]===254) || (p[0]===172&&p[1]>=16&&p[1]<=31) || (p[0]===192&&(p[1]===168 || (p[1]===0&&(p[2]===0||p[2]===2)) || (p[1]===88&&p[2]===99))) || (p[0]===198&&(p[1]===18||p[1]===19||(p[1]===51&&p[2]===100))) || (p[0]===203&&p[1]===0&&p[2]===113));
  }
  if (isIP(address) === 6) {
    const v = address.toLowerCase(), parts=v.split(':'), first=parseInt(parts[0],16), second=parseInt(parts[1]||'0',16);
    return /^[23][a-f0-9]{3}:/.test(v) && !(first===0x2002 || (first===0x2001&&(second<0x200||second===0xdb8)) || (first===0x3fff&&second<0x1000));
  }
  return false;
}
async function validateDNS(result, lookup=dns.lookup) {
  const errors=[];
  if(result.errors.length) return errors;
  for(const host of new Set([result.web.hostname,result.api.hostname])) {
    try { const addresses=await lookup(host,{all:true,verbatim:true}); if(!addresses.length||addresses.some(x=>!isPublicAddress(x.address))) errors.push('DNS must resolve exclusively to public IPs: '+host); }
    catch { errors.push('DNS could not be verified: '+host); }
  }
  return errors;
}
function validateSourceInfo(info, settings) {
  const concrete={...info,MinimumOSVersion:settings.IPHONEOS_DEPLOYMENT_TARGET};
  for(const key of configurationKeys)if(concrete[key]==='$('+key+')')concrete[key]=settings[key];
  const errors=[...validateConfig(concrete).errors,...validateATS(info)];
  for(const key of configurationKeys)if(String(concrete[key])!==String(settings[key]))errors.push('Source plist differs from resolved configuration: '+key);
  return errors;
}
module.exports={configurationKeys,validateConfig,validateATS,isPublicAddress,validateDNS,validateSourceInfo};
