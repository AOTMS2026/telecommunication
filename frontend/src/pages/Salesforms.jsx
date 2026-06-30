import { useState, useEffect, useCallback, useRef } from 'react';
import { salesformsAPI, usersAPI, apiTemplatesAPI, n8nAPI } from '../services/api';
import { Link2, Sparkles, Bell, Users, Settings, Star, Filter, Clock, MessageCircle, ListPlus, ListMinus, PhoneCall, XCircle, IndianRupee, Headphones, Webhook, Zap, Mail, GitBranch, X, MoreVertical, Trash2, Plus, Minus, Maximize2, ChevronDown, ChevronRight } from 'lucide-react';

/* ─── palette (matches Workflows.jsx for visual consistency) ──────────────── */
const C={indigo:'var(--theme-primary-alt)',purple:'var(--theme-primary)',indigoBg:'var(--theme-surface-faint4)',border:'var(--theme-border-tint)',ink:'var(--theme-text-strongest)',sub:'#6b7280',green:'#059669',red:'#dc2626',amber:'#b45309'};
const card={background:'#fff',border:`1px solid ${C.border}`,borderRadius:12};
const btnP={padding:'8px 18px',borderRadius:8,border:'none',background:'var(--btn-gradient)',color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer'};
const btnG={padding:'7px 14px',borderRadius:8,border:`1.5px solid ${C.border}`,background:'#fff',color:C.ink,fontWeight:600,fontSize:13,cursor:'pointer'};
const inp={width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'};
const lbl={fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5,display:'block'};

/* ─── data catalogs ────────────────────────────────────────────────────────── */
const LEAD_FIELDS=[
  {value:'name',label:'Name',icon:'T'},{value:'phone',label:'Phone',icon:'📞'},{value:'email',label:'Email',icon:'✉️'},
  {value:'alternatePhone',label:'Alternate Phone',icon:'📞'},{value:'leadSource',label:'Lead Source',icon:'🏷️'},
  {value:'preferredCourses',label:'Preferred Courses',icon:'📚'},{value:'location',label:'Location',icon:'📍'},
  {value:'lastQualification',label:'Last Qualification',icon:'🎓'},{value:'budget',label:'Budget',icon:'₹'},
  {value:'nextFollowupDate',label:'Next Followup Date',icon:'📅'},{value:'demoScheduledDate',label:'Demo Scheduled Date',icon:'📅'},
  {value:'demoDoneDate',label:'Demo Done Date',icon:'📅'},{value:'collegeName',label:'College Name',icon:'T'},
  {value:'status',label:'Status',icon:'🏷️'},{value:'rating',label:'Rating',icon:'⭐'},
];
const STATUSES=['Fresh','Connected','Call Not Responding','Call Back Later','Not interested','Demo Scheduled','Demo Done','Won','Lost','Blocked'];
const RULE_FIELDS=[
  {value:'status',label:'Lead Status',options:STATUSES},
  {value:'rating',label:'Rating',options:['0','1','2','3','4','5']},
  {value:'leadSource',label:'Lead Source',options:null},
  {value:'assignedTo',label:'Assignee',options:null},
  {value:'createdAt',label:'Created On',options:null},
];
const ACTION_CATALOG=[
  {type:'call_api',label:'Call API',Icon:Link2},{type:'create_custom_action',label:'Create Custom Action',Icon:Sparkles},
  {type:'notify_team_member',label:'Notify TeamMember',Icon:Bell},{type:'update_lead_assignee',label:'Update Assignee',Icon:Users},
  {type:'update_lead_fields',label:'Update Lead Fields',Icon:Settings},{type:'update_lead_rating',label:'Update Rating',Icon:Star},
  {type:'update_lead_status',label:'Update Status',Icon:Filter},{type:'time_delay',label:'Time Delay',Icon:Clock},
  {type:'send_template',label:'Send Template',Icon:MessageCircle},{type:'add_in_list',label:'Add in List',Icon:ListPlus},
  {type:'remove_from_list',label:'Remove from List',Icon:ListMinus},{type:'add_call_followup',label:'Add Call Followup',Icon:PhoneCall},
  {type:'cancel_tasks',label:'Cancel Tasks',Icon:XCircle},{type:'add_payment',label:'Add Payment',Icon:IndianRupee},
  {type:'add_ivr_action',label:'Add IVR Action',Icon:Headphones},
];
// nested taxonomy for the "Select event" drawer
const EVENT_TREE=[
  {value:'on_adding_lead',label:'On adding single lead',leaf:true},
  {label:'On lead field update',children:LEAD_FIELDS.map(f=>({value:'on_lead_field_update',label:f.label,leadField:f.value}))},
  {value:'on_button_click',label:'On button click',leaf:true},
  {label:'On System activity',children:[
    {value:'on_outgoing_call',label:'Outgoing Call'},{value:'on_incoming_call',label:'Incoming Call'},
    {value:'on_location_checkin',label:'Location Check-in'},{value:'on_payment',label:'Payment'},
  ]},
  {label:'On task creation activity',children:[{value:'on_call_followup_task_creation',label:'Call Followup'}]},
];

function eventLabel(sf){
  if(!sf) return '—';
  if(sf.triggerEvent==='on_lead_field_update') return `On ${LEAD_FIELDS.find(f=>f.value===sf.triggerConfig?.leadField)?.label||'Field'} update`;
  const flat={on_adding_lead:'On adding single lead',on_button_click:'On Button Click',on_outgoing_call:'On System Activity',
    on_incoming_call:'On System Activity',on_location_checkin:'On System Activity',on_payment:'On System Activity',
    on_call_followup_task_creation:'On Call Followup Task Creation',on_status_update:'On Status update',on_field_change:'On Field change'};
  return flat[sf.triggerEvent]||sf.triggerEvent;
}
const newId=(p)=>`${p}_${Date.now()}_${Math.floor(Math.random()*1000)}`;

/* ═══════════════════════════════════════════════════════════════════════════
   LIST PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function Salesforms(){
  const [loading,setLoading]=useState(true);
  const [forms,setForms]=useState([]);
  const [tab,setTab]=useState('published');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('');
  const [showPicker,setShowPicker]=useState(false);
  const [editing,setEditing]=useState(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try{ const r=await salesformsAPI.getAll({status:tab,search}); setForms(r.data.salesforms||[]); }
    catch(e){console.error(e)}
    setLoading(false);
  },[tab,search]);
  useEffect(()=>{load()},[load]);

  const handlePick=async(ev)=>{
    setShowPicker(false);
    try{
      const payload={
        name:ev.leadField?`${LEAD_FIELDS.find(f=>f.value===ev.leadField)?.label} based Salesform`:ev.label,
        status:'draft', triggerEvent:ev.value, triggerConfig:ev.leadField?{leadField:ev.leadField}:{},
        flowNodes:[{id:'evt_0',type:'event',x:460,y:40,pathIndex:0,label:ev.leadField?LEAD_FIELDS.find(f=>f.value===ev.leadField)?.label:ev.label}],
        flowEdges:[],
        workflowNodes:[{id:'wevt_0',type:'event',x:460,y:40,label:'On SalesFlow'}],
        workflowEdges:[],
      };
      const r=await salesformsAPI.create(payload);
      setEditing(r.data.salesform);
    }catch(e){alert(e.response?.data?.message||'Failed to create')}
  };

  if(editing) return <SalesformEditor initial={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>;

  const filtered=forms.filter(f=>!statusFilter||f.status===statusFilter);

  return(
  <div style={{padding:'24px 28px',maxWidth:1180,margin:'0 auto'}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
      <div>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:C.ink}}>Salesforms</h2>
        <p style={{margin:'4px 0 0',color:C.sub,fontSize:14}}>To automatically fill lead form data</p>
      </div>
      <button style={btnP} onClick={()=>setShowPicker(true)}>+ Create Salesform</button>
    </div>

    <div style={{display:'flex',gap:24,borderBottom:`1px solid ${C.border}`,marginBottom:14}}>
      {['published','draft'].map(t=>(
        <button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',padding:'8px 2px',cursor:'pointer',fontSize:14,fontWeight:600,textTransform:'capitalize',color:tab===t?C.indigo:C.sub,borderBottom:tab===t?`2.5px solid ${C.indigo}`:'2.5px solid transparent'}}>{t}</button>
      ))}
    </div>
    <div style={{display:'flex',gap:12,marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search salesform by Name" style={{...inp,maxWidth:420}}/>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...inp,maxWidth:200}}>
        <option value="">Status</option><option value="published">Published</option><option value="draft">Draft</option>
      </select>
    </div>

    {loading?<div style={{textAlign:'center',padding:50,color:C.sub}}>Loading…</div>:(
    <div style={{...card,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns: tab==='published'?'1.6fr 1.3fr 1fr 1.1fr 1.1fr .8fr':'1.6fr 1.3fr 1fr 1fr .8fr',padding:'11px 18px',background:'var(--theme-surface-faint2)',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em'}}>
        <span>Name</span><span>Events</span>
        {tab==='published'?<><span>Status</span><span>Status Updated On</span><span>Status Updated by</span></>:<><span>Updated On</span><span>Updated by</span></>}
        <span style={{textAlign:'right'}}>Actions</span>
      </div>
      {filtered.length===0?<div style={{padding:40,textAlign:'center',color:C.sub}}>No Salesforms Found</div>
      :filtered.map((f,i)=>(
        <div key={f._id} style={{display:'grid',gridTemplateColumns: tab==='published'?'1.6fr 1.3fr 1fr 1.1fr 1.1fr .8fr':'1.6fr 1.3fr 1fr 1fr .8fr',padding:'13px 18px',alignItems:'center',borderBottom:i<filtered.length-1?'1px solid var(--theme-surface-faint5)':'none'}}>
          <span style={{fontWeight:600,color:C.indigo,cursor:'pointer'}} onClick={()=>setEditing(f)}>{f.name}</span>
          <span style={{fontSize:13,color:C.sub}}>{eventLabel(f)}</span>
          {tab==='published'?(<>
            <StatusToggle status={f.status} onToggle={async()=>{await salesformsAPI.setStatus(f._id,f.status==='published'?'draft':'published').catch(e=>alert(e.response?.data?.message||'Failed'));load();}}/>
            <span style={{fontSize:13,color:C.sub}}>{f.statusUpdatedAt?new Date(f.statusUpdatedAt).toLocaleString():'—'}</span>
            <span style={{fontSize:13,color:C.sub}}>{f.statusUpdatedBy?.name||'—'}</span>
          </>):(<>
            <span style={{fontSize:13,color:C.sub}}>{new Date(f.updatedAt).toLocaleString()}</span>
            <span style={{fontSize:13,color:C.sub}}>{f.createdBy?.name||'—'}</span>
          </>)}
          <span style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
            <button style={{...btnG,padding:'4px 8px',fontSize:12,display:'flex',alignItems:'center',gap:4}} title="Duplicate" onClick={async()=>{await salesformsAPI.duplicate(f._id).catch(e=>alert(e.response?.data?.message||'Failed'));load();}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
            <button style={{...btnG,padding:'4px 8px',fontSize:12,color:C.red,borderColor:'#fecaca',display:'flex',alignItems:'center',gap:4}} title="Delete" onClick={async()=>{if(confirm('Delete this salesform?')){await salesformsAPI.delete(f._id);load();}}}><Trash2 size={13}/></button>
          </span>
        </div>
      ))}
    </div>)}

    {showPicker&&<EventPickerDrawer onSelect={handlePick} onClose={()=>setShowPicker(false)}/>}
  </div>);
}

function StatusToggle({status,onToggle}){
  const on=status==='published';
  return <button onClick={onToggle} style={{width:42,height:22,borderRadius:11,border:'none',cursor:'pointer',background:on?C.indigo:'#d1d5db',position:'relative'}}>
    <span style={{position:'absolute',top:2,left:on?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .15s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
  </button>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT PICKER DRAWER (nested taxonomy, matches TeleCRM exactly)
═══════════════════════════════════════════════════════════════════════════ */
function EventPickerDrawer({onSelect,onClose}){
  const [search,setSearch]=useState('');
  const [openGroups,setOpenGroups]=useState({'On lead field update':true});
  const [picked,setPicked]=useState(null);

  const flatLeaves=[];
  EVENT_TREE.forEach(g=>{ if(g.leaf) flatLeaves.push(g); else g.children.forEach(c=>flatLeaves.push({...c,group:g.label})); });
  const searchResults=search?flatLeaves.filter(e=>e.label.toLowerCase().includes(search.toLowerCase())):null;

  return(
  <div style={{position:'fixed',inset:0,background:'rgba(30,27,75,.45)',display:'flex',justifyContent:'flex-end',zIndex:1000}}>
    <div style={{width:460,maxWidth:'100vw',background:'#fff',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,.15)'}}>
      <div style={{padding:'20px 22px 14px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div><div style={{fontSize:17,fontWeight:700,color:C.ink}}>Select event</div><div style={{fontSize:13,color:C.sub}}>Select the event that will trigger the salesform</div></div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.sub,display:'flex'}}><X size={20}/></button>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search for event e.g. button click, lead field update, etc" style={{...inp,background:'#f9fafb'}}/>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
        {searchResults?searchResults.map((e,i)=><EventRow key={i} ev={e} selected={picked===e} onClick={()=>setPicked(e)}/>)
        :EVENT_TREE.map(g=>g.leaf?(
          <EventRow key={g.value} ev={g} selected={picked===g} onClick={()=>setPicked(g)}/>
        ):(
          <div key={g.label}>
            <div onClick={()=>setOpenGroups(p=>({...p,[g.label]:!p[g.label]}))} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 22px',cursor:'pointer',fontSize:14,fontWeight:500,color:C.ink}}>
              <ChevronDown size={12} style={{color:C.sub,transform:openGroups[g.label]?'rotate(0deg)':'rotate(-90deg)',transition:'transform .15s',flexShrink:0}}/>{g.label}
            </div>
            {openGroups[g.label]&&g.children.map((c,i)=><EventRow key={i} ev={c} indent selected={picked===c} onClick={()=>setPicked(c)}/>)}
          </div>
        ))}
      </div>
      <div style={{padding:14,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'flex-end'}}>
        <button style={{...btnP,opacity:picked?1:.5}} disabled={!picked} onClick={()=>picked&&onSelect(picked)}>Next</button>
      </div>
    </div>
  </div>);
}
function EventRow({ev,onClick,indent,selected}){
  return <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:10,padding:`9px 22px 9px ${indent?40:22}px`,cursor:'pointer',background:selected?'var(--theme-surface-faint8)':'transparent'}}
    onMouseEnter={e=>{if(!selected)e.currentTarget.style.background='var(--theme-surface-faint)'}} onMouseLeave={e=>{if(!selected)e.currentTarget.style.background='transparent'}}>
    {selected&&<span style={{color:C.indigo,fontSize:13}}>✓</span>}
    <span style={{flex:1,fontSize:14,color:C.ink}}>{ev.label}</span>
  </div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALESFORM EDITOR (3 tabs: Salesform / Workflow / Configuration)
═══════════════════════════════════════════════════════════════════════════ */
function SalesformEditor({initial,onClose,onSaved}){
  const [sf,setSf]=useState(initial);
  const [editorTab,setEditorTab]=useState('Salesform');
  const [saving,setSaving]=useState(false);
  const [savedAgo,setSavedAgo]=useState(0);
  const [users,setUsers]=useState([]);
  const [templates,setTemplates]=useState([]);
  const [n8nWfs,setN8nWfs]=useState([]);
  const [selectedNode,setSelectedNode]=useState(null);
  const [configNode,setConfigNode]=useState(null);
  const dirtyRef=useRef(false);
  const saveTimer=useRef(null);

  useEffect(()=>{
    usersAPI.getAll().then(r=>setUsers(r.data.users||r.data||[])).catch(()=>{});
    apiTemplatesAPI.getAll().then(r=>setTemplates(r.data.templates||[])).catch(()=>{});
    n8nAPI.cachedWorkflows().then(r=>setN8nWfs(r.data.workflows||[])).catch(()=>{});
  },[]);

  useEffect(()=>{ const t=setInterval(()=>setSavedAgo(s=>s+1),1000); return()=>clearInterval(t); },[]);

  const set=(patch)=>{ dirtyRef.current=true; setSf(prev=>({...prev,...patch})); };

  // debounced autosave — persists whichever tab's data changed
  useEffect(()=>{
    if(!dirtyRef.current) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      try{
        setSaving(true);
        await salesformsAPI.update(sf._id,{name:sf.name,triggerEvent:sf.triggerEvent,triggerConfig:sf.triggerConfig});
        await salesformsAPI.updateFlowchart(sf._id,{flowNodes:sf.flowNodes,flowEdges:sf.flowEdges});
        await salesformsAPI.updateWorkflow(sf._id,{workflowNodes:sf.workflowNodes,workflowEdges:sf.workflowEdges,n8nWorkflowId:sf.n8nWorkflowId});
        await salesformsAPI.updateConfiguration(sf._id,{mandatory:sf.mandatory,permissions:sf.permissions});
        dirtyRef.current=false; setSavedAgo(0);
      }catch(e){console.error(e)}
      setSaving(false);
    },1200);
    return()=>clearTimeout(saveTimer.current);
  },[sf]);

  const publish=async()=>{
    setSaving(true);
    try{ const r=await salesformsAPI.setStatus(sf._id,'published'); setSf(prev=>({...prev,status:r.data.salesform.status})); }
    catch(e){alert(e.response?.data?.message||'Publish failed')}
    setSaving(false);
  };

  const errorCount=(()=>{
    let n=0;
    if(!sf.name?.trim()) n++;
    const conditions=sf.flowNodes.filter(x=>x.type==='condition');
    const sections=sf.flowNodes.filter(x=>x.type==='section');
    if(conditions.length===0) n++;
    sections.forEach(s=>{ if(!s.fields?.length) n++; });
    return n;
  })();

  return(
  <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--theme-surface-faint)'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 20px',background:'#fff',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      <button onClick={onClose} style={{...btnG,padding:'6px 12px'}}>←</button>
      <input value={sf.name} onChange={e=>set({name:e.target.value})} style={{fontWeight:700,fontSize:16,maxWidth:300,background:'transparent',border:'none',outline:'none',color:C.ink}}/>
      <span style={{fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:20,background:sf.status==='published'?'#d1fae5':'#fef3c7',color:sf.status==='published'?C.green:C.amber}}>{sf.status==='published'?'Published':'Draft'}</span>
      {errorCount>0&&<span style={{fontSize:12,color:C.red,fontWeight:600}}>⚠ {errorCount} Error{errorCount>1?'s':''}</span>}
      <div style={{flex:1}}/>
      <span style={{fontSize:12,color:C.sub}}>{saving?'Saving…':`Last saved was ${savedAgo}s ago`}</span>
      <button style={{...btnG,opacity:sf.status==='published'?.5:1}} disabled={sf.status==='published'} onClick={publish}>Publish</button>
      <button style={btnP} onClick={onSaved}>Done</button>
      <button style={{...btnG,padding:'6px 10px',color:C.red,borderColor:'#fecaca',display:'flex',alignItems:'center',gap:4}} onClick={async()=>{if(confirm('Delete this salesform?')){await salesformsAPI.delete(sf._id);onClose();}}}><Trash2 size={14}/></button>
    </div>

    <div style={{display:'flex',justifyContent:'center',background:'#fff',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      {['Salesform','Workflow','Configuration'].map(t=>(
        <button key={t} onClick={()=>setEditorTab(t)} style={{background:'none',border:'none',padding:'10px 24px',cursor:'pointer',fontSize:14,fontWeight:600,color:editorTab===t?C.indigo:C.sub,borderBottom:editorTab===t?`2.5px solid ${C.indigo}`:'2.5px solid transparent'}}>{t}</button>
      ))}
    </div>

    {editorTab==='Salesform'&&<SalesformCanvas sf={sf} set={set} selectedNode={selectedNode} setSelectedNode={setSelectedNode} configNode={configNode} setConfigNode={setConfigNode}/>}
    {editorTab==='Workflow'&&<WorkflowCanvas sf={sf} set={set} users={users} templates={templates} n8nWfs={n8nWfs} selectedNode={selectedNode} setSelectedNode={setSelectedNode} configNode={configNode} setConfigNode={setConfigNode}/>}
    {editorTab==='Configuration'&&<ConfigurationTab sf={sf} set={set}/>}
  </div>);
}

/* ─── shared sidebar section (collapsible) ─────────────────────────────────── */
function SidebarSection({title,subtitle,children}){
  const [open,setOpen]=useState(true);
  return(
  <div style={{marginBottom:8}}>
    <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px',cursor:'pointer'}}>
      <div><div style={{fontSize:13,fontWeight:700,color:C.ink}}>{title}</div>{subtitle&&<div style={{fontSize:11,color:C.sub}}>{subtitle}</div>}</div>
      <ChevronDown size={13} style={{color:C.sub,transform:open?'rotate(180deg)':'none',transition:'transform .15s'}}/>
    </div>
    {open&&<div style={{padding:'0 4px'}}>{children}</div>}
  </div>);
}

/* ─── zoom control bar ──────────────────────────────────────────────────────── */
function ZoomBar({zoom,setZoom,pos='left'}){
  return <div style={{position:'absolute',bottom:16,[pos]:16,display:'flex',gap:4,alignItems:'center',background:'#fff',borderRadius:8,padding:'4px 8px',border:`1px solid ${C.border}`,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
    <button onClick={()=>setZoom(z=>Math.min(z+.1,2))} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex',alignItems:'center',color:C.sub}}><Plus size={14}/></button>
    <span style={{fontSize:12,fontWeight:600,color:C.ink,minWidth:40,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
    <button onClick={()=>setZoom(z=>Math.max(z-.1,.3))} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex',alignItems:'center',color:C.sub}}><Minus size={14}/></button>
    <span style={{color:C.border}}>|</span>
    <button onClick={()=>setZoom(1)} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex',alignItems:'center',color:C.sub}} title="Fit to view"><Maximize2 size={14}/></button>
  </div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1 — SALESFORM CANVAS (branching Check-if-lead → Section)
═══════════════════════════════════════════════════════════════════════════ */
function SalesformCanvas({sf,set,selectedNode,setSelectedNode,configNode,setConfigNode}){
  const [zoom,setZoom]=useState(1);
  const evt=sf.flowNodes.find(n=>n.type==='event');
  const conditions=sf.flowNodes.filter(n=>n.type==='condition').sort((a,b)=>a.pathIndex-b.pathIndex);

  const updateNode=(id,patch)=>set({flowNodes:sf.flowNodes.map(n=>n.id===id?{...n,...patch}:n)});

  const addPath=()=>{
    const idx=conditions.length?Math.max(...conditions.map(c=>c.pathIndex))+1:0;
    const condId=newId('cond'); const secId=newId('sec');
    const condNode={id:condId,type:'condition',x:0,y:180,pathIndex:idx,label:'Check if lead',rules:[{field:'status',operator:'is',values:[]}]};
    const secNode={id:secId,type:'section',x:0,y:420,pathIndex:idx,label:`Section ${idx+1}`,fields:[]};
    set({
      flowNodes:[...sf.flowNodes,condNode,secNode],
      flowEdges:[...sf.flowEdges,{from:evt.id,to:condId},{from:condId,to:secId}],
    });
  };
  const removePath=(condNode)=>{
    const secNode=sf.flowNodes.find(n=>n.type==='section'&&n.pathIndex===condNode.pathIndex);
    const removeIds=[condNode?.id,secNode?.id].filter(Boolean);
    set({
      flowNodes:sf.flowNodes.filter(n=>!removeIds.includes(n.id)),
      flowEdges:sf.flowEdges.filter(e=>!removeIds.includes(e.from)&&!removeIds.includes(e.to)),
    });
    setConfigNode(null);
  };

  // layout is recomputed from array order every render (not persisted x), so removing a
  // middle path always re-packs the remaining branches with no visual gaps.
  const posOf=(node)=>{
    if(!node) return {x:0,y:0};
    if(node.type==='event') return {x:node.x,y:node.y};
    const idx=conditions.findIndex(c=>c.pathIndex===node.pathIndex);
    return {x:80+Math.max(idx,0)*260,y:node.type==='condition'?180:420};
  };

  const allNodes=[evt,...sf.flowNodes.filter(n=>n.type!=='event')];

  return(
  <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>
    <div style={{flex:1,position:'relative',overflow:'auto',background:'#faf9fe'}}>
      <div style={{transform:`scale(${zoom})`,transformOrigin:'top left',minHeight:760,minWidth:1100,position:'relative',padding:30}}>
        <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}>
          {sf.flowEdges.map((edge,i)=>{
            const from=allNodes.find(n=>n.id===edge.from); const to=allNodes.find(n=>n.id===edge.to);
            if(!from||!to) return null;
            const pf=posOf(from), pt=posOf(to);
            const x1=pf.x+90+30,y1=pf.y+(from.type==='event'?70:96)+30; const x2=pt.x+90+30,y2=pt.y+30; const midY=(y1+y2)/2;
            return <path key={i} d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`} stroke="var(--theme-primary-pale)" strokeWidth={2} fill="none"/>;
          })}
        </svg>

        {evt&&(
        <div style={{position:'absolute',left:evt.x+30,top:evt.y+30,width:220,zIndex:1}}>
          <div style={{background:'#fff',borderRadius:12,border:`1.5px solid ${C.border}`,boxShadow:'0 2px 12px rgba(30,20,80,.07)'}}>
            <div style={{padding:'12px 14px 10px',borderBottom:`1px solid var(--theme-surface-tint)`}}>
              <span style={{background:'var(--theme-surface-tint2)',color:'var(--theme-primary-deep)',padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>EVENT</span>
            </div>
            <div style={{padding:'8px 14px',fontSize:13,fontWeight:700,color:C.ink}}>{eventLabel(sf)}</div>
          </div>
        </div>)}

        {conditions.map((cond,idx)=>{
          const sec=sf.flowNodes.find(n=>n.type==='section'&&n.pathIndex===cond.pathIndex);
          const cp=posOf(cond), sp=sec?posOf(sec):null;
          return(
          <div key={cond.id}>
            <div style={{position:'absolute',left:cp.x+30,top:cp.y+30-26,fontSize:11,fontWeight:700,color:C.purple,display:'flex',alignItems:'center',gap:6}}>
              Path {idx+1}
              <button onClick={()=>removePath(cond)} style={{background:'none',border:'none',color:C.red,cursor:'pointer',display:'flex'}} title="Remove path"><X size={13}/></button>
            </div>
            <div onClick={()=>setConfigNode(cond.id)} style={{position:'absolute',left:cp.x+30,top:cp.y+30,width:220,cursor:'pointer',zIndex:1}}>
              <div style={{background:'#fff',borderRadius:12,border:configNode===cond.id?`2px solid ${C.purple}`:`1.5px solid ${C.border}`,boxShadow:configNode===cond.id?`0 0 0 3px ${C.purple}22`:'0 2px 12px rgba(30,20,80,.07)'}}>
                <div style={{padding:'12px 14px 10px',borderBottom:`1px solid var(--theme-surface-tint)`,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{background:'var(--theme-surface-tint2)',color:'var(--theme-primary)',padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',flexShrink:0}}>CONDITION</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.ink}}>Check if lead</span>
                </div>
                <div style={{padding:'8px 14px',display:'flex',flexDirection:'column',gap:3}}>
                  {(cond.rules||[]).map((r,ri)=>(
                    <div key={ri} style={{fontSize:11,color:C.sub}}>
                      <strong style={{color:C.ink}}>{RULE_FIELDS.find(f=>f.value===r.field)?.label||r.field}</strong> {r.operator==='is_not'?'Is Not':r.operator==='contains'?'Contains':r.operator==='any'?'Any':'Is'} {r.values?.length?r.values.join(' | '):'Any'}
                    </div>
                  ))}
                  {(!cond.rules||cond.rules.length===0)&&<div style={{fontSize:11,color:C.sub}}>Any lead</div>}
                </div>
              </div>
            </div>
            {sec&&sp&&(
            <div onClick={()=>setConfigNode(sec.id)} style={{position:'absolute',left:sp.x+30,top:sp.y+30,width:220,cursor:'pointer',zIndex:1}}>
              <div style={{background:'#fff',borderRadius:12,border:configNode===sec.id?`2px solid ${C.indigo}`:`1.5px solid ${C.border}`,boxShadow:configNode===sec.id?`0 0 0 3px ${C.indigo}22`:'0 2px 12px rgba(30,20,80,.07)'}}>
                <div style={{padding:'12px 14px 10px',borderBottom:`1px solid var(--theme-surface-tint)`,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{background:'#eef2ff',color:C.indigo,padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',flexShrink:0}}>SECTION</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.ink}}>{sec.label}</span>
                </div>
                <div style={{padding:'8px 14px',display:'flex',flexDirection:'column',gap:3}}>
                  {sec.fields.length===0?<div style={{fontSize:11,color:C.red}}>No fields configured</div>
                  :sec.fields.map(fl=><div key={fl.id} style={{fontSize:12,color:C.ink,display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:C.indigo,display:'inline-block',flexShrink:0}}/>{fl.label}{fl.required?' *':''}</div>)}
                </div>
              </div>
            </div>)}
          </div>);
        })}

        {/* add-path button */}
        <div style={{position:'absolute',left:80+conditions.length*260+30,top:180+30+18,zIndex:2}}>
          <button onClick={addPath} style={{width:30,height:30,borderRadius:'50%',border:`2px solid ${C.indigo}`,background:'#fff',color:C.indigo,fontSize:18,fontWeight:700,cursor:'pointer'}}>+</button>
        </div>
      </div>
      <ZoomBar zoom={zoom} setZoom={setZoom} pos="left"/>
    </div>

    {configNode&&(()=>{
      const node=sf.flowNodes.find(n=>n.id===configNode);
      if(!node) return null;
      return(
      <div style={{width:300,background:'#fff',borderLeft:`1px solid ${C.border}`,overflowY:'auto',padding:16,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:C.ink}}>{node.type==='condition'?'Check if lead':'Section fields'}</div>
          <button onClick={()=>setConfigNode(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.sub,display:'flex'}}><X size={15}/></button>
        </div>
        {node.type==='condition'&&<RuleEditor rules={node.rules||[]} onChange={r=>updateNode(node.id,{rules:r})}/>}
        {node.type==='section'&&<>
          <div style={{marginBottom:10}}><label style={lbl}>Section Name</label><input value={node.label} onChange={e=>updateNode(node.id,{label:e.target.value})} style={inp}/></div>
          <FieldEditor fields={node.fields||[]} onChange={f=>updateNode(node.id,{fields:f})}/>
        </>}
      </div>);
    })()}
  </div>);
}

function RuleEditor({rules,onChange}){
  const update=(i,patch)=>onChange(rules.map((r,ri)=>ri===i?{...r,...patch}:r));
  const remove=(i)=>onChange(rules.filter((_,ri)=>ri!==i));
  const add=()=>onChange([...rules,{field:'status',operator:'is',values:[]}]);
  return(
  <div style={{display:'flex',flexDirection:'column',gap:14}}>
    {rules.map((r,i)=>{
      const fdef=RULE_FIELDS.find(f=>f.value===r.field);
      return(
      <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10}}>
        <div style={{display:'flex',gap:6,marginBottom:8}}>
          <select value={r.field} onChange={e=>update(i,{field:e.target.value,values:[]})} style={{...inp,flex:1}}>
            {RULE_FIELDS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={r.operator} onChange={e=>update(i,{operator:e.target.value})} style={{...inp,width:90}}>
            <option value="is">Is</option><option value="is_not">Is Not</option><option value="contains">Contains</option><option value="any">Any</option>
          </select>
          <button onClick={()=>remove(i)} style={{background:'none',border:'none',color:C.red,cursor:'pointer',display:'flex'}}><X size={13}/></button>
        </div>
        {fdef?.options?(
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {fdef.options.map(opt=>{
              const active=r.values?.includes(opt);
              return <button key={opt} onClick={()=>update(i,{values:active?r.values.filter(v=>v!==opt):[...(r.values||[]),opt]})}
                style={{padding:'4px 10px',borderRadius:14,border:`1px solid ${active?C.indigo:C.border}`,background:active?C.indigoBg:'#fff',color:active?C.indigo:C.sub,fontSize:12,cursor:'pointer'}}>{opt}</button>;
            })}
          </div>
        ):(
          <input placeholder="Comma separated values, leave blank for Any" defaultValue={(r.values||[]).join(', ')}
            onBlur={e=>update(i,{values:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} style={inp}/>
        )}
      </div>);
    })}
    <button onClick={add} style={btnG}>+ Add Rule</button>
  </div>);
}

function FieldEditor({fields,onChange}){
  const update=(i,patch)=>onChange(fields.map((f,fi)=>fi===i?{...f,...patch}:f));
  const remove=(i)=>onChange(fields.filter((_,fi)=>fi!==i));
  const add=()=>onChange([...fields,{id:newId('fld'),label:'New Field',type:'date',required:true,mapToLeadField:'',options:[]}]);
  return(
  <div style={{display:'flex',flexDirection:'column',gap:12}}>
    {fields.map((f,i)=>(
      <div key={f.id} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10,display:'flex',flexDirection:'column',gap:6}}>
        <div style={{display:'flex',gap:6}}>
          <input value={f.label} onChange={e=>update(i,{label:e.target.value})} placeholder="Field label" style={{...inp,flex:1}}/>
          <button onClick={()=>remove(i)} style={{background:'none',border:'none',color:C.red,cursor:'pointer',display:'flex'}}><X size={13}/></button>
        </div>
        <div style={{display:'flex',gap:6}}>
          <select value={f.type} onChange={e=>update(i,{type:e.target.value})} style={{...inp,flex:1}}>
            {['date','text','number','select','textarea','checkbox'].map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:C.sub,whiteSpace:'nowrap'}}>
            <input type="checkbox" checked={f.required} onChange={e=>update(i,{required:e.target.checked})}/>Required
          </label>
        </div>
        <input value={f.mapToLeadField} onChange={e=>update(i,{mapToLeadField:e.target.value})} placeholder="Map to lead field (e.g. demoDoneDate)" list="leadFieldOptions" style={inp}/>
      </div>
    ))}
    <datalist id="leadFieldOptions">{LEAD_FIELDS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</datalist>
    <button onClick={add} style={btnG}>+ Add Field</button>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2 — WORKFLOW CANVAS (post-submission automation, n8n-style chain)
═══════════════════════════════════════════════════════════════════════════ */
function WorkflowCanvas({sf,set,users,templates,n8nWfs,selectedNode,setSelectedNode,configNode,setConfigNode}){
  const [zoom,setZoom]=useState(1);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const evt=sf.workflowNodes.find(n=>n.type==='event')||{id:'wevt_0',type:'event',x:460,y:40,label:'On SalesFlow'};

  const updateNode=(id,patch)=>set({workflowNodes:sf.workflowNodes.map(n=>n.id===id?{...n,...patch}:n)});
  const removeNode=(id)=>{
    set({workflowNodes:sf.workflowNodes.filter(n=>n.id!==id),workflowEdges:sf.workflowEdges.filter(e=>e.from!==id&&e.to!==id)});
    if(configNode===id) setConfigNode(null);
  };
  const lastNode=()=>{ const chain=sf.workflowNodes.filter(n=>n.type!=='event'); return chain.length?chain[chain.length-1]:evt; };
  const appendNode=(node)=>{
    const last=lastNode();
    set({workflowNodes:[...sf.workflowNodes,{...node,x:last.x,y:last.y+140}],workflowEdges:[...sf.workflowEdges,{from:last.id,to:node.id}]});
  };
  const addAction=(actionType)=>{
    const ac=ACTION_CATALOG.find(a=>a.type===actionType);
    appendNode({id:newId('act'),type:'action',actionType,label:ac?.label||actionType,config:{}});
  };
  const addCondition=(scope)=>{
    appendNode({id:newId('cond'),type:'condition',conditionScope:scope,label:scope==='lead'?'Lead Condition':'Event Condition',rules:[{field:'status',operator:'is',values:[]}]});
  };

  const allNodes=[evt,...sf.workflowNodes.filter(n=>n.type!=='event')];

  return(
  <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>
    <div style={{width:sidebarOpen?256:0,transition:'width .2s',overflow:'hidden',background:'#fff',borderRight:`1px solid ${C.border}`,flexShrink:0}}>
      <div style={{width:256,padding:'14px 10px 40px',overflowY:'auto',height:'100%'}}>
        <SidebarSection title="Actions" subtitle="Do this…">
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            {ACTION_CATALOG.map(a=>(
              <div key={a.type} onClick={()=>addAction(a.type)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:7,cursor:'pointer',fontSize:12,color:C.ink,transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--theme-surface-faint4)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <a.Icon size={15} style={{color:C.sub,flexShrink:0}}/><span style={{flex:1}}>{a.label}</span>
              </div>
            ))}
          </div>
        </SidebarSection>
        <SidebarSection title="Lead Condition" subtitle="If…">
          <div onClick={()=>addCondition('lead')} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:7,cursor:'pointer',fontSize:12,color:C.ink}} onMouseEnter={e=>e.currentTarget.style.background='var(--theme-surface-faint4)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <GitBranch size={15} style={{color:C.sub,flexShrink:0}}/><span>If Else</span>
          </div>
        </SidebarSection>
        <SidebarSection title="Event Condition" subtitle="If…">
          <div onClick={()=>addCondition('event')} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:7,cursor:'pointer',fontSize:12,color:C.ink}} onMouseEnter={e=>e.currentTarget.style.background='var(--theme-surface-faint4)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <GitBranch size={15} style={{color:C.sub,flexShrink:0}}/><span>If Else</span>
          </div>
        </SidebarSection>
        <SidebarSection title="n8n" subtitle="Trigger on every submission">
          <select value={sf.n8nWorkflowId||''} onChange={e=>set({n8nWorkflowId:e.target.value})} style={{...inp,fontSize:12}}>
            <option value="">None</option>
            {n8nWfs.map(nw=><option key={nw.id} value={nw.id}>{nw.name}</option>)}
          </select>
        </SidebarSection>
      </div>
    </div>
    <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{position:'absolute',left:sidebarOpen?256:0,top:'50%',zIndex:10,width:22,height:38,borderRadius:'0 8px 8px 0',border:`1px solid ${C.border}`,borderLeft:'none',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.sub,transition:'left .2s'}}>{sidebarOpen?<ChevronDown size={13} style={{transform:'rotate(90deg)'}}/>:<ChevronDown size={13} style={{transform:'rotate(-90deg)'}}/>}</button>

    <div style={{flex:1,position:'relative',overflow:'auto',background:'#faf9fe'}}>
      <div style={{transform:`scale(${zoom})`,transformOrigin:'top center',minHeight:800,minWidth:800,position:'relative',padding:20}}>
        <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}>
          {sf.workflowEdges.map((edge,i)=>{
            const from=allNodes.find(n=>n.id===edge.from); const to=allNodes.find(n=>n.id===edge.to);
            if(!from||!to) return null;
            const x1=from.x+90,y1=from.y+70; const x2=to.x+90,y2=to.y; const midY=(y1+y2)/2;
            return <path key={i} d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`} stroke="var(--theme-primary-pale)" strokeWidth={2} fill="none"/>;
          })}
        </svg>
        <WorkflowNode node={evt} sub={eventLabel(sf)} type="event" selected={selectedNode===evt.id} onClick={()=>{setSelectedNode(evt.id);setConfigNode(null)}}/>
        {sf.workflowNodes.filter(n=>n.type!=='event').map(node=>(
          <WorkflowNode key={node.id} node={node} type={node.type} selected={selectedNode===node.id}
            onClick={()=>{setSelectedNode(node.id);setConfigNode(node.id)}} onRemove={()=>removeNode(node.id)}/>
        ))}
      </div>
      <ZoomBar zoom={zoom} setZoom={setZoom} pos="right"/>
    </div>

    {configNode&&(()=>{
      const node=sf.workflowNodes.find(n=>n.id===configNode);
      if(!node) return null;
      return(
      <div style={{width:300,background:'#fff',borderLeft:`1px solid ${C.border}`,overflowY:'auto',padding:16,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:C.ink}}>Configure {node.type==='condition'?'Condition':'Action'}</div>
          <button onClick={()=>setConfigNode(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.sub,display:'flex'}}><X size={15}/></button>
        </div>
        {node.type==='condition'&&<RuleEditor rules={node.rules||[]} onChange={r=>updateNode(node.id,{rules:r})}/>}
        {node.type==='action'&&<ActionConfig node={node} updateNode={updateNode} users={users} templates={templates} n8nWfs={n8nWfs}/>}
      </div>);
    })()}
  </div>);
}

function WorkflowNode({node,type,sub,selected,onClick,onRemove}){
  const colors={event:'var(--theme-primary-deep)',action:C.indigo,condition:'#0e7490'};
  const tagBg={event:'var(--theme-surface-tint2)',action:'#eef2ff',condition:'#e0f2fe'};
  const tagFg={event:'var(--theme-primary-deep)',action:C.indigo,condition:'#0e7490'};
  const tagLabels={event:'EVENT',action:'ACTION',condition:'CONDITION'};
  const header=colors[type]||C.indigo;
  const ac=ACTION_CATALOG.find(a=>a.type===node.actionType);
  const NodeIcon=ac?.Icon;
  return(
  <div onClick={onClick} style={{position:'absolute',left:node.x,top:node.y,width:240,cursor:'pointer',zIndex:1}}>
    <div style={{background:'#fff',borderRadius:12,border:selected?`2px solid ${header}`:`1.5px solid ${C.border}`,boxShadow:selected?`0 0 0 3px ${header}22`:'0 2px 12px rgba(30,20,80,.07)'}}>
      <div style={{padding:'12px 14px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,borderBottom:`1px solid var(--theme-surface-tint)`}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:tagBg[type],color:tagFg[type],padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',flexShrink:0}}>{tagLabels[type]}</span>
          <span style={{fontSize:13.5,fontWeight:700,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{node.label}</span>
        </div>
        {onRemove&&<button onClick={e=>{e.stopPropagation();onRemove()}} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',display:'flex',flexShrink:0}}><MoreVertical size={14}/></button>}
      </div>
      <div style={{padding:'8px 14px',display:'flex',alignItems:'center',gap:6}}>
        {NodeIcon?<NodeIcon size={13} style={{color:header,flexShrink:0}}/>:null}
        <span style={{fontSize:12,color:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{type==='event'?sub:type==='condition'?`${node.conditionScope==='lead'?'Lead':'Event'} If Else`:'configured'}</span>
      </div>
    </div>
    <div style={{position:'absolute',bottom:-8,left:'50%',transform:'translateX(-50%)',width:16,height:16,borderRadius:'50%',border:`2px solid ${header}`,background:'#fff',zIndex:2}}/>
  </div>);
}

function ActionConfig({node,updateNode,users,templates,n8nWfs}){
  const cfg=node.config||{};
  const upd=(patch)=>updateNode(node.id,{config:{...cfg,...patch}});
  return(
  <div style={{display:'flex',flexDirection:'column',gap:10}}>
    <div><label style={lbl}>Action Type</label>
      <select value={node.actionType} onChange={e=>updateNode(node.id,{actionType:e.target.value,label:ACTION_CATALOG.find(a=>a.type===e.target.value)?.label||e.target.value})} style={inp}>
        {ACTION_CATALOG.map(a=><option key={a.type} value={a.type}>{a.label}</option>)}
      </select>
    </div>
    {node.actionType==='call_api'&&<div><label style={lbl}>API Template</label><select value={cfg.apiTemplateId||''} onChange={e=>upd({apiTemplateId:e.target.value})} style={inp}><option value="">Select…</option>{templates.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}</select></div>}
    {node.actionType==='notify_team_member'&&<><div><label style={lbl}>Team Member</label><select value={cfg.userId||''} onChange={e=>upd({userId:e.target.value})} style={inp}><option value="">Assigned caller</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div><div><label style={lbl}>Message</label><input value={cfg.message||''} onChange={e=>upd({message:e.target.value})} placeholder="Use {{lead.name}}" style={inp}/></div></>}
    {node.actionType==='update_lead_status'&&<div><label style={lbl}>New Status</label><select value={cfg.status||''} onChange={e=>upd({status:e.target.value})} style={inp}><option value="">Select…</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>}
    {node.actionType==='update_lead_assignee'&&<div><label style={lbl}>Assign To</label><select value={cfg.userId||''} onChange={e=>upd({userId:e.target.value})} style={inp}><option value="">Select…</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div>}
    {node.actionType==='update_lead_rating'&&<div><label style={lbl}>Rating</label><select value={cfg.rating||''} onChange={e=>upd({rating:Number(e.target.value)})} style={inp}><option value="">Select…</option>{[1,2,3,4,5].map(r=><option key={r} value={r}>{r} ★</option>)}</select></div>}
    {node.actionType==='update_lead_fields'&&<div><label style={lbl}>Lead Field</label><select value={cfg.leadField||''} onChange={e=>upd({leadField:e.target.value,fieldMap:{[e.target.value]:cfg.value||''}})} style={inp}><option value="">Select…</option>{LEAD_FIELDS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select><label style={{...lbl,marginTop:8}}>Value</label><input value={cfg.value||''} onChange={e=>upd({value:e.target.value,fieldMap:{[cfg.leadField||'']:e.target.value}})} placeholder="Static value or {{submission.fieldId}}" style={inp}/></div>}
    {node.actionType==='time_delay'&&<div><label style={lbl}>Delay (minutes)</label><input type="number" min="0" value={cfg.minutes||0} onChange={e=>upd({minutes:Number(e.target.value)})} style={inp}/></div>}
    {node.actionType==='add_in_list'&&<div><label style={lbl}>List Name</label><input value={cfg.listName||''} onChange={e=>upd({listName:e.target.value})} style={inp}/></div>}
    {node.actionType==='remove_from_list'&&<div><label style={lbl}>List Name</label><input value={cfg.listName||''} onChange={e=>upd({listName:e.target.value})} style={inp}/></div>}
    {node.actionType==='add_call_followup'&&<><div><label style={lbl}>Assign To</label><select value={cfg.userId||''} onChange={e=>upd({userId:e.target.value})} style={inp}><option value="">Assigned caller</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div><div><label style={lbl}>Note</label><input value={cfg.note||''} onChange={e=>upd({note:e.target.value})} style={inp}/></div></>}
    {node.actionType==='add_payment'&&<div><label style={lbl}>Amount (₹)</label><input type="number" value={cfg.amount||0} onChange={e=>upd({amount:Number(e.target.value)})} style={inp}/></div>}
    {node.actionType==='send_template'&&<div><label style={lbl}>Template ID</label><input value={cfg.templateId||''} onChange={e=>upd({templateId:e.target.value})} style={inp}/></div>}
    {node.actionType==='create_custom_action'&&<div><label style={lbl}>Label</label><input value={cfg.label||''} onChange={e=>upd({label:e.target.value})} style={inp}/></div>}
    {node.actionType==='add_ivr_action'&&<div style={{fontSize:12,color:C.sub}}>Connect an IVR provider in Settings to configure this action.</div>}
    {node.actionType==='cancel_tasks'&&<div style={{fontSize:12,color:C.sub}}>Cancels all upcoming follow-up tasks for this lead.</div>}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 3 — CONFIGURATION (Mandatory + Permission Templates)
═══════════════════════════════════════════════════════════════════════════ */
const ROLE_LABELS={caller:'Caller Permissions',manager:'Manager Permissions',admin:'Admin Permissions'};
function ConfigurationTab({sf,set}){
  const [search,setSearch]=useState('');
  const perms=sf.permissions?.length?sf.permissions:[{role:'caller',view:false,submit:true},{role:'manager',view:true,submit:true},{role:'admin',view:true,submit:true}];
  const update=(role,patch)=>set({permissions:perms.map(p=>p.role===role?{...p,...patch}:p)});
  const filtered=perms.filter(p=>(ROLE_LABELS[p.role]||p.role).toLowerCase().includes(search.toLowerCase()));

  return(
  <div style={{flex:1,overflow:'auto',padding:'24px 32px',maxWidth:760}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
      <div><div style={{fontSize:15,fontWeight:700,color:C.ink}}>Mandatory</div><div style={{fontSize:13,color:C.sub}}>Salesform will not be closed unless submitted</div></div>
      <button onClick={()=>set({mandatory:!sf.mandatory})} style={{width:42,height:22,borderRadius:11,border:'none',cursor:'pointer',background:sf.mandatory?C.indigo:'#d1d5db',position:'relative'}}>
        <span style={{position:'absolute',top:2,left:sf.mandatory?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
      </button>
    </div>
    <div style={{fontSize:15,fontWeight:700,color:C.ink,marginBottom:4}}>Permission Templates</div>
    <div style={{fontSize:13,color:C.sub,marginBottom:12}}>Handle this salesform access based on role</div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Permission Name" style={{...inp,marginBottom:14}}/>
    <div style={{...card,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',padding:'11px 18px',background:'var(--theme-surface-faint2)',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase'}}>
        <span>Name</span><span>View</span><span>Submit</span>
      </div>
      {filtered.map((p,i)=>(
        <div key={p.role} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',padding:'13px 18px',alignItems:'center',borderBottom:i<filtered.length-1?'1px solid var(--theme-surface-faint5)':'none'}}>
          <span style={{fontWeight:600,color:C.ink,fontSize:14}}>{ROLE_LABELS[p.role]||p.role}</span>
          <ToggleSmall on={p.view} onToggle={()=>update(p.role,{view:!p.view})}/>
          <ToggleSmall on={p.submit} onToggle={()=>update(p.role,{submit:!p.submit})}/>
        </div>
      ))}
    </div>
  </div>);
}
function ToggleSmall({on,onToggle}){
  return <button onClick={onToggle} style={{width:38,height:20,borderRadius:10,border:'none',cursor:'pointer',background:on?C.indigo:'#d1d5db',position:'relative'}}>
    <span style={{position:'absolute',top:2,left:on?20:2,width:16,height:16,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
  </button>;
}