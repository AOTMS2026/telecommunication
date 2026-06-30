import { useState, useEffect } from 'react';
import { apiTemplatesAPI, workflowsAPI } from '../services/api';

const C={indigo:'var(--theme-primary-alt)',purple:'var(--theme-primary)',indigoBg:'var(--theme-surface-faint4)',border:'var(--theme-border-tint)',ink:'var(--theme-text-strongest)',sub:'#6b7280',green:'#059669',greenBg:'#ecfdf5',red:'#dc2626',redBg:'#fef2f2',amber:'#b45309'};
const card={background:'#fff',border:`1px solid ${C.border}`,borderRadius:12};
const btnP={padding:'8px 18px',borderRadius:8,border:'none',background:'var(--btn-gradient)',color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer'};
const btnG={padding:'7px 14px',borderRadius:8,border:`1.5px solid ${C.border}`,background:'#fff',color:C.ink,fontWeight:600,fontSize:13,cursor:'pointer'};
const inp={width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'};
const lbl={fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5,display:'block'};
const MAP_TYPES=['Text','Date','Number','Website','Dropdown','Money','Tags'];

// Flattens any JSON value into dot/array-index paths, e.g. {a:{b:[1,2]}} -> [{path:'a.b.0',value:1},{path:'a.b.1',value:2}]
function flattenJson(obj,prefix=''){
  let out=[];
  if(obj===null||obj===undefined) return out;
  if(Array.isArray(obj)){ obj.forEach((item,i)=>{out=out.concat(flattenJson(item,prefix?`${prefix}.${i}`:`${i}`))}); }
  else if(typeof obj==='object'){ Object.entries(obj).forEach(([k,v])=>{out=out.concat(flattenJson(v,prefix?`${prefix}.${k}`:k))}); }
  else out.push({path:prefix,value:obj});
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIST PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function ApiTemplates(){
  const [templates,setTemplates]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [leadsFor,setLeadsFor]=useState(null);

  const load=async()=>{setLoading(true);try{setTemplates((await apiTemplatesAPI.getAll()).data.templates)}catch(e){console.error(e)}setLoading(false)};
  useEffect(()=>{load()},[]);

  const blank=()=>({name:'',method:'POST',endpointUrl:'',timeout:3,headers:[{key:'Content-type',value:'application/json'}],bodyTemplate:{},queryParams:[],auth:{type:'none'},variablesUsed:[],responseMapping:[]});

  if(editing) return <TemplateEditor initial={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>;
  if(leadsFor) return <ImpactedLeads template={leadsFor} onClose={()=>setLeadsFor(null)}/>;

  return(
  <div style={{padding:'24px 28px',maxWidth:1180,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
      <div>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:C.ink}}>API Templates</h2>
        <p style={{margin:'4px 0 0',color:C.sub,fontSize:14}}>Create an API template once and use it everywhere</p>
      </div>
      <button style={btnP} onClick={()=>setEditing(blank())}>+ Create New</button>
    </div>
    {loading?<div style={{textAlign:'center',padding:50,color:C.sub}}>Loading…</div>:(
    <div style={{...card,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.1fr 1.7fr .8fr 1.1fr 1fr 1fr 1fr',padding:'12px 18px',background:'var(--theme-surface-faint2)',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase'}}>
        <span>Template Name</span><span>Endpoint URL</span><span>Variables Used</span><span>Workflow</span><span>Last Modified ↕</span><span>Last Modified By</span><span style={{textAlign:'right'}}>Actions</span>
      </div>
      {templates.length===0?<div style={{padding:40,textAlign:'center',color:C.sub}}>No API templates found, <span style={{color:C.indigo,cursor:'pointer',fontWeight:600}} onClick={()=>setEditing(blank())}>+ Create new</span></div>
      :templates.map((t,i)=>{
        const wfs=t.usedInWorkflows||[];
        return(
        <div key={t._id} style={{display:'grid',gridTemplateColumns:'1.1fr 1.7fr .8fr 1.1fr 1fr 1fr 1fr',padding:'14px 18px',alignItems:'center',borderBottom:i<templates.length-1?'1px solid var(--theme-surface-faint5)':'none'}}>
          <span style={{fontWeight:600,color:C.indigo,cursor:'pointer'}} onClick={()=>setEditing(t)}>{t.name}</span>
          <span style={{fontSize:12,color:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.endpointUrl}</span>
          <span style={{fontSize:13,color:C.sub}}>{t.variablesUsed?.length?t.variablesUsed.length:'None'}</span>
          <span style={{fontSize:13,color:C.sub}}>{wfs.length===0?'None':<>{wfs[0]?.name}{wfs.length>1&&<span style={{marginLeft:5,fontSize:11,padding:'1px 6px',borderRadius:10,background:C.indigoBg,color:C.indigo,fontWeight:700}}>+{wfs.length-1}</span>}</>}</span>
          <span style={{fontSize:13,color:C.sub}}>{new Date(t.updatedAt).toLocaleString()}</span>
          <span style={{fontSize:13,color:C.sub}}>{t.lastModifiedBy?.name||'—'}</span>
          <span style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
            <button style={{...btnG,padding:'5px 9px',fontSize:12}} title="Edit" onClick={()=>setEditing(t)}>✎</button>
            <button style={{...btnG,padding:'5px 9px',fontSize:12}} title="View Leads" onClick={()=>setLeadsFor(t)}>View Leads</button>
            <button style={{...btnG,padding:'5px 9px',fontSize:12,color:C.red,borderColor:'#fecaca'}} title="Delete" onClick={async()=>{if(confirm('Delete this API template?')){await apiTemplatesAPI.delete(t._id);load()}}}>🗑</button>
          </span>
        </div>);
      })}
    </div>)}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW LEADS — leads impacted by this template's executions
═══════════════════════════════════════════════════════════════════════════ */
function ImpactedLeads({template,onClose}){
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [field,setField]=useState('');
  const [value,setValue]=useState('');
  const fieldOptions=(template.responseMapping||[]).map(m=>m.label);

  const load=async()=>{
    setLoading(true);
    try{const params=field&&value?{field,op:'contains',value}:{};setLeads((await apiTemplatesAPI.getLeads(template._id,params)).data.leads)}catch(e){console.error(e)}
    setLoading(false);
  };
  useEffect(()=>{load()},[]);

  return(
  <div style={{padding:'24px 28px',maxWidth:1000,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div><div style={{fontSize:18,fontWeight:700,color:C.ink}}>Leads impacted — {template.name}</div><div style={{fontSize:13,color:C.sub}}>Filter leads by a mapped response field</div></div>
      <button style={btnG} onClick={onClose}>← Back</button>
    </div>
    {fieldOptions.length>0&&(
    <div style={{display:'flex',gap:10,marginBottom:16}}>
      <select value={field} onChange={e=>setField(e.target.value)} style={{...inp,maxWidth:200}}><option value="">Any field</option>{fieldOptions.map(f=><option key={f} value={f}>{f}</option>)}</select>
      <input value={value} onChange={e=>setValue(e.target.value)} placeholder="Contains…" style={{...inp,maxWidth:240}}/>
      <button style={btnP} onClick={load}>Apply</button>
    </div>)}
    {loading?<div style={{textAlign:'center',padding:40,color:C.sub}}>Loading…</div>:(
    <div style={{...card,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1.2fr 1fr',padding:'11px 18px',background:'var(--theme-surface-faint2)',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase'}}>
        <span>Name</span><span>Status</span><span>Rating</span><span>Assignee</span><span>Created On</span>
      </div>
      {leads.length===0?<div style={{padding:30,textAlign:'center',color:C.sub}}>No leads found</div>
      :leads.map((l,i)=>(
        <div key={l._id} style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1.2fr 1fr',padding:'12px 18px',alignItems:'center',borderBottom:i<leads.length-1?'1px solid var(--theme-surface-faint5)':'none',fontSize:13}}>
          <span style={{fontWeight:600,color:C.ink}}>{l.name}</span><span>{l.status}</span><span>{'★'.repeat(l.rating||0)||'—'}</span><span>{l.assignedTo?.name||'Unassigned'}</span><span>{new Date(l.createdAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>)}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEMPLATE EDITOR — Step 1 Request Info → Step 2 Response Mapper → Summary
═══════════════════════════════════════════════════════════════════════════ */
function TemplateEditor({initial,onClose,onSaved}){
  const isNew=!initial._id;
  const [t,setT]=useState(()=>({
    ...initial,
    headers:initial.headers? (Array.isArray(initial.headers)?initial.headers:Object.entries(initial.headers).map(([key,value])=>({key,value}))) : [{key:'Content-type',value:'application/json'}],
    queryParams:initial.queryParams? (Array.isArray(initial.queryParams)?initial.queryParams:Object.entries(initial.queryParams).map(([key,value])=>({key,value}))) : [],
    auth:initial.auth||{type:'none'},
    timeout:initial.timeout||3,
    responseMapping:initial.responseMapping||[],
    bodyText:typeof initial.bodyTemplate==='string'?initial.bodyTemplate:JSON.stringify(initial.bodyTemplate||{},null,2),
  }));
  const [saving,setSaving]=useState(false);
  const [testResult,setTestResult]=useState(null);
  const [reqTab,setReqTab]=useState('headers');
  // step: 'request' | 'mapping' | 'summary'
  const [step,setStep]=useState(t._id&&t.responseMapping?.length?'summary':'request');
  const set=p=>setT(x=>({...x,...p}));

  const parse=(text,fb)=>{try{return JSON.parse(text||'{}')}catch{return fb}};
  const toObj=arr=>Object.fromEntries((arr||[]).filter(h=>h.key).map(h=>[h.key,h.value]));

  const buildPayload=()=>({
    name:t.name,method:t.method,endpointUrl:t.endpointUrl,timeout:t.timeout,
    headers:toObj(t.headers), queryParams:toObj(t.queryParams), auth:t.auth,
    bodyTemplate:parse(t.bodyText,{}),
    variablesUsed:Array.from(new Set((t.bodyText+t.endpointUrl+JSON.stringify(t.queryParams)).match(/\{\{[^}]+\}\}/g)?.map(s=>s.replace(/[{}]/g,''))||[])),
  });

  const save=async(silent)=>{
    if(!t.name.trim()||!t.endpointUrl.trim()){if(!silent)alert('Template Name and Endpoint URL are required');return null;}
    setSaving(true);
    try{
      const payload=buildPayload();
      const saved=t._id?(await apiTemplatesAPI.update(t._id,payload)).data.template:(await apiTemplatesAPI.create(payload)).data.template;
      setT(x=>({...x,_id:saved._id}));
      setSaving(false);
      return saved;
    }catch(e){ if(!silent)alert(e.response?.data?.message||'Save failed'); setSaving(false); return null; }
  };

  const runTest=async()=>{
    const draft=buildPayload();
    try{
      const r=await apiTemplatesAPI.test(t._id||'new',{draft});
      setTestResult(r.data.result);
      if(r.data.result?.ok) set({lastTestResponse:r.data.result.body});
    }catch(e){setTestResult({ok:false,error:e.response?.data?.message||e.message})}
  };

  const continueToMapping=async()=>{
    const saved=await save(true);
    if(!saved)return;
    setStep('mapping');
  };

  const addHeader=()=>set({headers:[...t.headers,{key:'',value:''}]});
  const updHeader=(i,p)=>{const n=[...t.headers];n[i]={...n[i],...p};set({headers:n})};
  const rmHeader=i=>set({headers:t.headers.filter((_,x)=>x!==i)});
  const addParam=()=>set({queryParams:[...t.queryParams,{key:'',value:''}]});
  const updParam=(i,p)=>{const n=[...t.queryParams];n[i]={...n[i],...p};set({queryParams:n})};
  const rmParam=i=>set({queryParams:t.queryParams.filter((_,x)=>x!==i)});

  if(step==='mapping') return <ResponseMapper t={t} set={set} onPrevious={()=>setStep('request')} onSaved={async(mapping)=>{await apiTemplatesAPI.updateResponseMapping(t._id,mapping);setT(x=>({...x,responseMapping:mapping}));setStep('summary')}}/>;
  if(step==='summary') return <TemplateSummary t={t} onEdit={()=>setStep('request')} onClose={onClose} onSaved={onSaved}/>;

  return(
  <div style={{padding:'24px 28px',maxWidth:1100,margin:'0 auto'}}>
    <div style={{fontSize:18,fontWeight:700,color:C.ink,marginBottom:16}}>API Template Manager</div>
    <div style={{display:'flex',gap:24}}>
      <div style={{width:220,flexShrink:0}}>
        <div style={{fontWeight:700,color:C.ink,fontSize:15,marginBottom:4}}>{isNew?'Create':'Edit'} Template</div>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 0'}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:C.indigo,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>1</div>
          <div><div style={{fontSize:13,fontWeight:600,color:C.indigo}}>Request Information</div><div style={{fontSize:11,color:C.sub}}>Define API Endpoint and Test</div></div>
        </div>
        <div style={{...card,padding:14,marginTop:12}}>
          <div style={{fontSize:13,fontWeight:600,color:C.ink}}>Need Help?</div>
          <div style={{fontSize:12,color:C.sub,marginTop:4}}>Check our documentation for detailed guides on creating templates.</div>
          <a href="https://telecrm.notion.site/api-template-manager" target="_blank" rel="noreferrer" style={{fontSize:13,color:C.indigo,marginTop:8,display:'inline-block',textDecoration:'none'}}>View Documentation →</a>
        </div>
      </div>

      <div style={{flex:1}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:17,fontWeight:700,color:C.ink}}>{t.name||(isNew?'New API Template':t.name)}</div>
          <button style={btnG} onClick={onClose}>Cancel</button>
        </div>

        <div style={{fontSize:14,fontWeight:600,color:C.ink,marginBottom:14}}>Request Information</div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div><label style={lbl}>Template Name *</label><input value={t.name} onChange={e=>set({name:e.target.value})} placeholder="My Awesome API" style={inp}/></div>

          <div style={{display:'flex',gap:12}}>
            <div style={{width:140,flexShrink:0}}><label style={lbl}>HTTP Method *</label>
              <select value={t.method} onChange={e=>set({method:e.target.value})} style={inp}>{['GET','POST','PUT','PATCH','DELETE'].map(m=><option key={m}>{m}</option>)}</select>
            </div>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><label style={lbl}>API Endpoint URL *</label><button style={{...btnG,padding:'2px 10px',fontSize:11}} onClick={()=>set({endpointUrl:t.endpointUrl+'{{lead.id}}'})}>Add Variable</button></div>
              <div style={{display:'flex',gap:6}}>
                <input value={t.endpointUrl} onChange={e=>set({endpointUrl:e.target.value})} placeholder="https://awesome-api.com/customers/{{lead.id}}" style={inp}/>
                <button style={{...btnG,padding:'8px 10px'}} title="Copy" onClick={()=>navigator.clipboard?.writeText(t.endpointUrl)}>⧉</button>
              </div>
            </div>
          </div>

          <div style={{width:140}}><label style={lbl}>API Timeout (s) *</label><input type="number" min="1" max="60" value={t.timeout} onChange={e=>set({timeout:Number(e.target.value)})} style={inp}/></div>

          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`,marginBottom:12}}>
              <div style={{display:'flex',gap:20}}>
                {['headers','body','queryParams','auth'].map(tab=>(
                  <button key={tab} onClick={()=>setReqTab(tab)} style={{background:'none',border:'none',padding:'8px 2px',cursor:'pointer',fontSize:13,fontWeight:600,color:reqTab===tab?C.indigo:C.sub,borderBottom:reqTab===tab?`2px solid ${C.indigo}`:'2px solid transparent',textTransform:'capitalize'}}>{tab==='queryParams'?'Query Params':tab}</button>
                ))}
              </div>
              {reqTab==='body'&&<div style={{display:'flex',gap:8,paddingBottom:8}}><button style={{...btnG,padding:'4px 10px',fontSize:12}} onClick={()=>set({bodyText:JSON.stringify(parse(t.bodyText,{}),null,2)})}>Format JSON</button><button style={{...btnG,padding:'4px 10px',fontSize:12}} onClick={()=>set({bodyText:t.bodyText+'{{lead.name}}'})}>Add Variable</button></div>}
            </div>

            {reqTab==='headers'&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 70px',gap:8,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:6}}><span>Key</span><span>Value</span><span>Actions</span></div>
                {t.headers.map((h,i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 70px',gap:8,marginBottom:6}}>
                    <input value={h.key} onChange={e=>updHeader(i,{key:e.target.value})} placeholder="Content-type" style={inp}/>
                    <input value={h.value} onChange={e=>updHeader(i,{value:e.target.value})} placeholder="application/json" style={inp}/>
                    <div style={{display:'flex',gap:4}}>{i>0&&<button onClick={()=>rmHeader(i)} style={{...btnG,padding:'6px 8px',color:C.red,borderColor:'#fecaca'}}>🗑</button>}<button onClick={addHeader} style={{...btnG,padding:'6px 8px'}}>+</button></div>
                  </div>
                ))}
              </div>
            )}
            {reqTab==='body'&&(
              <div style={{position:'relative'}}>
                <button style={{position:'absolute',top:8,right:8,...btnG,padding:'4px 8px'}} title="Copy" onClick={()=>navigator.clipboard?.writeText(t.bodyText)}>⧉</button>
                <textarea value={t.bodyText} onChange={e=>set({bodyText:e.target.value})} rows={10} style={{...inp,fontFamily:'monospace',fontSize:13}} placeholder={'{\n  "name": "{{lead.name}}",\n  "phone": "{{lead.phone}}"\n}'}/>
              </div>
            )}
            {reqTab==='queryParams'&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 70px',gap:8,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:6}}><span>Key</span><span>Value</span><span></span></div>
                {t.queryParams.map((p,i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 70px',gap:8,marginBottom:6}}>
                    <input value={p.key} onChange={e=>updParam(i,{key:e.target.value})} style={inp}/>
                    <input value={p.value} onChange={e=>updParam(i,{value:e.target.value})} style={inp}/>
                    <div style={{display:'flex',gap:4}}><button onClick={()=>rmParam(i)} style={{...btnG,padding:'6px 8px',color:C.red,borderColor:'#fecaca'}}>🗑</button></div>
                  </div>
                ))}
                <button onClick={addParam} style={{...btnG,fontSize:16,padding:'4px 12px'}}>+ Add</button>
              </div>
            )}
            {reqTab==='auth'&&(
              <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:420}}>
                <select value={t.auth.type} onChange={e=>set({auth:{...t.auth,type:e.target.value}})} style={inp}><option value="none">None</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="api_key">API Key</option></select>
                {t.auth.type==='bearer'&&<input value={t.auth.token||''} onChange={e=>set({auth:{...t.auth,token:e.target.value}})} placeholder="Token" style={inp}/>}
                {t.auth.type==='basic'&&<><input value={t.auth.username||''} onChange={e=>set({auth:{...t.auth,username:e.target.value}})} placeholder="Username" style={inp}/><input value={t.auth.password||''} onChange={e=>set({auth:{...t.auth,password:e.target.value}})} placeholder="Password" type="password" style={inp}/></>}
                {t.auth.type==='api_key'&&<><input value={t.auth.headerName||''} onChange={e=>set({auth:{...t.auth,headerName:e.target.value}})} placeholder="Header name e.g. Api-Key" style={inp}/><input value={t.auth.headerValue||''} onChange={e=>set({auth:{...t.auth,headerValue:e.target.value}})} placeholder="Header value" style={inp}/></>}
              </div>
            )}
          </div>

          {testResult&&(
          <div style={{...card,overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:testResult.ok?C.greenBg:C.redBg,borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,fontWeight:700,color:testResult.ok?C.green:C.red,display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:testResult.ok?C.green:C.red,display:'inline-block'}}/>
                Test Result&nbsp; Status: {testResult.status||'—'} {testResult.ok?'OK':'Unauthorized/Error'}
              </span>
              {!testResult.ok&&<button style={{...btnG,padding:'4px 10px',fontSize:12}} onClick={runTest}>↺ Retry API Test</button>}
            </div>
            <pre style={{margin:0,padding:14,fontSize:12,fontFamily:'monospace',maxHeight:260,overflow:'auto',background:'var(--theme-surface-faint)',color:C.ink}}>{JSON.stringify(testResult.body??testResult.error??testResult,null,2)}</pre>
            {testResult.ok&&<div style={{padding:'10px 14px',borderTop:`1px solid ${C.border}`,textAlign:'right'}}><button style={btnP} onClick={continueToMapping}>Continue to Response Mapper →</button></div>}
          </div>)}

          <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
            <button style={btnG} onClick={()=>save()} disabled={saving}>{saving?'Saving…':'Save Template'}</button>
            <button style={btnP} onClick={runTest}>Test Template</button>
          </div>
        </div>
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2 — RESPONSE MAPPER
═══════════════════════════════════════════════════════════════════════════ */
function ResponseMapper({t,onPrevious,onSaved}){
  const [search,setSearch]=useState('');
  const [mapping,setMapping]=useState(t.responseMapping?.length?t.responseMapping:[]);
  const paths=flattenJson(t.lastTestResponse ?? {});
  const filtered=search?paths.filter(p=>p.path.toLowerCase().includes(search.toLowerCase())||String(p.value).toLowerCase().includes(search.toLowerCase())):paths;

  const addMapping=(path)=>{
    if(mapping.some(m=>m.jsonPath===path))return;
    setMapping([...mapping,{jsonPath:path,type:'Text',label:path.split('.').pop(),required:false}]);
  };
  const updMapping=(i,p)=>{const n=[...mapping];n[i]={...n[i],...p};setMapping(n)};
  const rmMapping=i=>setMapping(mapping.filter((_,x)=>x!==i));

  return(
  <div style={{padding:'24px 28px',maxWidth:1000,margin:'0 auto'}}>
    <div style={{fontSize:18,fontWeight:700,color:C.ink,marginBottom:4}}>API Template Manager</div>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
      <span style={{fontSize:13,color:C.sub}}>Step 2 of 2</span>
    </div>
    <div style={{...card,padding:20}}>
      <div style={{fontSize:16,fontWeight:700,color:C.ink}}>Response Mapper</div>
      <div style={{fontSize:13,color:C.sub,marginBottom:16}}>Map the API Response Fields to create a structured output for your template</div>

      <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:8}}>Available JSON Paths ({paths.length})</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by Field or Value" style={{...inp,marginBottom:12}}/>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,maxHeight:180,overflowY:'auto',padding:4,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:20}}>
        {filtered.length===0?<span style={{fontSize:12,color:C.sub,padding:8}}>No response cached yet — run "Test Template" in step 1 first.</span>
        :filtered.map((p,i)=>(
          <button key={i} onClick={()=>addMapping(p.path)} title={String(p.value)} style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:mapping.some(m=>m.jsonPath===p.path)?C.indigoBg:'var(--theme-surface-faint)',cursor:'pointer',fontSize:12,maxWidth:260,overflow:'hidden'}}>
            <div style={{fontWeight:700,color:C.ink,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.path}</div>
            <div style={{color:C.sub,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:240}}>{String(p.value)}</div>
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.4fr 70px 50px',gap:8,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:8}}>
        <span>JSON Path</span><span>Type</span><span>Label</span><span>Required</span><span>Delete</span>
      </div>
      {mapping.length===0?<div style={{fontSize:13,color:C.sub,padding:'10px 0'}}>Click a JSON path above to add it to the mapping.</div>
      :mapping.map((m,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.4fr 70px 50px',gap:8,marginBottom:8,alignItems:'center'}}>
          <select value={m.jsonPath} onChange={e=>updMapping(i,{jsonPath:e.target.value})} style={{...inp,fontSize:13}}>{paths.map(p=><option key={p.path} value={p.path}>{p.path}</option>)}</select>
          <select value={m.type} onChange={e=>updMapping(i,{type:e.target.value})} style={{...inp,fontSize:13}}>{MAP_TYPES.map(ty=><option key={ty} value={ty}>{ty}</option>)}</select>
          <input value={m.label} onChange={e=>updMapping(i,{label:e.target.value})} style={inp}/>
          <input type="checkbox" checked={m.required} onChange={e=>updMapping(i,{required:e.target.checked})} style={{width:18,height:18,justifySelf:'center'}}/>
          <button onClick={()=>rmMapping(i)} style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:16}}>🗑</button>
        </div>
      ))}

      <div style={{display:'flex',justifyContent:'space-between',marginTop:20}}>
        <button style={btnG} onClick={onPrevious}>Previous</button>
        <button style={btnP} onClick={()=>onSaved(mapping)}>Save Mapping</button>
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUMMARY VIEW — template card + Workflows + Attach Workflow
═══════════════════════════════════════════════════════════════════════════ */
function TemplateSummary({t,onEdit,onClose,onSaved}){
  const [template,setTemplate]=useState(t);
  const [attaching,setAttaching]=useState(false);
  const refresh=async()=>{try{setTemplate((await apiTemplatesAPI.getOne(t._id)).data.template)}catch(e){console.error(e)}};
  useEffect(()=>{refresh()},[]);

  const wfs=template.usedInWorkflows||[];

  return(
  <div style={{padding:'24px 28px',maxWidth:760,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}><button style={btnG} onClick={onClose}>Close</button></div>
    <div style={{...card,overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:17,fontWeight:700,color:C.ink}}>{template.name}</div>
        <button onClick={onEdit} title="Edit" style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 9px',cursor:'pointer'}}>✎</button>
      </div>
      <div style={{display:'flex',gap:40,padding:'16px 20px',borderBottom:`1px solid ${C.border}`}}>
        <div><div style={lbl}>HTTP Method</div><div style={{fontWeight:700,color:C.ink}}>{template.method}</div></div>
        <div><div style={lbl}>Endpoint</div><div style={{fontWeight:600,color:C.ink,fontSize:13,wordBreak:'break-all'}}>{template.endpointUrl}</div></div>
      </div>

      <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontWeight:700,color:C.ink,marginBottom:10}}>Response Mapper</div>
        {(template.responseMapping||[]).length===0?<div style={{fontSize:13,color:C.sub}}>No fields mapped yet.</div>:(
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',fontSize:13}}>
          <div style={{fontWeight:700,color:C.sub,fontSize:11,textTransform:'uppercase',paddingBottom:6}}>JSON Path</div>
          <div style={{fontWeight:700,color:C.sub,fontSize:11,textTransform:'uppercase',paddingBottom:6}}>Field</div>
          <div style={{fontWeight:700,color:C.sub,fontSize:11,textTransform:'uppercase',paddingBottom:6}}>Required</div>
          {template.responseMapping.map((m,i)=>[
            <div key={`p${i}`} style={{padding:'6px 0',color:C.sub}}>{m.jsonPath}</div>,
            <div key={`f${i}`} style={{padding:'6px 0',color:C.ink}}>{m.label}</div>,
            <div key={`r${i}`} style={{padding:'6px 0',color:C.sub}}>{m.required?'Yes':'No'}</div>,
          ])}
        </div>)}
      </div>

      <div style={{padding:'16px 20px'}}>
        <div style={{fontWeight:700,color:C.ink,marginBottom:10}}>Workflows</div>
        {wfs.length===0?(
        <div style={{...card,padding:16,background:'var(--theme-surface-faint)'}}>
          <div style={{fontWeight:700,color:C.ink,marginBottom:4}}>No workflows attached</div>
          <div style={{fontSize:13,color:C.sub,marginBottom:12}}>This API Template Manager isn't connected to any workflows yet. Learn how to use workflows to automate data processing, send notifications, and trigger actions based on your data.</div>
          <div style={{display:'flex',gap:8}}>
            <button style={btnP}>▷ Watch Tutorial</button>
            <button style={btnG} onClick={()=>setAttaching(true)}>Attach Workflow</button>
          </div>
        </div>):(
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',fontSize:13}}>
          <div style={{fontWeight:700,color:C.sub,fontSize:11,textTransform:'uppercase',paddingBottom:6}}>Name</div>
          <div style={{fontWeight:700,color:C.sub,fontSize:11,textTransform:'uppercase',paddingBottom:6}}>Status</div>
          <div style={{fontWeight:700,color:C.sub,fontSize:11,textTransform:'uppercase',paddingBottom:6}}>Updated on</div>
          <div style={{fontWeight:700,color:C.sub,fontSize:11,textTransform:'uppercase',paddingBottom:6}}>Updated by</div>
          {wfs.map((w,i)=>[
            <div key={`n${i}`} style={{padding:'8px 0',color:C.indigo,fontWeight:600}}>{w.name}</div>,
            <div key={`s${i}`} style={{padding:'8px 0'}}><span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:10,background:w.status==='published'?C.greenBg:'#fef3c7',color:w.status==='published'?C.green:C.amber}}>{w.status==='published'?'Published':'Draft'}</span></div>,
            <div key={`u${i}`} style={{padding:'8px 0',color:C.sub}}>{new Date(w.updatedAt).toLocaleString()}</div>,
            <div key={`b${i}`} style={{padding:'8px 0',color:C.sub}}>{w.updatedBy?.name||'—'}</div>,
          ])}
          <div style={{gridColumn:'1 / -1',marginTop:10}}><button style={btnG} onClick={()=>setAttaching(true)}>+ Attach Another Workflow</button></div>
        </div>)}
        <div style={{fontSize:11,color:C.sub,marginTop:12}}>Note: Only published workflows are displayed here — draft workflows won't be shown.</div>
      </div>
    </div>
    <div style={{textAlign:'right',marginTop:16}}><button style={btnP} onClick={onSaved}>Done</button></div>

    {attaching&&<AttachWorkflowModal template={template} onClose={()=>setAttaching(false)} onAttached={()=>{setAttaching(false);refresh()}}/>}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ATTACH WORKFLOW — Select event drawer → 2-node confirm panel
═══════════════════════════════════════════════════════════════════════════ */
function AttachWorkflowModal({template,onClose,onAttached}){
  const [events,setEvents]=useState([]);
  const [search,setSearch]=useState('');
  const [picked,setPicked]=useState(null);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{workflowsAPI.meta().then(r=>setEvents(r.data.events||[])).catch(()=>{})},[]);

  const COLLAPSIBLE_GROUPS=['Whatsapp','Lead Field Change'];
  const groups={};
  events.forEach(e=>{(groups[e.group]=groups[e.group]||[]).push(e)});
  const entries=[];
  Object.entries(groups).forEach(([group,items])=>{
    if(COLLAPSIBLE_GROUPS.includes(group)) entries.push({kind:'group',group,items});
    else items.forEach(ev=>entries.push({kind:'leaf',ev}));
  });
  const searchResults=search?events.filter(e=>e.label.toLowerCase().includes(search.toLowerCase())):null;

  const confirmAttach=async()=>{
    if(!picked)return;
    setSaving(true);
    try{
      await apiTemplatesAPI.attachWorkflow(template._id,{triggerEvent:picked.value,name:picked.label});
      onAttached();
    }catch(e){alert(e.response?.data?.message||'Failed to attach workflow')}
    setSaving(false);
  };

  return(
  <div style={{position:'fixed',inset:0,background:'rgba(30,27,75,.45)',display:'flex',justifyContent:'flex-end',zIndex:1000}}>
    <div style={{width:460,maxWidth:'100vw',background:'#fff',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,.15)'}}>
      {!picked?(<>
        <div style={{padding:'20px 22px 14px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div><div style={{fontSize:17,fontWeight:700,color:C.ink}}>Select event</div><div style={{fontSize:13,color:C.sub}}>Select the event that will trigger the workflow</div></div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.sub}}>✕</button>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search for event e.g. facebook, payment completed, my_waca_template, etc" style={{...inp,background:'#f9fafb'}}/>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
          {searchResults?searchResults.map((e,i)=><EventRow key={i} ev={e} onClick={()=>setPicked(e)}/>)
          :entries.map((entry,i)=>entry.kind==='group'
            ?<GroupRow key={i} group={entry.group} items={entry.items} onPick={setPicked}/>
            :<EventRow key={i} ev={entry.ev} onClick={()=>setPicked(entry.ev)}/>
          )}
        </div>
      </>):(
        <div style={{padding:20,flex:1,overflowY:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div style={{fontSize:17,fontWeight:700,color:C.ink}}>Attach Workflow</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.sub}}>✕</button>
          </div>
          <div style={{...card,padding:16,marginBottom:16}}>
            <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
              <div style={{flex:1,borderRadius:10,overflow:'hidden',border:`1px solid ${C.border}`}}>
                <div style={{background:C.purple,color:'#fff',padding:'6px 12px',fontSize:11,fontWeight:700,textTransform:'uppercase'}}>EVENT</div>
                <div style={{padding:'10px 12px',fontWeight:700,fontSize:13,color:C.ink}}>{picked.label}</div>
              </div>
              <div style={{flex:1,borderRadius:10,overflow:'hidden',border:`1px solid ${C.border}`}}>
                <div style={{background:'#6b7280',color:'#fff',padding:'6px 12px',fontSize:11,fontWeight:700,textTransform:'uppercase'}}>Call an API</div>
                <div style={{padding:'10px 12px',fontWeight:600,fontSize:13,color:C.ink}}>{template.name}</div>
              </div>
            </div>
          </div>
          <div style={{...card,padding:16}}>
            <div style={{fontWeight:700,color:C.ink,marginBottom:10}}>Custom API</div>
            <label style={lbl}>Select template</label>
            <input value={template.name} disabled style={{...inp,background:'var(--theme-surface-faint)',color:C.sub}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:20}}>
            <button style={btnG} onClick={()=>setPicked(null)}>← Back</button>
            <button style={btnP} onClick={confirmAttach} disabled={saving}>{saving?'Saving…':'Save & Publish Workflow'}</button>
          </div>
        </div>
      )}
    </div>
  </div>);
}
function GroupRow({group,items,onPick}){
  const [open,setOpen]=useState(false);
  return(
  <div>
    <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 22px',cursor:'pointer',fontSize:14,fontWeight:500,color:C.ink}}>
      <span style={{fontSize:10,color:C.sub,transform:open?'rotate(0deg)':'rotate(-90deg)',transition:'transform .15s',display:'inline-block'}}>▾</span>{group}
    </div>
    {open&&items.map((e,i)=><EventRow key={i} ev={e} indent onClick={()=>onPick(e)}/>)}
  </div>);
}
function EventRow({ev,onClick,indent}){
  return <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:10,padding:`9px 22px 9px ${indent?40:22}px`,cursor:'pointer'}}
    onMouseEnter={e=>e.currentTarget.style.background='var(--theme-surface-faint)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
    <span style={{flex:1,fontSize:14,color:C.ink}}>{ev.label}</span>
  </div>;
}