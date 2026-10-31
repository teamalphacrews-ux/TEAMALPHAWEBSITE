#!/usr/bin/env node
'use strict';
const fs=require('node:fs'), path=require('node:path'), {execFileSync}=require('node:child_process');
const {configurationKeys,validateConfig,validateATS,validateDNS,validateSourceInfo}=require('./release-policy.cjs');
const root=path.resolve(__dirname,'../..');
const run=(exe,args,options={})=>execFileSync(exe,args,{cwd:root,encoding:'utf8',...options});
const plist=file=>JSON.parse(run('/usr/bin/plutil',['-convert','json','-o','-',path.resolve(file)]));
function parse(argv) {
  const options={};
  for(let i=0;i<argv.length;i++) {
    const key=argv[i];
    if(['--archive','--build-environment','--help'].includes(key)) options[key]=true;
    else if(['--xcconfig','--settings','--app-info','--team','--archive-path'].includes(key)&&argv[i+1]&&!argv[i+1].startsWith('--')) options[key]=argv[++i];
    else throw Error('Unknown or incomplete argument: '+key);
  }
  if(options['--archive']&&(options['--settings']||options['--app-info']||options['--build-environment'])) throw Error('Archive requires settings resolved directly by Xcode.');
  if(options['--build-environment']&&Object.keys(options).length!==1) throw Error('Build environment takes no other arguments.');
  return options;
}
const assertNoErrors=errors=>{if(errors.length)throw Error(errors.map(x=>'• '+x).join('\n'));};
function xcodeArguments(options) {
  const args=['-project',path.join(root,'ios/StudioOS.xcodeproj'),'-scheme','StudioOS','-configuration','Release','-destination','generic/platform=iOS','-derivedDataPath',path.join(root,'ios/build/ReleaseDerivedData')];
  if(options['--xcconfig'])args.push('-xcconfig',path.resolve(options['--xcconfig']));
  if(options['--team']) {if(!/^[A-Z0-9]{10}$/.test(options['--team']))throw Error('Use the 10-character Apple team identifier.');args.push('DEVELOPMENT_TEAM='+options['--team']);}
  return args;
}
async function main(argv=process.argv.slice(2),env=process.env) {
  const options=parse(argv);
  if(options['--help']) {console.log('node ios/scripts/release-preflight.cjs [--xcconfig private.xcconfig] [--team TEAMID] [--archive --archive-path new.xcarchive]\nInspection: --settings settings.json [--app-info built/Info.plist], or --app-info built/Info.plist\nXcode only: --build-environment');return;}
  const xcode=env.DEVELOPER_DIR?path.join(env.DEVELOPER_DIR,'usr/bin/xcodebuild'):'/usr/bin/xcodebuild';
  let settings,info;
  if(options['--build-environment']) {
    settings=env;
    if(settings.CONFIGURATION!=='Release'||!settings.INFOPLIST_FILE)throw Error('Signed archives require resolved Release configuration.');
    info=plist(path.resolve(env.SRCROOT||path.join(root,'ios'),settings.INFOPLIST_FILE));
  } else if(options['--app-info']&&!options['--settings']) {
    info=plist(options['--app-info']);settings=info;
  } else {
    const entries=JSON.parse(options['--settings']?fs.readFileSync(path.resolve(options['--settings']),'utf8'):run(xcode,[...xcodeArguments(options),'CODE_SIGNING_ALLOWED=NO','-showBuildSettings','-json']));
    const targets=Array.isArray(entries)?entries.filter(x=>x.target==='StudioOS'):[];
    if(targets.length!==1||!targets[0].buildSettings)throw Error('Expected one StudioOS target in Xcode settings.');
    settings=targets[0].buildSettings;
    if(settings.CONFIGURATION!=='Release')throw Error('Release settings required.');
    info=options['--app-info']?plist(options['--app-info']):plist(path.resolve(settings.SRCROOT||path.join(root,'ios'),settings.INFOPLIST_FILE));
  }
  const result=validateConfig(settings), errors=[...result.errors,...validateATS(info)];
  if(options['--app-info']) {
    errors.push(...validateConfig(info).errors);
    if(options['--settings'])for(const key of configurationKeys)if(String(info[key])!==String(settings[key]))errors.push('Built app differs from settings: '+key);
  }
  if(!options['--app-info'])errors.push(...validateSourceInfo(info,settings));
  assertNoErrors(errors);assertNoErrors(await validateDNS(result));
  console.log('Beta configuration preflight passed. Backend/device acceptance and App Review evidence remain required.');
  if(!options['--archive'])return;
  if(!options['--team'])throw Error('Archive requires explicit --team.');
  const archive=path.resolve(options['--archive-path']||path.join(root,'ios/build/StudioOS-beta.xcarchive'));
  if(!archive.endsWith('.xcarchive')||fs.existsSync(archive))throw Error('Choose a new .xcarchive path.');
  run(xcode,[...xcodeArguments(options),'STUDIO_NODE_BINARY='+process.execPath,'-archivePath',archive,'archive'],{stdio:'inherit'});
  const app=path.join(archive,'Products/Applications/StudioOS.app'),built=plist(path.join(app,'Info.plist'));
  assertNoErrors([...validateConfig(built).errors,...validateATS(built)]);
  for(const key of configurationKeys)if(String(built[key])!==String(settings[key]))throw Error('Archive configuration changed: '+key);
  run('/usr/bin/codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
  console.log('Signed archive verified: '+archive+'. No upload performed.');
}
if(require.main===module)main().catch(e=>{console.error('Beta release blocked.\n'+e.message);process.exitCode=1;});
module.exports={main,parse,xcodeArguments};
