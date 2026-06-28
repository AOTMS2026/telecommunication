import { useState, useEffect } from 'react';
import { webhooksAPI, workflowsAPI } from '../services/api';

const C={indigo:'#6366f1',border:'#e5e2f5',ink:'#1e1b4b',sub:'#6b7280',green:'#059669',red:'#dc2626'};
const card={background:'#fff',border:`1px solid ${C.border}`,borderRadius:12};
const btnP={padding:'8px 18px',borderRadius:8,border:'none',background:C.indigo,color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer'};
const btnG={padding:'7px 14px',borderRadius:8,border:`1.5px solid ${C.border}`,background:'#fff',color:C.ink,fontWeight:600,fontSize:13,cursor:'pointer'};
const inp={width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'};
const lbl={fontSize:12,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5,display:'block'};

const WIZARD_STEPS=[
  {num:1,label:'Webhook Details',desc:'Name your webhook and generate its endpoint URL'},
  {num:2,label:'Sample Request',desc:'Help the system understand the shape of the incoming webhook'},
  {num:3,label:'Map Lead Identifier',desc:'Identify which field in the request uniquely represents the lead'},
  {num:4,label:'Duplicate Detection (Optional)',desc:'Select a field to detect and ignore duplicate incoming webhook events'},
  {num:5,label:'Authentication (Optional)',desc:'Secure your webhook endpoint with authentication'},
  {num:6,label:'Map Your Data',desc:'Map incoming webhook fields to lead fields in the CRM'},
  {num:7,label:'Connect Automation',desc:'Connect this webhook to a workflow for automated processing'},
];

export default function Webhooks(){
  const [hooks,setHooks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [events,setEvents]=useState([]);

  const load=async()=>{setLoading(true);try{setHooks((await webhooksAPI.getAll()).data.webhooks)}catch(e){console.error(e)}setLoading(false)};
  useEffect(()=>{load();workflowsAPI.meta().then(r=>setEvents(r.data.events)).catch(()=>{});},[]);

  if(editing) return <WebhookEditor initial={editing} events={events} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}} />;

  return(
  <div style={{padding:'24px 28px',maxWidth:1100,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
      <div>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:C.ink}}>Webhook Management</h2>
        <p style={{margin:'4px 0 0',color:C.sub,fontSize:14}}>Manage inbound & outbound webhooks and connect to external systems</p>
      </div>
      <button style={btnP} onClick={()=>setEditing({name:'',url:'',events:[],status:'active',config:{},fieldMappings:[]})}>Create new webhook +</button>
    </div>

    {loading?<div style={{textAlign:'center',padding:50,color:C.sub}}>Loading…</div>
    :hooks.length===0?(
      <div style={{...card,padding:50,textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>🪝</div>
        <div style={{fontWeight:600,color:C.ink,marginBottom:4,fontSize:16}}>No webhooks yet</div>
        <div style={{color:C.sub,fontSize:14,marginBottom:16}}>Create your first webhook to push or receive lead events.</div>
        <button style={btnP} onClick={()=>setEditing({name:'',url:'',events:[],status:'active',config:{},fieldMappings:[]})}>Create your first webhook</button>
        <div style={{marginTop:24,color:C.indigo,fontSize:14,cursor:'pointer'}}>📄 View webhook documentation</div>
      </div>
    ):(
      <div style={{...card,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.4fr 2fr 1fr .8fr 150px',padding:'12px 18px',background:'#f9f8ff',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase'}}>
          <span>Name</span><span>URL</span><span>Events</span><span>Status</span><span style={{textAlign:'right'}}>Actions</span>
        </div>
        {hooks.map((h,i)=>(
          <div key={h._id} style={{display:'grid',gridTemplateColumns:'1.4fr 2fr 1fr .8fr 150px',padding:'14px 18px',alignItems:'center',borderBottom:i<hooks.length-1?'1px solid #f0eef8':'none'}}>
            <span style={{fontWeight:600,color:C.ink,cursor:'pointer'}} onClick={()=>setEditing(h)}>{h.name}</span>
            <span style={{fontSize:12,color:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.url}</span>
            <span style={{fontSize:13,color:C.sub}}>{h.events?.length||0}</span>
            <span><span style={{background:h.status==='active'?'#d1fae5':'#f3f4f6',color:h.status==='active'?C.green:'#6b7280',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{h.status}</span></span>
            <span style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
              <button style={{...btnG,padding:'5px 10px'}} onClick={async()=>{const r=await webhooksAPI.test(h._id);alert(r.data.result?.message||'Sent');load()}}>Test</button>
              <button style={{...btnG,padding:'5px 10px'}} onClick={()=>setEditing(h)}>Edit</button>
              <button style={{...btnG,padding:'5px 10px',color:C.red,borderColor:'#fecaca'}} onClick={async()=>{if(confirm('Delete?')){await webhooksAPI.delete(h._id);load()}}}>🗑</button>
            </span>
          </div>
        ))}
      </div>
    )}
  </div>);
}

function WebhookEditor({initial,events,onClose,onSaved}){
  const [h,setH]=useState(initial);
  const [mainTab,setMainTab]=useState('webhook');
  const [step,setStep]=useState(1);
  const [saving,setSaving]=useState(false);
  const [wfList,setWfList]=useState([]);
  const set=p=>setH(x=>({...x,...p}));
  const setCfg=p=>set({config:{...h.config,...p}});
  useEffect(()=>{workflowsAPI.getAll({limit:100}).then(r=>setWfList(r.data.workflows||[])).catch(()=>{});},[]);

  const save=async()=>{
    if(!h.name.trim())return alert('Name required');
    setSaving(true);
    try{if(h._id)await webhooksAPI.update(h._id,h);else{if(!h.url.trim())set({url:`${window.location.origin}/api/webhooks/inbound/${Date.now()}`});await webhooksAPI.create(h)}onSaved();}
    catch(e){alert(e.response?.data?.message||'Save failed')}
    setSaving(false);
  };

  const toggleEvent=val=>set({events:h.events?.includes(val)?h.events.filter(e=>e!==val):[...(h.events||[]),val]});

  return(
  <div style={{padding:'24px 28px',maxWidth:960,margin:'0 auto'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
      <button onClick={onClose} style={{...btnG,padding:'6px 12px'}}>←</button>
      <input value={h.name} onChange={e=>set({name:e.target.value})} placeholder="Webhook name" style={{...inp,fontWeight:700,fontSize:16,maxWidth:300,border:'none',background:'transparent'}}/>
      {h._id&&<span style={{fontSize:12,color:C.sub}}>⚠ 1 Error</span>}
      <div style={{flex:1}}/>
      <button style={btnG}>Clone</button>
      <button style={btnP} onClick={save} disabled={saving}>{saving?'Saving…':'Edit'}</button>
    </div>

    {/* Webhook / Workflow tabs */}
    <div style={{display:'flex',gap:24,borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
      {['webhook','workflow'].map(t=>(
        <button key={t} onClick={()=>setMainTab(t)} style={{background:'none',border:'none',padding:'10px 4px',cursor:'pointer',fontSize:14,fontWeight:600,textTransform:'capitalize',color:mainTab===t?C.indigo:C.sub,borderBottom:mainTab===t?`2.5px solid ${C.indigo}`:'2.5px solid transparent'}}>{t}</button>
      ))}
    </div>

    {mainTab==='webhook'?(
    <div style={{display:'flex',gap:24}}>
      {/* Left wizard nav */}
      <div style={{width:220,flexShrink:0}}>
        <div style={{fontWeight:700,color:C.ink,fontSize:15,marginBottom:4}}>Webhook Setup</div>
        <div style={{fontSize:13,color:C.sub,marginBottom:16}}>Configure your inbound webhook</div>
        {WIZARD_STEPS.map(s=>(
          <div key={s.num} onClick={()=>setStep(s.num)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',cursor:'pointer'}}>
            <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,background:step===s.num?C.indigo:'#e5e7eb',color:step===s.num?'#fff':C.sub}}>{s.num}</div>
            <span style={{fontSize:13,fontWeight:step===s.num?700:400,color:step===s.num?C.indigo:C.ink}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Right steps content */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:16}}>
        {WIZARD_STEPS.map(s=>(
          <div key={s.num} style={{...card,padding:'18px 22px',cursor:'pointer',borderColor:step===s.num?C.indigo:C.border}} onClick={()=>setStep(s.num)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:C.ink}}>Step {s.num}: {s.label}</div>
                <div style={{fontSize:13,color:C.sub,marginTop:2}}>{s.desc}</div>
              </div>
              <span style={{color:C.sub,fontSize:14}}>{step===s.num?'▲':'▼'}</span>
            </div>
            {step===s.num&&(
              <div style={{marginTop:14,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                {s.num===1&&(<div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div><label style={lbl}>Webhook Name *</label><input value={h.name} onChange={e=>set({name:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Endpoint URL</label><input value={h.url||''} onChange={e=>set({url:e.target.value})} placeholder="Auto-generated on save" style={{...inp,background:'#f9fafb'}}/></div>
                </div>)}
                {s.num===2&&(<div><label style={lbl}>Paste a sample JSON request body</label><textarea rows={5} value={h.config?.sampleRequest||''} onChange={e=>setCfg({sampleRequest:e.target.value})} placeholder='{"name":"John","phone":"9876543210"}' style={{...inp,fontFamily:'monospace',fontSize:13}}/></div>)}
                {s.num===3&&(<div><label style={lbl}>Lead Identifier Field</label><input value={h.config?.leadIdentifier||''} onChange={e=>setCfg({leadIdentifier:e.target.value})} placeholder="e.g. phone, email" style={inp}/></div>)}
                {s.num===4&&(<div><label style={lbl}>Idempotent Field (dedup key)</label><input value={h.config?.idempotentField||''} onChange={e=>setCfg({idempotentField:e.target.value})} placeholder="e.g. request_id, timestamp" style={inp}/></div>)}
                {s.num===5&&(<div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div><label style={lbl}>Auth Type</label><select value={h.config?.authType||'none'} onChange={e=>setCfg({authType:e.target.value})} style={inp}><option value="none">None</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="api_key">API Key Header</option></select></div>
                  {h.config?.authType&&h.config.authType!=='none'&&<div><label style={lbl}>{h.config.authType==='basic'?'Username:Password':'Token/Key'}</label><input value={h.config?.authValue||''} onChange={e=>setCfg({authValue:e.target.value})} style={inp}/></div>}
                </div>)}
                {s.num===6&&(<div><label style={lbl}>Field Mappings (webhook field → lead field)</label>
                  {(h.fieldMappings||[]).map((m,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 20px 1fr 30px',gap:6,alignItems:'center',marginBottom:6}}>
                      <input value={m.from||''} onChange={e=>{const n=[...h.fieldMappings];n[i]={...n[i],from:e.target.value};set({fieldMappings:n})}} placeholder="webhook_field" style={inp}/>
                      <span style={{textAlign:'center',color:C.sub}}>→</span>
                      <input value={m.to||''} onChange={e=>{const n=[...h.fieldMappings];n[i]={...n[i],to:e.target.value};set({fieldMappings:n})}} placeholder="lead_field" style={inp}/>
                      <button onClick={()=>set({fieldMappings:h.fieldMappings.filter((_,x)=>x!==i)})} style={{...btnG,padding:'4px 6px',color:C.red,borderColor:'#fecaca'}}>✕</button>
                    </div>
                  ))}
                  <button style={btnG} onClick={()=>set({fieldMappings:[...(h.fieldMappings||[]),{from:'',to:''}]})}>+ Add Mapping</button>
                </div>)}
                {s.num===7&&(<div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {/* Subscribe to events */}
                  <div>
                    <label style={lbl}>Subscribe to Events</label>
                    <div style={{fontSize:12,color:C.sub,marginBottom:10}}>Select which AOTMS events will be forwarded to the connected workflow</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {events.map(e=>(
                        <button key={e.value} onClick={()=>toggleEvent(e.value)} style={{padding:'5px 12px',borderRadius:20,fontSize:13,cursor:'pointer',fontWeight:500,border:`1.5px solid ${h.events?.includes(e.value)?C.indigo:C.border}`,background:h.events?.includes(e.value)?'#f0eeff':'#fff',color:h.events?.includes(e.value)?C.indigo:C.sub}}>{e.label}</button>
                      ))}
                    </div>
                  </div>
                  {/* Connect workflow */}
                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:18}}>
                    <label style={lbl}>Connect a Workflow</label>
                    <div style={{fontSize:12,color:C.sub,marginBottom:12}}>When this webhook fires, it will also trigger the selected workflow</div>
                    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                      <select value={h.connectedWorkflowId||''} onChange={e=>set({connectedWorkflowId:e.target.value})}
                        style={{...inp,flex:1,minWidth:220,maxWidth:400,fontSize:13,height:40,padding:'0 12px'}}>
                        <option value=''>— None (no workflow) —</option>
                        {wfList.map(w=><option key={w._id} value={w._id}>{w.name} {w.status==='published'?'✓':''}</option>)}
                      </select>
                      <span style={{fontSize:12,color:C.sub}}>or</span>
                      <button onClick={()=>window.open('/workflows?create=1','_blank')} style={{...btnP,padding:'8px 16px',fontSize:13,display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
                        + Create New Workflow
                      </button>
                    </div>
                    {h.connectedWorkflowId&&(
                      <div style={{marginTop:12,padding:'10px 14px',background:'#f0fdf4',border:`1px solid #bbf7d0`,borderRadius:8,display:'flex',alignItems:'center',gap:8}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',flexShrink:0}}/>
                        <span style={{fontSize:13,color:'#166534',fontWeight:500}}>
                          Workflow connected: <strong>{wfList.find(w=>w._id===h.connectedWorkflowId)?.name||h.connectedWorkflowId}</strong>
                        </span>
                        <button onClick={()=>set({connectedWorkflowId:''})} style={{background:'none',border:'none',color:'#166534',cursor:'pointer',marginLeft:'auto',fontSize:18,lineHeight:1}}>×</button>
                      </div>
                    )}
                  </div>
                </div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    ):(
      /* Workflow tab — shows flowchart canvas */
      <div style={{...card,padding:30,minHeight:400,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center'}}>
          <div style={{display:'inline-block',borderRadius:10,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.08)'}}>
            <div style={{background:C.indigo,color:'#fff',padding:'6px 12px',fontSize:11,fontWeight:700,textTransform:'uppercase'}}>EVENT</div>
            <div style={{padding:'14px 24px',background:'#fff'}}>
              <div style={{fontSize:14,fontWeight:700,color:C.ink}}>On Webhook Trigger</div>
              <div style={{fontSize:12,color:C.sub,marginTop:4}}>👤 {h.name||'webhook'}</div>
            </div>
          </div>
          <div style={{width:2,height:40,background:C.border,margin:'0 auto'}}/>
          <div style={{width:8,height:8,borderRadius:'50%',border:`2px solid ${C.indigo}`,background:'#fff',margin:'0 auto'}}/>
        </div>
        <div style={{position:'fixed',bottom:16,left:16,display:'flex',gap:4,background:'#fff',borderRadius:8,padding:'4px 8px',border:`1px solid ${C.border}`,fontSize:13,color:C.sub}}>
          + 100% − ⊡
        </div>
      </div>
    )}
  </div>);
}