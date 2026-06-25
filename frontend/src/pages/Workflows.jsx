import { useState, useEffect, useCallback, useRef } from 'react';
import { workflowsAPI, usersAPI, apiTemplatesAPI, webhooksAPI, n8nAPI } from '../services/api';

/* ─── palette ─────────────────────────────────────────────────────────────── */
const C={indigo:'#6366f1',purple:'#7c3aed',indigoBg:'#f0eeff',border:'#e5e2f5',ink:'#1e1b4b',sub:'#6b7280',green:'#059669',red:'#dc2626',amber:'#b45309'};
const card={background:'#fff',border:`1px solid ${C.border}`,borderRadius:12};
const btnP={padding:'8px 18px',borderRadius:8,border:'none',background:C.indigo,color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer'};
const btnG={padding:'7px 14px',borderRadius:8,border:`1.5px solid ${C.border}`,background:'#fff',color:C.ink,fontWeight:600,fontSize:13,cursor:'pointer'};
const inp={width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'};
const lbl={fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5,display:'block'};

/* ─── event catalog (matches TeleCRM exactly) ─────────────────────────────── */
const EVENT_CATALOG=[
  // Whatsapp group
  {value:'lead.whatsapp_lead',label:'On WhatsApp lead',icon:'💬',group:'Whatsapp',wfType:'Lead Creation'},
  {value:'lead.whatsapp_received',label:'On WhatsApp received',icon:'💬',group:'Whatsapp',wfType:'Messaging'},
  {value:'lead.template_replied',label:'On template replied',icon:'💬',group:'Whatsapp',wfType:'Messaging',hasTemplates:true},
  {value:'lead.waca_list_replied',label:'On WACA List Replied',icon:'💬',group:'Whatsapp',wfType:'Messaging'},
  // On Lead Field Change group (expandable with specific fields)
  {value:'lead.field_changed',label:'On Lead Field Change',icon:'⚙️',group:'Lead Field Change',wfType:'Lead Updation',hasFields:true},
  {value:'lead.field_changed.name',label:'Name',icon:'T',group:'Lead Field Change',wfType:'Lead Updation',parentField:'name'},
  {value:'lead.field_changed.phone',label:'Phone',icon:'📞',group:'Lead Field Change',wfType:'Lead Updation',parentField:'phone'},
  {value:'lead.field_changed.email',label:'Email',icon:'✉️',group:'Lead Field Change',wfType:'Lead Updation',parentField:'email'},
  {value:'lead.field_changed.alternatePhone',label:'Alternate Phone',icon:'📞',group:'Lead Field Change',wfType:'Lead Updation',parentField:'alternatePhone'},
  {value:'lead.field_changed.courseInterest',label:'Preferred Courses',icon:'📚',group:'Lead Field Change',wfType:'Lead Updation',parentField:'courseInterest'},
  {value:'lead.field_changed.location',label:'Location',icon:'T',group:'Lead Field Change',wfType:'Lead Updation',parentField:'location'},
  {value:'lead.field_changed.budget',label:'Budget',icon:'₹',group:'Lead Field Change',wfType:'Lead Updation',parentField:'budget'},
  {value:'lead.field_changed.nextFollowUpDate',label:'Next Followup Date',icon:'📅',group:'Lead Field Change',wfType:'Lead Updation',parentField:'nextFollowUpDate'},
  {value:'lead.field_changed.demoScheduledDate',label:'Demo Scheduled Date',icon:'📅',group:'Lead Field Change',wfType:'Lead Updation',parentField:'demoScheduledDate'},
  // Lead Creation events
  {value:'lead.facebook_lead',label:'On Facebook lead',icon:'📘',group:'Lead Sources',wfType:'Lead Creation'},
  {value:'lead.web_created',label:'On Website lead',icon:'🌐',group:'Lead Sources',wfType:'Lead Creation'},
  {value:'lead.justdial_lead',label:'On Justdial lead',icon:'📞',group:'Lead Sources',wfType:'Lead Creation'},
  {value:'lead.woocommerce',label:'On WooCommerce payment',icon:'🛒',group:'Lead Sources',wfType:'Lead Creation'},
  {value:'lead.call_log',label:'On call log lead',icon:'📱',group:'Lead Sources',wfType:'Lead Creation'},
  {value:'lead.excel_upload',label:'On Excel upload lead',icon:'📊',group:'Lead Sources',wfType:'Lead Creation'},
  {value:'lead.manual_created',label:'On manual lead',icon:'⚙️',group:'Lead Sources',wfType:'Lead Creation'},
  // Lead Events
  {value:'lead.status_changed',label:'On Lead Status Change',icon:'🏷️',group:'Lead Events',wfType:'Lead Updation'},
  {value:'lead.rating_changed',label:'On Lead Rating Change',icon:'⭐',group:'Lead Events',wfType:'Lead Updation'},
  {value:'lead.assignee_changed',label:'On Lead Assignment Change',icon:'👤',group:'Lead Events',wfType:'Lead Updation'},
  {value:'lead.user_note',label:'On User Note',icon:'📝',group:'Lead Events',wfType:'Lead Activity'},
  {value:'lead.system_note',label:'On System Note',icon:'📄',group:'Lead Events',wfType:'Lead Activity'},
  {value:'lead.note_added',label:'On Note Added',icon:'📝',group:'Lead Events',wfType:'Lead Activity'},
  {value:'lead.location_checkin',label:'On Location Check-in',icon:'📍',group:'Lead Events',wfType:'Lead Activity'},
  {value:'lead.created',label:'On any lead created',icon:'➕',group:'Lead Events',wfType:'Lead Creation'},
  {value:'lead.added_to_list',label:'Added in List',icon:'📋',group:'Lead Events',wfType:'Lead Updation'},
  {value:'lead.removed_from_list',label:'Removed from List',icon:'🗑️',group:'Lead Events',wfType:'Lead Updation'},
  {value:'lead.template_message_sent',label:'On template message sent',icon:'💬',group:'Messaging',wfType:'Lead Activity'},
];

/* ─── action palette (matches TeleCRM sidebar) ────────────────────────────── */
const ACTION_CATALOG=[
  {type:'call_api',label:'Call API',icon:'🔗',desc:'Call external API template'},
  {type:'trigger_n8n',label:'Trigger n8n',icon:'⚡',desc:'Trigger n8n workflow'},
  {type:'notify_team_member',label:'Notify Team',icon:'🔔',desc:'Send notification to team member'},
  {type:'update_lead_assignee',label:'Update Assignee',icon:'👤',desc:'Change lead assignee'},
  {type:'update_lead_status',label:'Update Status',icon:'🏷️',desc:'Change lead status'},
  {type:'update_lead_rating',label:'Update Rating',icon:'⭐',desc:'Change lead rating'},
  {type:'trigger_webhook',label:'Trigger Webhook',icon:'🪝',desc:'Fire outbound webhook'},
  {type:'custom_action',label:'Custom Action',icon:'✨',desc:'Create custom action'},
  {type:'send_template',label:'Send Template',icon:'💬',desc:'Send message template'},
  {type:'email_report',label:'Email Report',icon:'📧',desc:'Email lead report'},
];

const STATUSES=['Fresh','Connected','Call Back Later','Not interested','Demo Scheduled','Demo Done','Won','Lost'];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Workflows({kind='WORKFLOW'}){
  const isSchedule=kind==='SCHEDULE';
  const title=isSchedule?'Schedules':'Workflows';
  const [loading,setLoading]=useState(true);
  const [workflows,setWorkflows]=useState([]);
  const [summary,setSummary]=useState({totalRuns:0,success:0,failed:0,sleeping:0,waiting:0});
  const [tab,setTab]=useState('published');
  const [search,setSearch]=useState('');
  const [eventFilter,setEventFilter]=useState('');
  const [timePeriod,setTimePeriod]=useState('24h');
  const [editing,setEditing]=useState(null);
  const [showEventModal,setShowEventModal]=useState(false);
  const [users,setUsers]=useState([]);
  const [templates,setTemplates]=useState([]);
  const [hooks,setHooks]=useState([]);
  const [n8nWfs,setN8nWfs]=useState([]);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await workflowsAPI.getAll({kind,status:tab,search});
      setWorkflows(r.data.workflows);
      setSummary(r.data.summary||{totalRuns:0,success:0,failed:0,sleeping:0,waiting:0});
    }catch(e){console.error(e)}
    setLoading(false);
  },[kind,tab,search]);

  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    usersAPI.getAll().then(r=>setUsers(r.data.users||r.data||[])).catch(()=>{});
    apiTemplatesAPI.getAll().then(r=>setTemplates(r.data.templates||[])).catch(()=>{});
    webhooksAPI.getAll().then(r=>setHooks(r.data.webhooks||[])).catch(()=>{});
    n8nAPI.cachedWorkflows().then(r=>setN8nWfs(r.data.workflows||[])).catch(()=>{});
  },[]);

  const handleCreateNew=(ev)=>{
    setShowEventModal(false);
    const cat=EVENT_CATALOG.find(e=>e.value===ev)||EVENT_CATALOG[0];
    setEditing({
      name:cat.label, kind, status:'draft',
      triggerEvent:ev, workflowType:cat.wfType||'Lead Updation',
      triggerConfig:{}, conditions:[], actions:[], n8nWorkflowId:'',
      nodes:[{id:'evt_0',type:'event',event:ev,label:cat.label,x:400,y:80}],
      edges:[],
      scheduleConfig:{delayMinutes:isSchedule?60:0,cancelIfStatusChanged:true},
    });
  };

  if(editing) return <FlowchartEditor kind={kind} initial={editing} users={users} templates={templates} hooks={hooks} n8nWfs={n8nWfs} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}} />;

  const filtered=workflows.filter(w=>{
    if(eventFilter && w.triggerEvent!==eventFilter) return false;
    return true;
  });

  const statCards=[
    {k:'totalRuns',label:'Total Runs',color:C.ink},
    {k:'success',label:'Success',color:C.green,pct:true},
    {k:'failed',label:'Failed',color:C.red},
    {k:'sleeping',label:'Sleeping',color:C.amber},
    {k:'waiting',label:'Waiting for Reply',color:C.sub},
  ];

  return(
  <div style={{padding:'24px 28px',maxWidth:1140,margin:'0 auto'}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
      <div>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:C.ink}}>{title}</h2>
        <p style={{margin:'4px 0 0',color:C.sub,fontSize:14}}>{isSchedule?'Automatically keep in touch with your leads':'Execute complex automations with ease'}</p>
      </div>
      <button style={btnP} onClick={()=>setShowEventModal(true)}>{isSchedule?'Create New Schedule':'Create Workflow'} +</button>
    </div>

    {/* stat cards */}
    <div style={{...card,padding:'18px 20px',marginBottom:20}}>
      <div style={{display:'flex',justifyContent:'flex-end',gap:4,marginBottom:12}}>
        {['All','24h','7d','30d'].map(p=>(
          <button key={p} onClick={()=>setTimePeriod(p)} style={{padding:'4px 12px',borderRadius:6,border:`1px solid ${timePeriod===p?C.indigo:C.border}`,background:timePeriod===p?'#ede9fe':'#fff',color:timePeriod===p?C.indigo:C.sub,fontSize:12,fontWeight:600,cursor:'pointer'}}>{p}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16}}>
        {statCards.map(s=>(
          <div key={s.k}>
            <div style={{fontSize:11,color:C.sub,fontWeight:600,marginBottom:4,display:'flex',alignItems:'center',gap:4}}>{s.label} <span style={{cursor:'help',opacity:.5}}>ⓘ</span></div>
            <div style={{fontSize:28,fontWeight:700,color:s.color}}>
              {s.pct?`${summary.totalRuns?Math.round((summary.success/summary.totalRuns)*100):0}%`:(summary[s.k]||0)}
            </div>
            <div style={{fontSize:11,color:C.sub}}>last {timePeriod==='All'?'30 days':timePeriod}</div>
          </div>
        ))}
      </div>
    </div>

    {/* tabs + filters */}
    <div style={{display:'flex',gap:24,borderBottom:`1px solid ${C.border}`,marginBottom:14}}>
      {['published','draft'].map(t=>(
        <button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',padding:'8px 2px',cursor:'pointer',fontSize:14,fontWeight:600,textTransform:'capitalize',color:tab===t?C.indigo:C.sub,borderBottom:tab===t?`2.5px solid ${C.indigo}`:'2.5px solid transparent'}}>{t}</button>
      ))}
    </div>
    <div style={{display:'flex',gap:12,marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search flowchart by Name" style={{...inp,maxWidth:420}} />
      <select value={eventFilter} onChange={e=>setEventFilter(e.target.value)} style={{...inp,maxWidth:240}}>
        <option value="">All Events</option>
        {EVENT_CATALOG.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}
      </select>
    </div>

    {/* count */}
    <div style={{fontSize:13,color:C.sub,marginBottom:8}}>{filtered.length} matching flowcharts found</div>

    {/* table */}
    {loading?<div style={{textAlign:'center',padding:50,color:C.sub}}>Loading…</div>:(
    <div style={{...card,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.6fr 1.2fr .7fr .7fr 1fr .8fr',padding:'11px 18px',background:'#f9f8ff',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em'}}>
        <span>Name</span><span>Events</span><span>Status</span><span>Total runs</span><span>Last 24h runs/failures</span><span style={{textAlign:'right'}}>Actions</span>
      </div>
      {filtered.length===0?<div style={{padding:40,textAlign:'center',color:C.sub}}>No Flowcharts Found</div>
      :filtered.map((w,i)=>{
        const ev=EVENT_CATALOG.find(e=>e.value===w.triggerEvent);
        return(
        <div key={w._id} style={{display:'grid',gridTemplateColumns:'1.6fr 1.2fr .7fr .7fr 1fr .8fr',padding:'13px 18px',alignItems:'center',borderBottom:i<filtered.length-1?'1px solid #f0eef8':'none'}}>
          <span style={{fontWeight:600,color:C.ink,cursor:'pointer'}} onClick={()=>setEditing(w)}>{w.name}</span>
          <span><EventBadge ev={ev} triggerEvent={w.triggerEvent}/></span>
          <span><StatusToggle status={w.status} onToggle={async()=>{await workflowsAPI.setStatus(w._id,w.status==='published'?'draft':'published').catch(e=>alert(e.response?.data?.message||'Failed'));load();}}/></span>
          <span style={{fontSize:13,color:C.sub}}>{w.stats?.totalRuns||0}</span>
          <span style={{fontSize:13,color:C.sub}}>{w.stats?.success||0} / <span style={{color:C.red}}>{w.stats?.failed||0}</span></span>
          <span style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
            <button style={{...btnG,padding:'4px 8px',fontSize:12}} onClick={()=>setEditing(w)} title="Edit">✎</button>
            <button style={{...btnG,padding:'4px 8px',fontSize:12}} title="Duplicate">⧉</button>
            <button style={{...btnG,padding:'4px 8px',fontSize:12,color:C.red,borderColor:'#fecaca'}} title="Delete" onClick={async()=>{if(confirm('Delete?')){await workflowsAPI.delete(w._id);load();}}}>🗑</button>
          </span>
        </div>);
      })}
    </div>)}

    {/* event selection modal */}
    {showEventModal&&<EventSelectionModal onSelect={handleCreateNew} onClose={()=>setShowEventModal(false)}/>}
  </div>);
}

/* ─── EVENT BADGE ─────────────────────────────────────────────────────────── */
function EventBadge({ev,triggerEvent}){
  const colors={
    'Lead Creation':['#ede9fe','#7c3aed'],
    'Lead Updation':['#dbeafe','#2563eb'],
    'Lead Activity':['#d1fae5','#059669'],
    'Messaging':['#fef3c7','#b45309'],
  };
  const [bg,fg]=colors[ev?.wfType]||colors['Lead Updation'];
  return <span style={{background:bg,color:fg,padding:'3px 10px',borderRadius:16,fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>{ev?.icon} {ev?.wfType||triggerEvent}</span>;
}

/* ─── STATUS TOGGLE ───────────────────────────────────────────────────────── */
function StatusToggle({status,onToggle}){
  const on=status==='published';
  return <button onClick={onToggle} style={{width:42,height:22,borderRadius:11,border:'none',cursor:'pointer',background:on?C.indigo:'#d1d5db',position:'relative',transition:'background .15s'}}>
    <span style={{position:'absolute',top:2,left:on?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .15s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
  </button>;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  EVENT SELECTION MODAL (exact TeleCRM style)                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
function EventSelectionModal({onSelect,onClose}){
  const [search,setSearch]=useState('');
  const groups={};
  EVENT_CATALOG.forEach(e=>{(groups[e.group]=groups[e.group]||[]).push(e)});
  const filtered=search?EVENT_CATALOG.filter(e=>e.label.toLowerCase().includes(search.toLowerCase())):null;

  return(
  <div style={{position:'fixed',inset:0,background:'rgba(30,27,75,.45)',display:'flex',justifyContent:'flex-end',zIndex:1000}}>
    <div style={{width:440,maxWidth:'100vw',background:'#fff',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,.15)'}}>
      <div style={{padding:'20px 22px 14px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div><div style={{fontSize:17,fontWeight:700,color:C.ink}}>Select event</div><div style={{fontSize:13,color:C.sub}}>Select the event that will trigger the workflow</div></div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.sub}}>✕</button>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search for event e.g. facebook, payment, manual…" style={{...inp,background:'#f9fafb'}}/>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
        {filtered?filtered.map(e=><EventRow key={e.value} ev={e} onClick={()=>onSelect(e.value)}/>)
        :Object.entries(groups).map(([group,evts])=>(
          <div key={group}>
            <div style={{padding:'10px 22px 4px',fontSize:12,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em'}}>{group}</div>
            {evts.map(e=><EventRow key={e.value} ev={e} onClick={()=>onSelect(e.value)}/>)}
          </div>
        ))}
      </div>
      <div style={{padding:14,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'flex-end'}}>
        <button style={btnP} disabled>Next</button>
      </div>
    </div>
  </div>);
}
function EventRow({ev,onClick}){
  return <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 22px',cursor:'pointer',transition:'background .1s'}}
    onMouseEnter={e=>e.currentTarget.style.background='#f5f3ff'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
    <span style={{fontSize:18,width:24,textAlign:'center'}}>{ev.icon}</span>
    <span style={{flex:1,fontSize:14,color:C.ink,fontWeight:500}}>{ev.label}</span>
    {ev.wfType==='Lead Creation'&&<span style={{fontSize:11,color:C.sub}}>Draft</span>}
  </div>;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  VISUAL FLOWCHART EDITOR                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */
function FlowchartEditor({kind,initial,users,templates,hooks,n8nWfs,onClose,onSaved}){
  const isSchedule=kind==='SCHEDULE';
  const [wf,setWf]=useState(()=>{
    const base={...initial};
    if(!base.nodes||!base.nodes.length){
      const ev=EVENT_CATALOG.find(e=>e.value===base.triggerEvent)||EVENT_CATALOG[0];
      base.nodes=[{id:'evt_0',type:'event',event:base.triggerEvent,label:ev?.label||base.triggerEvent,x:380,y:60}];
      base.edges=[];
    }
    return base;
  });
  const [editorTab,setEditorTab]=useState('editor');
  const [saving,setSaving]=useState(false);
  const [executions,setExecutions]=useState([]);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [selectedNode,setSelectedNode]=useState(null);
  const [zoom,setZoom]=useState(1);
  const [configNode,setConfigNode]=useState(null);
  const canvasRef=useRef(null);
  const id=wf._id;

  useEffect(()=>{
    if(editorTab==='executions'&&id) workflowsAPI.getExecutions(id,{limit:30}).then(r=>setExecutions(r.data.executions)).catch(()=>{});
  },[editorTab,id]);

  const set=p=>setWf(prev=>({...prev,...p}));
  const updateNode=(nodeId,patch)=>set({nodes:wf.nodes.map(n=>n.id===nodeId?{...n,...patch}:n)});

  const addActionNode=(actionType)=>{
    const ac=ACTION_CATALOG.find(a=>a.type===actionType);
    const lastNode=wf.nodes[wf.nodes.length-1];
    const newId=`act_${Date.now()}`;
    const newNode={id:newId,type:'action',actionType,label:ac?.label||actionType,config:{},x:lastNode?lastNode.x:380,y:lastNode?lastNode.y+140:200};
    const newEdge={from:lastNode?.id||'evt_0',to:newId};
    set({nodes:[...wf.nodes,newNode],edges:[...wf.edges,newEdge]});
  };

  const addConditionNode=(condType)=>{
    const lastNode=wf.nodes[wf.nodes.length-1];
    const newId=`cond_${Date.now()}`;
    const newNode={id:newId,type:'condition',conditionType:condType,label:condType==='lead'?'Lead Condition':'Event Condition',config:{field:'',operator:'equals',value:''},x:lastNode?lastNode.x:380,y:lastNode?lastNode.y+140:200};
    const newEdge={from:lastNode?.id||'evt_0',to:newId};
    set({nodes:[...wf.nodes,newNode],edges:[...wf.edges,newEdge]});
  };

  const removeNode=(nodeId)=>{
    set({nodes:wf.nodes.filter(n=>n.id!==nodeId),edges:wf.edges.filter(e=>e.from!==nodeId&&e.to!==nodeId)});
    if(selectedNode===nodeId) setSelectedNode(null);
    if(configNode===nodeId) setConfigNode(null);
  };

  const save=async(publish=false)=>{
    if(!wf.name.trim()) return alert('Enter a name');
    setSaving(true);
    try{
      // convert nodes to actions array for backend
      const actions=wf.nodes.filter(n=>n.type==='action').map(n=>({type:n.actionType,config:n.config||{}}));
      const conditions=wf.nodes.filter(n=>n.type==='condition').map(n=>({field:n.config?.field||'',operator:n.config?.operator||'equals',value:n.config?.value||''}));
      const payload={...wf,actions,conditions,kind,nodes:wf.nodes,edges:wf.edges};
      let saved;
      if(id) saved=(await workflowsAPI.update(id,payload)).data.workflow;
      else saved=(await workflowsAPI.create(payload)).data.workflow;
      if(publish) await workflowsAPI.setStatus(saved._id,'published');
      onSaved();
    }catch(e){alert(e.response?.data?.message||'Save failed')}
    setSaving(false);
  };

  const evCat=EVENT_CATALOG.find(e=>e.value===wf.triggerEvent)||{};

  return(
  <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#f8f7fc'}}>
    {/* top bar */}
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 20px',background:'#fff',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      <button onClick={onClose} style={{...btnG,padding:'6px 12px'}}>←</button>
      <input value={wf.name} onChange={e=>set({name:e.target.value})} style={{...inp,fontWeight:700,fontSize:15,maxWidth:280,background:'transparent',border:'none'}}/>
      <span style={{fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:20,background:wf.status==='published'?'#d1fae5':'#fef3c7',color:wf.status==='published'?C.green:C.amber}}>{wf.status==='published'?'Published':'Draft'}</span>
      {wf.workflowType&&<span style={{fontSize:12,color:C.sub}}>Workflow Type: {wf.workflowType}</span>}
      <div style={{flex:1}}/>
      <span style={{fontSize:12,color:C.sub}}>Last saved was…</span>
      <button style={{...btnG,opacity:wf.status==='published'?.5:1}} onClick={()=>save(true)} disabled={saving}>Publish</button>
      <button style={btnP} onClick={()=>save(false)} disabled={saving}>{saving?'Saving…':'Edit'}</button>
      <button style={{...btnG,padding:'6px 10px',color:C.red,borderColor:'#fecaca'}} onClick={async()=>{if(id&&confirm('Delete?')){await workflowsAPI.delete(id);onClose();}else onClose();}}>🗑</button>
    </div>

    {/* editor/executions tabs */}
    <div style={{display:'flex',justifyContent:'center',background:'#fff',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      {['editor','executions'].map(t=>(
        <button key={t} onClick={()=>setEditorTab(t)} style={{background:'none',border:'none',padding:'10px 20px',cursor:'pointer',fontSize:14,fontWeight:600,textTransform:'capitalize',color:editorTab===t?C.indigo:C.sub,borderBottom:editorTab===t?`2.5px solid ${C.indigo}`:'2.5px solid transparent'}}>{t}</button>
      ))}
    </div>

    {editorTab==='editor'?(
    <div style={{display:'flex',flex:1,overflow:'hidden'}}>
      {/* LEFT SIDEBAR PALETTE */}
      <div style={{width:sidebarOpen?170:0,transition:'width .2s',overflow:'hidden',background:'#fff',borderRight:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{width:170,padding:'12px 10px',overflowY:'auto',height:'100%'}}>
          {/* Events */}
          <SidebarSection title="Events" subtitle="When this happens">
            <div style={{fontSize:12,color:C.sub,padding:'4px 0'}}>Trigger: <strong style={{color:C.ink}}>{evCat.label||wf.triggerEvent}</strong></div>
          </SidebarSection>

          {/* Actions */}
          <SidebarSection title="Actions" subtitle="Do this…">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {ACTION_CATALOG.map(a=>(
                <div key={a.type} onClick={()=>addActionNode(a.type)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'8px 4px',borderRadius:8,cursor:'pointer',fontSize:11,color:C.sub,textAlign:'center',lineHeight:1.2,transition:'background .1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f0eeff'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{fontSize:18}}>{a.icon}</span>
                  <span>{a.label}</span>
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* Lead Condition */}
          <SidebarSection title="Lead Condition" subtitle="If…">
            <div onClick={()=>addConditionNode('lead')} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,cursor:'pointer',fontSize:13,color:C.sub}} onMouseEnter={e=>e.currentTarget.style.background='#f0eeff'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{fontSize:16}}>🔀</span> If Else
            </div>
          </SidebarSection>

          {/* Event Condition */}
          <SidebarSection title="Event Condition" subtitle="If…">
            <div onClick={()=>addConditionNode('event')} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,cursor:'pointer',fontSize:13,color:C.sub}} onMouseEnter={e=>e.currentTarget.style.background='#f0eeff'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{fontSize:16}}>🔀</span> If Else
            </div>
          </SidebarSection>

          {/* n8n link */}
          {n8nWfs.length>0&&(
            <SidebarSection title="⚡ n8n" subtitle="Link workflow">
              <select value={wf.n8nWorkflowId||''} onChange={e=>set({n8nWorkflowId:e.target.value})} style={{...inp,fontSize:12}}>
                <option value="">None</option>
                {n8nWfs.map(nw=><option key={nw.id} value={nw.id}>{nw.name}</option>)}
              </select>
            </SidebarSection>
          )}
        </div>
      </div>

      {/* SIDEBAR TOGGLE */}
      <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{position:'absolute',left:sidebarOpen?170:0,top:'50%',zIndex:10,width:24,height:40,borderRadius:'0 8px 8px 0',border:`1px solid ${C.border}`,borderLeft:'none',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:C.sub,transition:'left .2s'}}>{sidebarOpen?'◂':'▸'}</button>

      {/* CANVAS */}
      <div ref={canvasRef} style={{flex:1,position:'relative',overflow:'auto',background:'#faf9fe'}}>
        <div style={{transform:`scale(${zoom})`,transformOrigin:'top center',minHeight:800,minWidth:800,position:'relative',padding:20}}>
          {/* SVG connections */}
          <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}>
            {wf.edges.map((edge,i)=>{
              const from=wf.nodes.find(n=>n.id===edge.from);
              const to=wf.nodes.find(n=>n.id===edge.to);
              if(!from||!to) return null;
              const x1=from.x+90,y1=from.y+70;
              const x2=to.x+90,y2=to.y;
              const midY=(y1+y2)/2;
              return <path key={i} d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`} stroke="#c4b5fd" strokeWidth={2} fill="none"/>;
            })}
          </svg>

          {/* Nodes */}
          {wf.nodes.map(node=>(
            <FlowNode key={node.id} node={node} selected={selectedNode===node.id}
              onClick={()=>{setSelectedNode(node.id);setConfigNode(node.id)}}
              onRemove={node.type!=='event'?()=>removeNode(node.id):null}
            />
          ))}

          {/* Add node button at bottom */}
          <div style={{position:'absolute',left:wf.nodes[wf.nodes.length-1]?.x+75||440,top:(wf.nodes[wf.nodes.length-1]?.y||60)+100,zIndex:2}}>
            <button onClick={()=>addActionNode('custom_action')} style={{width:30,height:30,borderRadius:'50%',border:`2px solid ${C.indigo}`,background:'#fff',color:C.indigo,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>+</button>
          </div>
        </div>

        {/* Zoom controls */}
        <div style={{position:'absolute',bottom:16,left:16,display:'flex',gap:4,alignItems:'center',background:'#fff',borderRadius:8,padding:'4px 8px',border:`1px solid ${C.border}`,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <button onClick={()=>setZoom(z=>Math.min(z+.1,2))} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'2px 6px'}}>+</button>
          <span style={{fontSize:12,fontWeight:600,color:C.ink,minWidth:40,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.max(z-.1,.3))} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'2px 6px'}}>−</button>
          <span style={{color:C.border}}>|</span>
          <button onClick={()=>setZoom(1)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,padding:'2px 6px'}} title="Fit">⊡</button>
          <button style={{background:'none',border:'none',cursor:'pointer',fontSize:13,padding:'2px 6px'}} title="Undo">↩</button>
          <button style={{background:'none',border:'none',cursor:'pointer',fontSize:13,padding:'2px 6px'}} title="Redo">↪</button>
        </div>
      </div>

      {/* RIGHT CONFIG PANEL */}
      {configNode&&(()=>{
        const node=wf.nodes.find(n=>n.id===configNode);
        if(!node) return null;
        return(
        <div style={{width:280,background:'#fff',borderLeft:`1px solid ${C.border}`,overflowY:'auto',padding:16,flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.ink}}>Configure {node.type==='event'?'Event':node.type==='condition'?'Condition':'Action'}</div>
            <button onClick={()=>setConfigNode(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.sub}}>✕</button>
          </div>
          {node.type==='event'&&(
            <div>
              <label style={lbl}>Trigger Event</label>
              <div style={{fontSize:13,color:C.ink,fontWeight:600,padding:'8px 0'}}>{node.label}</div>
              {wf.triggerEvent==='lead.field_changed'&&(
                <div style={{marginTop:8}}><label style={lbl}>Field Name</label>
                <input value={wf.triggerConfig?.field||''} onChange={e=>set({triggerConfig:{...wf.triggerConfig,field:e.target.value}})} placeholder="e.g. leadSource" style={inp}/></div>
              )}
              {isSchedule&&(
                <div style={{marginTop:12}}>
                  <label style={lbl}>Delay (minutes)</label>
                  <input type="number" min="0" value={wf.scheduleConfig?.delayMinutes??0} onChange={e=>set({scheduleConfig:{...wf.scheduleConfig,delayMinutes:Number(e.target.value)}})} style={inp}/>
                </div>
              )}
            </div>
          )}
          {node.type==='action'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div><label style={lbl}>Action Type</label>
              <select value={node.actionType} onChange={e=>updateNode(node.id,{actionType:e.target.value,label:ACTION_CATALOG.find(a=>a.type===e.target.value)?.label||e.target.value})} style={inp}>
                {ACTION_CATALOG.map(a=><option key={a.type} value={a.type}>{a.label}</option>)}
              </select></div>
              {node.actionType==='call_api'&&<div><label style={lbl}>API Template</label><select value={node.config?.apiTemplateId||''} onChange={e=>updateNode(node.id,{config:{...node.config,apiTemplateId:e.target.value}})} style={inp}><option value="">Select…</option>{templates.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}</select></div>}
              {node.actionType==='trigger_n8n'&&<div><label style={lbl}>n8n Workflow</label><select value={node.config?.n8nWorkflowId||''} onChange={e=>updateNode(node.id,{config:{...node.config,n8nWorkflowId:e.target.value}})} style={inp}><option value="">Select…</option>{n8nWfs.map(nw=><option key={nw.id} value={nw.id}>{nw.name}</option>)}</select></div>}
              {node.actionType==='trigger_webhook'&&<div><label style={lbl}>Webhook</label><select value={node.config?.webhookId||''} onChange={e=>updateNode(node.id,{config:{...node.config,webhookId:e.target.value}})} style={inp}><option value="">Select…</option>{hooks.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}</select></div>}
              {node.actionType==='notify_team_member'&&<><div><label style={lbl}>Team Member</label><select value={node.config?.userId||''} onChange={e=>updateNode(node.id,{config:{...node.config,userId:e.target.value}})} style={inp}><option value="">Assigned caller</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div><div><label style={lbl}>Message</label><input value={node.config?.message||''} onChange={e=>updateNode(node.id,{config:{...node.config,message:e.target.value}})} placeholder="Use {{lead.name}}" style={inp}/></div></>}
              {node.actionType==='update_lead_status'&&<div><label style={lbl}>New Status</label><select value={node.config?.status||''} onChange={e=>updateNode(node.id,{config:{...node.config,status:e.target.value}})} style={inp}><option value="">Select…</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>}
              {node.actionType==='update_lead_assignee'&&<div><label style={lbl}>Assign To</label><select value={node.config?.userId||''} onChange={e=>updateNode(node.id,{config:{...node.config,userId:e.target.value}})} style={inp}><option value="">Select…</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div>}
              {node.actionType==='update_lead_rating'&&<div><label style={lbl}>Rating</label><select value={node.config?.rating||''} onChange={e=>updateNode(node.id,{config:{...node.config,rating:Number(e.target.value)}})} style={inp}><option value="">Select…</option>{[1,2,3,4,5].map(r=><option key={r} value={r}>{r} ★</option>)}</select></div>}
            </div>
          )}
          {node.type==='condition'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div><label style={lbl}>Field</label><input value={node.config?.field||''} onChange={e=>updateNode(node.id,{config:{...node.config,field:e.target.value}})} placeholder="e.g. status, rating" style={inp}/></div>
              <div><label style={lbl}>Operator</label><select value={node.config?.operator||'equals'} onChange={e=>updateNode(node.id,{config:{...node.config,operator:e.target.value}})} style={inp}><option value="equals">Equals</option><option value="not_equals">Not Equals</option><option value="contains">Contains</option><option value="exists">Exists</option></select></div>
              <div><label style={lbl}>Value</label><input value={node.config?.value||''} onChange={e=>updateNode(node.id,{config:{...node.config,value:e.target.value}})} style={inp}/></div>
            </div>
          )}
        </div>);
      })()}
    </div>
    ):(
    <div style={{flex:1,overflow:'auto',padding:20}}>
      <ExecutionsTable executions={executions} hasId={!!id}/>
    </div>
    )}
  </div>);
}

/* ─── SIDEBAR SECTION ─────────────────────────────────────────────────────── */
function SidebarSection({title,subtitle,children}){
  const [open,setOpen]=useState(true);
  return(
  <div style={{marginBottom:8}}>
    <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px',cursor:'pointer'}}>
      <div><div style={{fontSize:13,fontWeight:700,color:C.ink}}>{title}</div>{subtitle&&<div style={{fontSize:11,color:C.sub}}>{subtitle}</div>}</div>
      <span style={{color:C.sub,fontSize:10,transform:open?'rotate(180deg)':'none',transition:'transform .15s'}}>▼</span>
    </div>
    {open&&<div style={{padding:'0 4px'}}>{children}</div>}
  </div>);
}

/* ─── FLOW NODE ───────────────────────────────────────────────────────────── */
function FlowNode({node,selected,onClick,onRemove}){
  const colors={event:['#7c3aed','#ede9fe'],action:['#6366f1','#eef2ff'],condition:['#0891b2','#ecfeff']};
  const [header,bg]=colors[node.type]||colors.action;
  const ac=ACTION_CATALOG.find(a=>a.type===node.actionType);
  return(
  <div onClick={onClick} style={{position:'absolute',left:node.x,top:node.y,width:180,cursor:'pointer',zIndex:1,transition:'box-shadow .15s',boxShadow:selected?`0 0 0 2px ${header}`:'0 2px 8px rgba(0,0,0,.08)',borderRadius:10,overflow:'hidden',background:'#fff'}}>
    <div style={{background:header,color:'#fff',padding:'6px 12px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>{node.type==='event'?'EVENT':node.type==='condition'?'CONDITION':'ACTION'}</span>
      {onRemove&&<button onClick={e=>{e.stopPropagation();onRemove()}} style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',cursor:'pointer',fontSize:14}}>⋮</button>}
    </div>
    <div style={{padding:'10px 12px'}}>
      <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:2}}>{node.label}</div>
      {node.type==='event'&&<div style={{fontSize:11,color:C.sub,display:'flex',alignItems:'center',gap:4}}>⚙️ {EVENT_CATALOG.find(e=>e.value===node.event)?.wfType||'Manual'}</div>}
      {node.type==='action'&&ac&&<div style={{fontSize:11,color:C.sub}}>{ac.icon} {ac.desc?.slice(0,30)}</div>}
      {node.type==='condition'&&<div style={{fontSize:11,color:C.sub}}>🔀 If Else</div>}
    </div>
    {/* connector point */}
    <div style={{position:'absolute',bottom:-6,left:'50%',transform:'translateX(-50%)',width:12,height:12,borderRadius:'50%',border:`2px solid ${header}`,background:'#fff'}}/>
  </div>);
}

/* ─── EXECUTIONS TABLE ────────────────────────────────────────────────────── */
function ExecutionsTable({executions,hasId}){
  if(!hasId) return <div style={{...card,padding:40,textAlign:'center',color:C.sub}}>Save the workflow first to see executions.</div>;
  const statusColors={success:['#d1fae5',C.green],failed:['#fee2e2',C.red],pending:['#e0e7ff','#4f46e5'],cancelled:['#f3f4f6',C.sub]};
  return(
  <div style={{...card,overflow:'hidden'}}>
    <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1fr',padding:'12px 18px',background:'#f9f8ff',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase'}}>
      <span>Lead</span><span>Status</span><span>Duration</span><span>When</span>
    </div>
    {executions.length===0?<div style={{padding:36,textAlign:'center',color:C.sub}}>No executions found</div>
    :executions.map((ex,i)=>{
      const[bg,fg]=statusColors[ex.status]||statusColors.pending;
      return(
      <div key={ex._id} style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1fr',padding:'12px 18px',alignItems:'center',borderBottom:i<executions.length-1?'1px solid #f0eef8':'none',fontSize:13}}>
        <span style={{color:C.ink,fontWeight:600}}>{ex.lead?.name||'—'}</span>
        <span><span style={{background:bg,color:fg,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{ex.status}</span></span>
        <span style={{color:C.sub}}>{ex.durationMs?`${ex.durationMs}ms`:'—'}</span>
        <span style={{color:C.sub}}>{new Date(ex.createdAt).toLocaleString()}</span>
      </div>);
    })}
  </div>);
}