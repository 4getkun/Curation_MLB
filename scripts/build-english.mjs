// Optional additive build after unchanged Japanese build; no collection/install/deployment.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist'),output=path.join(dist,'en'),locale=path.join(root,'locales/en'),overlay=path.join(locale,'overlay');
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitBlob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
const regularFiles=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?regularFiles(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:[]);
const optionalSkip=message=>Object.assign(new Error(message),{englishOptional:true});
const readReviewInput = p => { try { return fs.readFileSync(p); } catch (error) { if (error.code === 'ENOENT') throw optionalSkip(`Review input missing: ${path.relative(root,p)}; English review required`); throw error; } };
const entryExists = p => { try { fs.lstatSync(p); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
let stage;
try {
  // Only remove a previous generated English tree. Never overwrite unknown existing files.
  if(entryExists(output)){
    if(!fs.lstatSync(output).isDirectory()||fs.lstatSync(output).isSymbolicLink())throw Error('Unrecognized non-directory or symlink dist/en; refusing to overwrite');
    const marker=path.join(output,'.english-build.json');
    if(!fs.existsSync(marker)||JSON.parse(fs.readFileSync(marker,'utf8')).producer!=='curation-mlb-english-v1')throw Object.assign(Error('Unrecognized existing dist/en; refusing to overwrite'),{fatal:true});
    fs.rmSync(output,{recursive:true,force:true});
  }
  if(!fs.existsSync(path.join(dist,'index.html')))throw Error('Run the original Japanese build first');
  const guard=JSON.parse(readReviewInput(path.join(locale,'guard.json')).toString('utf8'));
  const sourceCodePaths=regularFiles(path.join(root,'src')).filter(p=>/\.(astro|ts|js|mjs|css)$/.test(p)).map(p=>path.relative(root,p).split(path.sep).join('/')).sort();
  if(JSON.stringify(sourceCodePaths)!==JSON.stringify(guard.sourceCodePaths))throw optionalSkip('Source file set changed; English review required');
  for(const item of guard.guardFiles)if(gitBlob(readReviewInput(path.join(root,item.path)))!==item.sha1)throw optionalSkip(`Source drift in ${item.path}; English review required`);
  for(const item of guard.installationFiles)if(sha256(readReviewInput(path.join(root,item.path)))!==item.sha256)throw optionalSkip(`Locale scan isolation drift in ${item.path}; English review required`);
  for(const item of guard.overlayFiles)if(sha256(readReviewInput(path.join(overlay,item.path)))!==item.sha256)throw optionalSkip(`English overlay hash mismatch: ${item.path}`);
  const inputData=regularFiles(path.join(root,'src/data')).map(p=>({relative:path.relative(root,p),sha256:sha256(fs.readFileSync(p))}));
  const news=JSON.parse(fs.readFileSync(path.join(root,'src/data/news.json'),'utf8'));
  const expectedIndex=news.items.map(i=>({title:i.title,summary:i.summary,titleJa:i.titleJa,summaryJa:i.summaryJa,link:i.link,pubDate:i.pubDate,source:i.source,teams:i.teams,players:i.players??[],topics:i.topics??[],sourceCount:i.sources?.length??1}));
  const builtIndex=JSON.parse(fs.readFileSync(path.join(dist,'data/news-index.json'),'utf8'));
  if(JSON.stringify(expectedIndex)!==JSON.stringify(builtIndex))throw optionalSkip('Japanese output and current news data differ; rebuild Japanese first');
  stage=fs.mkdtempSync(path.join(root,'.locale-en-'));
  for(const dir of ['src','public'])fs.cpSync(path.join(root,dir),path.join(stage,dir),{recursive:true,filter:src=>src!==path.join(root,'public/en')&&!src.startsWith(path.join(root,'public/en')+path.sep)});
  for(const file of ['package.json','package-lock.json','astro.config.mjs','tsconfig.json'])fs.copyFileSync(path.join(root,file),path.join(stage,file));
  for(const item of guard.overlayFiles){const target=path.join(stage,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(overlay,item.path),target);}
  fs.symlinkSync(path.join(root,'node_modules'),path.join(stage,'node_modules'),'junction');
  const child=spawnSync(process.execPath,[path.join(root,'node_modules/astro/bin/astro.mjs'),'build','--root',stage],{cwd:root,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
  if(child.status!==0)throw optionalSkip(`English build failed (${child.status??child.error}); original Japanese artifact retained`);
  for(const data of inputData)if(sha256(fs.readFileSync(path.join(root,data.relative)))!==data.sha256)throw optionalSkip(`Data changed during build: ${data.relative}; do not merge mismatched locales`);
  const englishDist=path.join(stage,'dist');
  // Clients use the original current endpoint: do not ship a second English JSON feed.
  fs.rmSync(path.join(englishDist,'data'),{recursive:true,force:true});fs.rmSync(path.join(englishDist,'robots.txt'),{force:true});
  const englishHTML=regularFiles(englishDist).filter(p=>p.endsWith('.html')),japaneseHTML=regularFiles(dist).filter(p=>p.endsWith('.html'));
  const shape=(files,base)=>files.map(p=>path.relative(base,p)).sort();
  if(JSON.stringify(shape(englishHTML,englishDist))!==JSON.stringify(shape(japaneseHTML,dist)))throw optionalSkip('English route coverage differs from Japanese');
  for(const p of englishHTML)if(!fs.readFileSync(p,'utf8').includes('<html lang="en"'))throw optionalSkip(`Non-English locale metadata: ${p}`);
  fs.writeFileSync(path.join(englishDist,'.english-build.json'),JSON.stringify({producer:'curation-mlb-english-v1',sourceGeneratedAt:news.generatedAt,sourceNewsSha256:sha256(fs.readFileSync(path.join(root,'src/data/news.json'))),sharedDataUrl:'/mlb-news/data/news-index.json',sourcePinForUI:guard.sourcePin},null,2)+'\n');
  fs.renameSync(englishDist,output); // Atomic merge: a failed optional build never publishes a partial English tree.
  console.log(`[English locale built] ${englishHTML.length-1} routes + offline page, source timestamp ${news.generatedAt}; shared current data, no new collection.`);
} catch(error){console.warn(`[English locale ${error.englishOptional?"skipped":"error"}] ${error.message}. Japanese output is unchanged.`);if(!error.englishOptional)process.exitCode=1;} finally {if(stage)fs.rmSync(stage,{recursive:true,force:true});}
