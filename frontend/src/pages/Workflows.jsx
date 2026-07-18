import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown, ChevronRight, MoreVertical, Plus, Minus, Maximize2, Undo2, Redo2,
  Search, X, Trash2, RefreshCw, Settings, Star, Filter, User, Users, Tag, MapPin,
  FileText, StickyNote, PlusCircle, MessageCircle, Facebook, Globe,
  FileSpreadsheet, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Headphones, CircleDollarSign, IndianRupee, Sparkles, Send, Link2, Webhook, Zap,
  Bell, Clock, ListPlus, ListMinus, XCircle, Mail, Type, Hash, Calendar,
  AlertCircle, AlertTriangle, GitBranch, Copy, ChevronUp,
} from 'lucide-react';
import {
  workflowsAPI, usersAPI, apiTemplatesAPI, webhooksAPI, n8nAPI,
  customActionsAPI, messageTemplatesAPI,
} from '../services/api';

/* ─── palette ─────────────────────────────────────────────────────────────── */
const C={indigo:'var(--theme-primary-alt)',purple:'var(--theme-primary-deep)',indigoBg:'var(--theme-surface-faint4)',border:'var(--theme-border-tint)',ink:'var(--theme-text-strongest)',sub:'#6b7280',green:'#059669',red:'#dc2626',amber:'#b45309',line:'var(--theme-primary-pale)'};
const card={background:'#fff',border:`1px solid ${C.border}`,borderRadius:12};
const btnP={padding:'8px 18px',borderRadius:8,border:'none',background:'var(--btn-gradient)',color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer'};
const btnG={padding:'7px 14px',borderRadius:8,border:`1.5px solid ${C.border}`,background:'#fff',color:C.ink,fontWeight:600,fontSize:13,cursor:'pointer'};
const inp={width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'};
const lbl={fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5,display:'block'};

/* ─── tiny brand badge for sources lucide doesn't ship a logo for ──────────── */
function BrandBadge({letters,bg}){
  return <span style={{width:18,height:18,borderRadius:5,background:bg,color:'#fff',fontSize:9,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{letters}</span>;
}
const KIND_ICON={text:Type,phone:Phone,email:Mail,date:Calendar,number:Hash,select:ChevronDown,tag:Tag};

/* ─── Lead Field Change → field catalog (mirrors this workspace's actual lead fields) ─ */
const FIELD_CATALOG=[
  {key:'name',label:'Name',kind:'text'},
  {key:'phone',label:'Phone',kind:'phone'},
  {key:'email',label:'Email',kind:'email'},
  {key:'alternatePhone',label:'Alternate Phone',kind:'phone'},
  {key:'preferredCourses',label:'Preferred Courses',kind:'tag'},
  {key:'location',label:'Location',kind:'text'},
  {key:'lastQualification',label:'Last Qualification',kind:'text'},
  {key:'budget',label:'Budget',kind:'number'},
  {key:'nextFollowupDate',label:'Next Followup Date',kind:'date'},
  {key:'demoScheduledDate',label:'Demo Scheduled Date',kind:'date'},
  {key:'demoDoneDate',label:'Demo Done Date',kind:'date'},
  {key:'feeReceivedTillNow',label:'Fee Received Till Now',kind:'number'},
  {key:'gender',label:'Gender',kind:'select'},
  {key:'reasonToLearn',label:'Reason to Learn',kind:'select'},
  {key:'facebookAdName',label:'Facebook Ad Name',kind:'select'},
  {key:'facebookCampaignName',label:'Facebook Campaign Name',kind:'select'},
  {key:'education',label:'Education',kind:'select'},
  {key:'rollNumber',label:'Roll Number',kind:'text'},
  {key:'rollNumbers',label:'Roll Numbers',kind:'select'},
  {key:'collegeName',label:'College Name',kind:'select'},
  {key:'yearOfPassedOut',label:'Year Of Passed Out',kind:'select'},
  {key:'dob',label:'dob',kind:'number'},
  {key:'instcode',label:'instcode',kind:'text'},
  {key:'branchcode',label:'branchcode',kind:'number'},
  {key:'affliatedcollege',label:'affliatedcollege',kind:'text'},
  {key:'job',label:'Job',kind:'text'},
  {key:'code',label:'code',kind:'text'},
];

/* ─── event catalog — matches the real CRM's "Select event" tree exactly ──── */
// Plain top-level leaves (no children, directly selectable)
const EVENT_TREE=[
  {type:'group',label:'Whatsapp',Icon:MessageCircle,color:'#22c55e',children:[
    {value:'lead.whatsapp_lead',label:'On WhatsApp lead',Icon:MessageCircle,wfType:'Lead Creation'},
    {value:'lead.whatsapp_received',label:'On WhatsApp received',Icon:MessageCircle,wfType:'Messaging'},
    {value:'lead.template_replied',label:'On template replied',Icon:MessageCircle,wfType:'Messaging',expandable:'templates'},
    {value:'lead.waca_list_replied',label:'On WACA List Replied',Icon:MessageCircle,wfType:'Messaging',expandable:'templates'},
  ]},
  {value:'lead.field_changed',label:'On Lead Field Change',Icon:Settings,wfType:'Lead Updation',expandable:'fields'},
  {value:'lead.facebook_lead',label:'On Facebook lead',Icon:Facebook,wfType:'Lead Creation',iconColor:'#1877f2',draft:true},
  {value:'lead.web_created',label:'On Website lead',Icon:Globe,wfType:'Lead Creation',draft:true},
  {value:'lead.justdial_lead',label:'On Justdial lead',badge:{letters:'Jd',bg:'#f97316'},wfType:'Lead Creation'},
  {value:'lead.woocommerce',label:'On WooCommerce payment',badge:{letters:'W',bg:'var(--theme-primary)'},wfType:'Lead Creation'},
  {value:'lead.call_log',label:'On call log lead',Icon:Phone,wfType:'Lead Creation'},
  {value:'lead.excel_upload',label:'On Excel upload lead',Icon:FileSpreadsheet,iconColor:'#15803d',wfType:'Lead Creation',draft:true},
  {value:'lead.manual_created',label:'On manual lead',Icon:Settings,wfType:'Lead Creation',draft:true},
  {value:'lead.created',label:'On any lead created',Icon:PlusCircle,wfType:'Lead Creation'},
  {value:'lead.status_changed',label:'On Lead Status Change',Icon:Filter,wfType:'Lead Updation'},
  {value:'lead.rating_changed',label:'On Lead Rating Change',Icon:Star,wfType:'Lead Updation'},
  {value:'lead.assignee_changed',label:'On Lead Assignment Change',Icon:User,wfType:'Lead Updation'},
  {value:'lead.added_to_list',label:'Added in List',Icon:ListPlus,wfType:'Lead Updation'},
  {value:'lead.removed_from_list',label:'Removed from List',Icon:ListMinus,wfType:'Lead Updation'},
  {value:'lead.user_note',label:'On User Note',Icon:FileText,wfType:'Lead Activity'},
  {value:'lead.system_note',label:'On System Note',Icon:StickyNote,wfType:'Lead Activity'},
  {value:'lead.note_added',label:'On Note Added',Icon:FileText,wfType:'Lead Activity'},
  {value:'lead.location_checkin',label:'On Location Check-in',Icon:MapPin,wfType:'Lead Activity',draft:true},
  {type:'group',label:'IVR',Icon:Headphones,children:[
    {value:'lead.ivr_incoming',label:'On IVR incoming call',Icon:Headphones,wfType:'Lead Activity'},
    {value:'lead.ivr_outgoing',label:'On IVR outgoing call',Icon:Headphones,wfType:'Lead Activity'},
  ]},
  {type:'group',label:'Call activities',Icon:PhoneCall,children:[
    {value:'lead.call_incoming_ended',label:'On incoming call ended',Icon:PhoneIncoming,wfType:'Lead Activity'},
    {value:'lead.call_outgoing_ended',label:'On outgoing call ended',Icon:PhoneOutgoing,wfType:'Lead Activity'},
    {value:'lead.call_missed',label:'On Missed Call',Icon:PhoneMissed,wfType:'Lead Activity'},
    {value:'lead.call_recording_completed',label:'On call recording completed',Icon:PhoneCall,wfType:'Lead Activity'},
  ]},
  {type:'group',label:'Payment activities',Icon:CircleDollarSign,children:[
    {value:'lead.payment_completed',label:'On payment completed',Icon:CircleDollarSign,wfType:'Lead Activity'},
    {value:'lead.payment_pending',label:'On payment pending',Icon:CircleDollarSign,wfType:'Lead Activity'},
    {value:'lead.payment_failed',label:'On payment failed',Icon:CircleDollarSign,wfType:'Lead Activity'},
    {value:'lead.payment_processing',label:'On payment processing',Icon:CircleDollarSign,wfType:'Lead Activity'},
    {value:'lead.payment_cancelled',label:'On payment cancelled',Icon:CircleDollarSign,wfType:'Lead Activity'},
    {value:'lead.payment_refunded',label:'On payment refunded',Icon:CircleDollarSign,wfType:'Lead Activity'},
  ]},
  {value:'lead.custom_action_created',label:'On Custom Action Creation',Icon:Sparkles,wfType:'Lead Activity',expandable:'customActions'},
  {value:'lead.custom_action_updated',label:'On Custom Action Updation',Icon:Sparkles,wfType:'Lead Activity',expandable:'customActions'},
  {value:'lead.template_message_sent',label:'On template message sent',Icon:Send,wfType:'Messaging'},
];
// flatten once for lookups (badge colors, search, sidebar quick-switch)
const EVENT_FLAT=[];
EVENT_TREE.forEach(item=>{
  if(item.type==='group') item.children.forEach(c=>EVENT_FLAT.push(c));
  else EVENT_FLAT.push(item);
});
const wfTypeColor={'Lead Creation':['var(--theme-surface-tint2)','var(--theme-primary)'],'Lead Updation':['#dbeafe','#2563eb'],'Lead Activity':['#d1fae5','#059669'],'Messaging':['#fef3c7','#b45309']};

/* ─── action catalog — full real-CRM action palette ───────────────────────── */
const ACTION_CATALOG=[
  {type:'call_api',label:'Call API',Icon:Link2,desc:'Call external API template'},
  {type:'create_custom_action',label:'Create Custom Action',Icon:Sparkles,desc:'Run a configured custom action'},
  {type:'notify_team_member',label:'Notification To TeamMember',Icon:Bell,desc:'Notify a team member'},
  {type:'update_lead_assignee',label:'Update Lead Assignee',Icon:Users,desc:'Change lead assignee'},
  {type:'update_lead_fields',label:'Update Lead Fields',Icon:Settings,desc:'Set a lead field value'},
  {type:'update_lead_rating',label:'Update Lead Rating',Icon:Star,desc:'Change lead rating'},
  {type:'update_lead_status',label:'Update Lead Status',Icon:Filter,desc:'Change lead status'},
  {type:'time_delay',label:'Time Delay',Icon:Clock,desc:'Wait before continuing'},
  {type:'send_template',label:'Send Template',Icon:MessageCircle,desc:'Send a message template'},
  {type:'add_in_list',label:'Add in List',Icon:ListPlus,desc:'Add lead to a named list'},
  {type:'remove_from_list',label:'Remove from List',Icon:ListMinus,desc:'Remove lead from a list'},
  {type:'add_call_followup',label:'Add Call Followup',Icon:PhoneCall,desc:'Schedule a call followup task'},
  {type:'cancel_tasks',label:'Cancel Tasks',Icon:XCircle,desc:'Cancel upcoming tasks'},
  {type:'add_payment',label:'Add payment',Icon:IndianRupee,desc:'Record a payment'},
  {type:'add_ivr_action',label:'Add IVR Action',Icon:Headphones,desc:'Trigger an IVR flow'},
  {type:'trigger_webhook',label:'Trigger Webhook',Icon:Webhook,desc:'Fire outbound webhook'},
  {type:'trigger_n8n',label:'Trigger n8n',Icon:Zap,desc:'Trigger n8n workflow'},
  {type:'email_report',label:'Email Report',Icon:Mail,desc:'Email lead report'},
];

const STATUSES=['Fresh','Connected','Call Back Later','Not interested','Demo Scheduled','Demo Done','Won','Lost'];

/* ─── layout constants used by the canvas to avoid node/connector overlap ──── */
const NODE_W=280, ROW_H=52, GAP=72;
function nodeHeight(node){
  const hasDetail = node.type==='event' ? !!node.detailLabel : (node.type==='condition' ? true : !!node.detailLabel);
  return hasDetail ? ROW_H+40 : ROW_H;
}

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
  const [page,setPage]=useState(1);
  const [editing,setEditing]=useState(null);
  const [showEventModal,setShowEventModal]=useState(false);
  const [users,setUsers]=useState([]);
  const [templates,setTemplates]=useState([]);
  const [hooks,setHooks]=useState([]);
  const [n8nWfs,setN8nWfs]=useState([]);
  const PAGE_SIZE=8;

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
  useEffect(()=>{setPage(1)},[tab,search,eventFilter]);
  useEffect(()=>{
    usersAPI.getAll().then(r=>setUsers(r.data.users||r.data||[])).catch(()=>{});
    apiTemplatesAPI.getAll().then(r=>setTemplates(r.data.templates||[])).catch(()=>{});
    webhooksAPI.getAll().then(r=>setHooks(r.data.webhooks||[])).catch(()=>{});
    n8nAPI.cachedWorkflows().then(r=>setN8nWfs(r.data.workflows||[])).catch(()=>{});
  },[]);

  const handleCreateNew=(sel)=>{
    setShowEventModal(false);
    const ev=sel.event, wfType=sel.wfType||'Lead Updation';
    const name=sel.subLabel?`${sel.label} ${sel.subLabel}`:sel.label;
    setEditing({
      name, kind, status:'draft',
      triggerEvent:ev, workflowType:wfType,
      triggerConfig:sel.triggerConfig||{}, conditions:[], actions:[], n8nWorkflowId:'',
      nodes:[{id:'evt_0',type:'event',event:ev,label:sel.parentLabel||sel.label,detailLabel:sel.subLabel||'',x:380,y:60}],
      edges:[],
      scheduleConfig:{delayMinutes:isSchedule?60:0,cancelIfStatusChanged:true},
    });
  };

  if(editing) return <FlowchartEditor kind={kind} initial={editing} users={users} templates={templates} hooks={hooks} n8nWfs={n8nWfs} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}} />;

  const filtered=workflows.filter(w=>{
    if(eventFilter && w.triggerEvent!==eventFilter) return false;
    return true;
  });
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const pageRows=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  const statCards=[
    {k:'totalRuns',label:'Total Runs',color:C.ink},
    {k:'success',label:'Success',color:C.green,pct:true},
    {k:'failed',label:'Failed',color:C.red},
    {k:'sleeping',label:'Sleeping',color:C.amber},
    {k:'waiting',label:'Waiting for Reply',color:C.sub},
  ];

  return(
  <div className="workflows-shell" style={{padding:'24px 28px',maxWidth:1180,margin:'0 auto'}}>
    <style>{`
      @media (max-width: 640px) {
        .workflows-shell { padding: 14px !important; }
        .workflows-shell .wf-col-header { display: none !important; }
        .workflows-shell .wf-row { border: 1px solid var(--theme-border-tint); border-radius: 10px; margin-bottom: 8px; padding: 12px !important; }
      }
    `}</style>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
      <div>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:C.ink,display:'flex',alignItems:'center',gap:8}}>{title}<RefreshCw size={16} style={{color:C.sub,cursor:'pointer'}} onClick={load}/></h2>
        <p style={{margin:'4px 0 0',color:C.sub,fontSize:14}}>{isSchedule?'Automatically keep in touch with your leads':'To execute complex automations with ease'} <span style={{color:C.indigo,fontWeight:600,textDecoration:'underline',cursor:'pointer'}}>Learn More</span></p>
      </div>
      <button style={btnP} onClick={()=>setShowEventModal(true)}>+ {isSchedule?'Create New Schedule':'Create Workflow'}</button>
    </div>

    {/* stat cards */}
    <div style={{...card,padding:'18px 20px',marginBottom:20}}>
      <div style={{display:'flex',justifyContent:'flex-end',gap:4,marginBottom:12}}>
        {['All','24h','7d','30d'].map(p=>(
          <button key={p} onClick={()=>setTimePeriod(p)} style={{padding:'4px 12px',borderRadius:6,border:`1px solid ${timePeriod===p?C.indigo:C.border}`,background:timePeriod===p?'#fff':'transparent',color:timePeriod===p?C.indigo:C.sub,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:timePeriod===p?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{p}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)'}}>
        {statCards.map((s,i)=>(
          <div key={s.k} style={{padding:'0 18px',borderLeft:i?`1px solid ${C.border}`:'none'}}>
            <div style={{fontSize:11,color:C.sub,fontWeight:600,marginBottom:4,display:'flex',alignItems:'center',gap:4}}>{s.label} <AlertCircle size={12} style={{opacity:.5}}/></div>
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
      <div style={{position:'relative',flex:1,maxWidth:420}}>
        <Search size={15} style={{position:'absolute',left:11,top:11,color:C.sub}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search flowchart by Name" style={{...inp,paddingLeft:32}} />
      </div>
      <select value={eventFilter} onChange={e=>setEventFilter(e.target.value)} style={{...inp,maxWidth:220}}>
        <option value="">Select Event Types</option>
        {EVENT_FLAT.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}
      </select>
    </div>

    {/* count + pagination */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
      <span style={{fontSize:13,color:C.sub}}>{filtered.length} matching flowcharts found</span>
      {filtered.length>PAGE_SIZE&&(
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:13,color:C.sub}}>{(page-1)*PAGE_SIZE+1} - {Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
          <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} style={{...btnG,padding:'4px 8px',opacity:page<=1?.4:1}}>‹</button>
          <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} style={{...btnG,padding:'4px 8px',opacity:page>=totalPages?.4:1}}>›</button>
        </div>
      )}
    </div>

    {/* table */}
    {loading?<div style={{textAlign:'center',padding:50,color:C.sub}}>Loading…</div>:(
    <div style={{...card,overflow:'hidden'}}>
      <div className="wf-col-header" style={{display:'grid',gridTemplateColumns:'1.6fr 1.2fr .7fr .7fr 1fr .8fr',padding:'11px 18px',background:'var(--theme-surface-faint2)',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'.04em'}}>
        <span>Name</span><span>Events</span><span>Status</span><span>Updated by</span><span>Total runs</span><span style={{textAlign:'right'}}>Actions</span>
      </div>
      {pageRows.length===0?<div style={{padding:40,textAlign:'center',color:C.sub}}>No Flowcharts Found</div>
      :pageRows.map((w,i)=>{
        const ev=EVENT_FLAT.find(e=>e.value===w.triggerEvent);
        const initials=(w.updatedBy?.name||w.createdBy?.name||'—').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
        return(
        <div key={w._id} className="wf-row" style={{display:'grid',gridTemplateColumns:'1.6fr 1.2fr .7fr .7fr 1fr .8fr',padding:'13px 18px',alignItems:'center',borderBottom:i<pageRows.length-1?'1px solid var(--theme-surface-faint5)':'none'}}>
          <span style={{fontWeight:600,color:C.ink,cursor:'pointer'}} onClick={()=>setEditing(w)}>{w.name}</span>
          <span><EventBadge ev={ev} triggerEvent={w.triggerEvent}/></span>
          <span><StatusToggle status={w.status} onToggle={async()=>{await workflowsAPI.setStatus(w._id,w.status==='published'?'draft':'published').catch(e=>alert(e.response?.data?.message||'Failed'));load();}}/></span>
          <span><span style={{width:26,height:26,borderRadius:'50%',background:C.indigoBg,color:C.indigo,fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{initials}</span></span>
          <span style={{fontSize:13,color:C.sub}}>{w.stats?.totalRuns||0} <span style={{color:C.red}}>({w.stats?.failed||0} failed)</span></span>
          <span style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
            <button style={{...btnG,padding:'4px 8px',fontSize:12,display:'flex'}} title="Duplicate"><Copy size={13}/></button>
            <button style={{...btnG,padding:'4px 8px',fontSize:12,color:C.red,borderColor:'#fecaca',display:'flex'}} title="Delete" onClick={async()=>{if(confirm('Delete?')){await workflowsAPI.delete(w._id);load();}}}><Trash2 size={13}/></button>
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
  const [bg,fg]=wfTypeColor[ev?.wfType]||wfTypeColor['Lead Updation'];
  const Icon=ev?.Icon;
  return <span style={{background:bg,color:fg,padding:'3px 10px',borderRadius:16,fontSize:12,fontWeight:600,whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:5}}>
    {Icon?<Icon size={12}/>:ev?.badge?<BrandBadge {...ev.badge}/>:null} {ev?.wfType||triggerEvent}
  </span>;
}

/* ─── STATUS TOGGLE ───────────────────────────────────────────────────────── */
function StatusToggle({status,onToggle}){
  const on=status==='published';
  return <button onClick={onToggle} style={{width:42,height:22,borderRadius:11,border:'none',cursor:'pointer',background:on?C.indigo:'#d1d5db',position:'relative',transition:'background .15s'}}>
    <span style={{position:'absolute',top:2,left:on?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .15s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
  </button>;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  EVENT SELECTION MODAL — tree-based, matches the real "Select event" drawer */
/* ═══════════════════════════════════════════════════════════════════════════ */
function EventSelectionModal({onSelect,onClose}){
  const [search,setSearch]=useState('');
  const [expanded,setExpanded]=useState(()=>new Set());
  const [templates,setTemplates]=useState(null);
  const [customActions,setCustomActions]=useState(null);

  const toggle=(key)=>setExpanded(prev=>{const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n;});

  const ensureTemplates=()=>{ if(templates===null){ setTemplates([]); messageTemplatesAPI.getAll({type:'whatsapp'}).then(r=>setTemplates(r.data.templates||[])).catch(()=>setTemplates([])); } };
  const ensureCustomActions=()=>{ if(customActions===null){ setCustomActions([]); customActionsAPI.getAll().then(r=>setCustomActions(r.data.customActions||r.data||[])).catch(()=>setCustomActions([])); } };

  const searchHit=search?EVENT_FLAT.filter(e=>e.label.toLowerCase().includes(search.toLowerCase())):null;

  const selectPlain=(item)=>onSelect({event:item.value,wfType:item.wfType,label:item.label});
  const selectField=(parent,field)=>onSelect({event:parent.value,wfType:parent.wfType,label:parent.label,parentLabel:parent.label,triggerConfig:{field:field.key},subLabel:field.label});
  const selectTemplate=(parent,tpl)=>onSelect({event:parent.value,wfType:parent.wfType,label:parent.label,parentLabel:parent.label,triggerConfig:{templateId:tpl._id},subLabel:tpl.shortcut||'Template'});
  const selectCustomAction=(parent,ca)=>onSelect({event:parent.value,wfType:parent.wfType,label:parent.label,parentLabel:parent.label,triggerConfig:{customActionId:ca._id},subLabel:ca.name||'Custom Action'});

  const renderExpandable=(item)=>{
    const key=item.value;
    const open=expanded.has(key);
    const onRowClick=()=>{
      if(item.expandable==='templates') ensureTemplates();
      if(item.expandable==='customActions') ensureCustomActions();
      toggle(key);
    };
    return(
    <div key={key}>
      <EventRow ev={item} onClick={onRowClick} chevron={open?'down':'right'}/>
      {open&&(
      <div style={{paddingLeft:30}}>
        {item.expandable==='fields'&&FIELD_CATALOG.map(f=>{
          const FIcon=KIND_ICON[f.kind]||Type;
          return <div key={f.key} onClick={()=>selectField(item,f)} style={rowStyle}>
            <FIcon size={14} style={{color:C.sub}}/><span style={{flex:1,fontSize:13.5,color:C.ink}}>{f.label}</span>
          </div>;
        })}
        {item.expandable==='templates'&&(templates===null||templates.length===0?
          <div style={{padding:'8px 22px',fontSize:12,color:C.sub}}>{templates===null?'Loading…':'No templates found'}</div>
          :templates.map(t=>(
            <div key={t._id} onClick={()=>selectTemplate(item,t)} style={{...rowStyle,alignItems:'flex-start',flexDirection:'column',gap:2}}>
              <span style={{fontSize:13.5,fontWeight:600,color:C.ink}}>{t.shortcut||'Untitled'}</span>
              <span style={{fontSize:12,color:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:300}}>{t.message}</span>
            </div>
          ))
        )}
        {item.expandable==='customActions'&&(customActions===null||customActions.length===0?
          <div style={{padding:'8px 22px',fontSize:12,color:C.sub}}>{customActions===null?'Loading…':'No custom actions found'}</div>
          :customActions.map(ca=>(
            <div key={ca._id} onClick={()=>selectCustomAction(item,ca)} style={rowStyle}>
              <Sparkles size={14} style={{color:C.sub}}/><span style={{flex:1,fontSize:13.5,color:C.ink}}>{ca.name}</span>
            </div>
          ))
        )}
      </div>)}
    </div>);
  };

  return(
  <div style={{position:'fixed',inset:0,background:'rgba(30,27,75,.45)',display:'flex',justifyContent:'flex-end',zIndex:1000}}>
    <div style={{width:460,maxWidth:'100vw',background:'#fff',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,.15)'}}>
      <div style={{padding:'20px 22px 14px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div><div style={{fontSize:17,fontWeight:700,color:C.ink}}>Select event</div><div style={{fontSize:13,color:C.sub}}>Select the event that will trigger the workflow</div></div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.sub}}><X size={20}/></button>
        </div>
        <div style={{position:'relative'}}>
          <Search size={15} style={{position:'absolute',left:11,top:11,color:C.sub}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search for event e.g. facebook, payment, manual…" style={{...inp,background:'#f9fafb',paddingLeft:32}}/>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
        {searchHit?searchHit.map(e=><EventRow key={e.value} ev={e} onClick={()=>selectPlain(e)}/>)
        :EVENT_TREE.map((item,i)=>{
          if(item.type==='group'){
            const open=expanded.has(item.label);
            return(
            <div key={item.label}>
              <div onClick={()=>toggle(item.label)} style={{...rowStyle,fontWeight:700}}>
                {open?<ChevronDown size={14} style={{color:C.sub}}/>:<ChevronRight size={14} style={{color:C.sub}}/>}
                <item.Icon size={16} style={{color:item.color||C.sub}}/>
                <span style={{flex:1,fontSize:14,color:C.ink}}>{item.label}</span>
              </div>
              {open&&<div style={{paddingLeft:22}}>{item.children.map(c=>c.expandable?renderExpandable(c):<EventRow key={c.value} ev={c} onClick={()=>selectPlain(c)}/>)}</div>}
            </div>);
          }
          if(item.expandable) return renderExpandable(item);
          return <EventRow key={item.value} ev={item} onClick={()=>selectPlain(item)}/>;
        })}
      </div>
      <div style={{padding:14,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'flex-end'}}>
        <button style={btnP} disabled>Next</button>
      </div>
    </div>
  </div>);
}
const rowStyle={display:'flex',alignItems:'center',gap:10,padding:'9px 22px',cursor:'pointer',transition:'background .1s'};
function EventRow({ev,onClick,chevron}){
  return <div onClick={onClick} style={rowStyle}
    onMouseEnter={e=>e.currentTarget.style.background='var(--theme-surface-faint8)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
    {chevron&&(chevron==='down'?<ChevronDown size={14} style={{color:C.sub}}/>:<ChevronRight size={14} style={{color:C.sub}}/>)}
    {ev.Icon?<ev.Icon size={16} style={{color:ev.iconColor||C.sub,flexShrink:0}}/>:ev.badge?<BrandBadge {...ev.badge}/>:<span style={{width:16}}/>}
    <span style={{flex:1,fontSize:14,color:C.ink,fontWeight:500}}>{ev.label}</span>
    {ev.draft&&<span style={{fontSize:11,color:C.sub,background:'#f3f1fa',padding:'2px 8px',borderRadius:10}}>Draft</span>}
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
      const ev=EVENT_FLAT.find(e=>e.value===base.triggerEvent)||EVENT_FLAT[0];
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
  const [configNode,setConfigNode]=useState(()=>{
    // auto-open event node config so delay field is visible immediately for schedules
    if(initial?.nodes?.length) return initial.nodes.find(n=>n.type==='event')?.id || null;
    return 'evt_0';
  });
  const [showAlerts,setShowAlerts]=useState(false);
  const [menuNode,setMenuNode]=useState(null);
  const [msgTemplates,setMsgTemplates]=useState([]);
  const canvasRef=useRef(null);
  const id=wf._id;

  useEffect(()=>{
    messageTemplatesAPI.getAll({type:'whatsapp'}).then(r=>setMsgTemplates(r.data.templates||[])).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(editorTab==='executions'&&id) workflowsAPI.getExecutions(id,{limit:30}).then(r=>setExecutions(r.data.executions)).catch(()=>{});
  },[editorTab,id]);

  const set=p=>setWf(prev=>({...prev,...p}));
  const updateNode=(nodeId,patch)=>set({nodes:wf.nodes.map(n=>n.id===nodeId?{...n,...patch}:n)});

  const addActionNode=(actionType)=>{
    const ac=ACTION_CATALOG.find(a=>a.type===actionType);
    const lastNode=wf.nodes[wf.nodes.length-1];
    const newId=`act_${Date.now()}`;
    const newNode={id:newId,type:'action',actionType,label:ac?.label||actionType,config:{},x:380,y:0};
    const newEdge={from:lastNode?.id||'evt_0',to:newId};
    set({nodes:[...wf.nodes,newNode],edges:[...wf.edges,newEdge]});
    setSelectedNode(newId); setConfigNode(newId);
  };

  const addConditionNode=(condType)=>{
    const lastNode=wf.nodes[wf.nodes.length-1];
    const newId=`cond_${Date.now()}`;
    const newNode={id:newId,type:'condition',conditionType:condType,label:condType==='lead'?'Lead Condition':'Event Condition',config:{field:'',operator:'equals',value:''},x:380,y:0};
    const newEdge={from:lastNode?.id||'evt_0',to:newId};
    set({nodes:[...wf.nodes,newNode],edges:[...wf.edges,newEdge]});
    setSelectedNode(newId); setConfigNode(newId);
  };

  const removeNode=(nodeId)=>{
    set({nodes:wf.nodes.filter(n=>n.id!==nodeId),edges:wf.edges.filter(e=>e.from!==nodeId&&e.to!==nodeId)});
    if(selectedNode===nodeId) setSelectedNode(null);
    if(configNode===nodeId) setConfigNode(null);
    setMenuNode(null);
  };

  // switch the trigger event without losing already-built action nodes
  const switchEvent=(item)=>{
    const evtNode=wf.nodes.find(n=>n.type==='event');
    set({triggerEvent:item.value,workflowType:item.wfType,triggerConfig:{},name:wf.name===evtNode?.label?item.label:wf.name});
    updateNode(evtNode.id,{event:item.value,label:item.label,detailLabel:''});
  };

  const unconnected=(()=>{
    const connected=new Set(wf.edges.map(e=>e.to));
    return wf.nodes.filter(n=>n.type!=='event'&&!connected.has(n.id));
  })();
  const errors=[];
  if(wf.nodes.filter(n=>n.type!=='event').length===0) errors.push('Flowchart has unconnected nodes');
  else if(unconnected.length) errors.push('Flowchart has unconnected nodes');

  const save=async(publish=false)=>{
    if(!wf.name.trim()) return alert('Enter a name');
    if(publish&&errors.length) return alert(errors[0]);
    setSaving(true);
    try{
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

  const siblingEvents=EVENT_FLAT.filter(e=>e.wfType===wf.workflowType);

  return(
  <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--theme-surface-faint)'}}>
    {/* top bar */}
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px',background:'#fff',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      <button onClick={onClose} style={{...btnG,padding:'6px 12px'}}>←</button>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <input value={wf.name} onChange={e=>set({name:e.target.value})} style={{fontWeight:700,fontSize:18,color:C.ink,border:'none',outline:'none',background:'transparent',padding:0,width:Math.max(160,wf.name.length*11)}}/>
          <span style={{fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:20,background:wf.status==='published'?'#d1fae5':'#f3f1fa',color:wf.status==='published'?C.green:C.sub}}>{wf.status==='published'?'Published':'Draft'}</span>
          {errors.length>0&&<button onClick={()=>setShowAlerts(true)} style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',color:C.red,fontSize:13,fontWeight:600}}><AlertCircle size={14}/> {errors.length} Error{errors.length>1?'s':''}</button>}
        </div>
        <div style={{fontSize:12.5,color:C.sub,marginTop:2}}>Workflow Type: {wf.workflowType}</div>
      </div>
      <div style={{flex:1}}/>
      <button style={{...btnG,opacity:errors.length||wf.status==='published'?.5:1}} disabled={errors.length>0} onClick={()=>save(true)}>Publish</button>
      <button style={btnP} onClick={()=>save(false)} disabled={saving}>{saving?'Saving…':'Save'}</button>
      <button style={{...btnG,padding:'6px 10px',color:C.red,borderColor:'#fecaca',display:'flex'}} onClick={async()=>{if(id&&confirm('Delete?')){await workflowsAPI.delete(id);onSaved();}else onClose();}}><Trash2 size={14}/></button>
    </div>

    {/* editor/executions tabs */}
    <div style={{display:'flex',justifyContent:'center',background:'#fff',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      {['editor','executions'].map(t=>(
        <button key={t} onClick={()=>setEditorTab(t)} style={{background:'none',border:'none',padding:'10px 20px',cursor:'pointer',fontSize:14,fontWeight:600,textTransform:'capitalize',color:editorTab===t?C.indigo:C.sub,borderBottom:editorTab===t?`2.5px solid ${C.indigo}`:'2.5px solid transparent'}}>{t}</button>
      ))}
    </div>

    {editorTab==='editor'?(
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden',position:'relative'}}>
      {/* SCHEDULE DELAY BANNER */}
      {isSchedule&&(
        <div style={{background:'var(--theme-surface-faint4)',borderBottom:`1px solid var(--theme-primary-pale2)`,padding:'10px 20px',display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
          <Clock size={16} style={{color:C.indigo,flexShrink:0}}/>
          <span style={{fontSize:13,fontWeight:600,color:C.indigo}}>Schedule Delay:</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="number" min="0" value={wf.scheduleConfig?.delayMinutes??60}
              onChange={e=>setWf(prev=>({...prev,scheduleConfig:{...prev.scheduleConfig,delayMinutes:Number(e.target.value)}}))}
              style={{width:80,padding:'5px 10px',border:`1px solid var(--theme-primary-pale)`,borderRadius:7,fontSize:13,fontWeight:600,color:C.ink,outline:'none',textAlign:'center'}}/>
            <span style={{fontSize:13,color:C.sub}}>minutes</span>
            <span style={{fontSize:12,color:C.sub,marginLeft:4}}>
              {(()=>{const m=wf.scheduleConfig?.delayMinutes||0; if(m<60) return `(${m}m)`; if(m<1440) return `(${(m/60).toFixed(1)}h)`; return `(${(m/1440).toFixed(1)}d)`;})()}
            </span>
          </div>
          <span style={{fontSize:12,color:C.sub}}>— actions run this long after the trigger event fires</span>
        </div>
      )}
    <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>
      {/* LEFT SIDEBAR PALETTE */}
      <div style={{width:sidebarOpen?256:0,transition:'width .2s',overflow:'hidden',background:'#fff',borderRight:`1px solid ${C.border}`,flexShrink:0,position:'relative'}}>
        <div style={{width:256,padding:'14px 10px 40px',overflowY:'auto',height:'100%'}}>
          {/* Events */}
          <SidebarSection title="Events" subtitle="When this happens">
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              {siblingEvents.map(e=>(
                <div key={e.value} onClick={()=>switchEvent(e)} style={paletteItem(e.value===wf.triggerEvent)}
                  onMouseEnter={ev=>ev.currentTarget.style.background='var(--theme-surface-faint4)'} onMouseLeave={ev=>ev.currentTarget.style.background=e.value===wf.triggerEvent?C.indigoBg:'transparent'}>
                  {e.Icon?<e.Icon size={15} style={{color:e.value===wf.triggerEvent?C.indigo:C.sub,flexShrink:0}}/>:e.badge?<BrandBadge {...e.badge}/>:null}
                  <span style={{flex:1,textAlign:'left'}}>{e.label.replace(/^On /,'')}</span>
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* Actions */}
          <SidebarSection title="Actions" subtitle="Do this…" accent>
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              {ACTION_CATALOG.map(a=>(
                <div key={a.type} onClick={()=>addActionNode(a.type)} style={paletteItem(false)}
                  onMouseEnter={ev=>ev.currentTarget.style.background='var(--theme-surface-faint4)'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                  <a.Icon size={15} style={{color:C.sub,flexShrink:0}}/>
                  <span style={{flex:1,textAlign:'left'}}>{a.label}</span>
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* Lead Condition */}
          <SidebarSection title="Lead Condition" subtitle="If…">
            <div onClick={()=>addConditionNode('lead')} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,cursor:'pointer',fontSize:13,color:C.sub}} onMouseEnter={e=>e.currentTarget.style.background='var(--theme-surface-faint4)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <GitBranch size={16}/> If Else
            </div>
          </SidebarSection>

          {/* Event Condition */}
          <SidebarSection title="Event Condition" subtitle="If…">
            <div onClick={()=>addConditionNode('event')} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,cursor:'pointer',fontSize:13,color:C.sub}} onMouseEnter={e=>e.currentTarget.style.background='var(--theme-surface-faint4)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <GitBranch size={16}/> If Else
            </div>
          </SidebarSection>

          {/* n8n link */}
          {n8nWfs.length>0&&(
            <SidebarSection title="n8n" subtitle="Link workflow">
              <select value={wf.n8nWorkflowId||''} onChange={e=>set({n8nWorkflowId:e.target.value})} style={{...inp,fontSize:12}}>
                <option value="">None</option>
                {n8nWfs.map(nw=><option key={nw.id} value={nw.id}>{nw.name}</option>)}
              </select>
            </SidebarSection>
          )}
        </div>
        <button onClick={()=>setSidebarOpen(false)} style={{position:'absolute',right:10,bottom:10,width:28,height:28,borderRadius:'50%',border:'none',background:C.indigo,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
      </div>
      {!sidebarOpen&&<button onClick={()=>setSidebarOpen(true)} style={{position:'absolute',left:10,bottom:10,zIndex:10,width:28,height:28,borderRadius:'50%',border:'none',background:C.indigo,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>}

      {/* CANVAS */}
      <div ref={canvasRef} style={{flex:1,position:'relative',overflow:'auto',background:'#faf9fe',backgroundImage:'radial-gradient(circle,var(--theme-surface-tint) 1px,transparent 1px)',backgroundSize:'18px 18px'}}>
        <div style={{transform:`scale(${zoom})`,transformOrigin:'top center',minHeight:900,minWidth:900,position:'relative',padding:20}}>
          {(()=>{
            // Layout is recomputed from current node heights every render, so a node
            // that grows (e.g. once a field/value gets configured) never overlaps
            // whatever comes after it — positions are never read from stale x/y.
            const BASE_X=320;
            let cursorY=60;
            const layout={};
            wf.nodes.forEach(n=>{ layout[n.id]={x:BASE_X,y:cursorY,h:nodeHeight(n)}; cursorY+=nodeHeight(n)+GAP; });
            const last=wf.nodes[wf.nodes.length-1];
            const lastPos=layout[last.id];
            const lineX=lastPos.x+NODE_W/2;
            const lineTop=lastPos.y+lastPos.h;
            return(
            <>
              {/* SVG connections */}
              <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}>
                {wf.edges.map((edge,i)=>{
                  const from=layout[edge.from], to=layout[edge.to];
                  if(!from||!to) return null;
                  const x1=from.x+NODE_W/2,y1=from.y+from.h;
                  const x2=to.x+NODE_W/2,y2=to.y;
                  const midY=(y1+y2)/2;
                  return <path key={i} d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`} stroke={C.line} strokeWidth={2} fill="none"/>;
                })}
              </svg>

              {/* Nodes */}
              {wf.nodes.map(node=>(
                <FlowNode key={node.id} node={node} pos={layout[node.id]} selected={selectedNode===node.id} menuOpen={menuNode===node.id}
                  onClick={()=>{setSelectedNode(node.id);setConfigNode(node.id)}}
                  onMenu={()=>setMenuNode(menuNode===node.id?null:node.id)}
                  onDelete={node.type!=='event'?()=>removeNode(node.id):null}
                />
              ))}

              {/* trailing connector + add-node button */}
              <div style={{position:'absolute',left:lineX-1,top:lineTop,width:2,height:GAP,background:C.line,zIndex:0}}/>
              <div style={{position:'absolute',left:lineX-15,top:lineTop+GAP/2-15,zIndex:2}}>
                <button onClick={()=>addActionNode('call_api')} title="Add action" style={{width:30,height:30,borderRadius:'50%',border:`2px solid ${C.indigo}`,background:'#fff',color:C.indigo,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}><Plus size={16}/></button>
              </div>
            </>);
          })()}
        </div>

        {/* Zoom controls */}
        <div style={{position:'absolute',bottom:16,right:16,display:'flex',gap:4,alignItems:'center',background:'#fff',borderRadius:8,padding:'4px 8px',border:`1px solid ${C.border}`,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <button onClick={()=>setZoom(z=>Math.min(z+.1,2))} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex'}}><Plus size={15}/></button>
          <span style={{fontSize:12,fontWeight:600,color:C.ink,minWidth:40,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.max(z-.1,.3))} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex'}}><Minus size={15}/></button>
          <span style={{color:C.border}}>|</span>
          <button onClick={()=>setZoom(1)} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex'}} title="Fit"><Maximize2 size={14}/></button>
          <button style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex'}} title="Undo"><Undo2 size={14}/></button>
          <button style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',display:'flex'}} title="Redo"><Redo2 size={14}/></button>
        </div>
      </div>

      {/* RIGHT CONFIG PANEL */}
      {configNode&&(()=>{
        const node=wf.nodes.find(n=>n.id===configNode);
        if(!node) return null;
        const upd=(patch)=>updateNode(node.id,patch);
        const cfg=node.config||{};
        const updCfg=(patch)=>upd({config:{...cfg,...patch}});
        return(
        <div style={{width:300,background:'#fff',borderLeft:`1px solid ${C.border}`,overflowY:'auto',padding:20,flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.ink}}>Configure {node.type==='event'?'Event':node.type==='condition'?'Condition':'Action'}</div>
            <button onClick={()=>setConfigNode(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.sub,display:'flex'}}><X size={16}/></button>
          </div>
          {node.type==='event'&&(
            <div>
              <label style={lbl}>Trigger Event</label>
              <div style={{fontSize:13,color:C.ink,fontWeight:600,padding:'8px 0'}}>{node.label}</div>
              {wf.triggerEvent==='lead.field_changed'&&(
                <div style={{marginTop:8}}><label style={lbl}>Field</label>
                <select value={wf.triggerConfig?.field||''} onChange={e=>{const f=FIELD_CATALOG.find(f=>f.key===e.target.value);set({triggerConfig:{field:e.target.value}});upd({detailLabel:f?.label||''});}} style={inp}>
                  <option value="">Select…</option>
                  {FIELD_CATALOG.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                </select></div>
              )}
              {(wf.triggerEvent==='lead.template_replied'||wf.triggerEvent==='lead.waca_list_replied')&&(
                <div style={{marginTop:8}}><label style={lbl}>Template</label>
                <select value={wf.triggerConfig?.templateId||''} onChange={e=>{const t=msgTemplates.find(t=>t._id===e.target.value);set({triggerConfig:{templateId:e.target.value}});upd({detailLabel:t?.shortcut||''});}} style={inp}>
                  <option value="">Select…</option>
                  {msgTemplates.map(t=><option key={t._id} value={t._id}>{t.shortcut}</option>)}
                </select></div>
              )}
              {(wf.triggerEvent==='lead.custom_action_created'||wf.triggerEvent==='lead.custom_action_updated')&&(
                <div style={{marginTop:8}}><label style={lbl}>Custom Action</label>
                <input value={wf.triggerConfig?.customActionId||''} onChange={e=>set({triggerConfig:{customActionId:e.target.value}})} placeholder="Custom action ID" style={inp}/></div>
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
              <select value={node.actionType} onChange={e=>upd({actionType:e.target.value,label:ACTION_CATALOG.find(a=>a.type===e.target.value)?.label||e.target.value,config:{}})} style={inp}>
                {ACTION_CATALOG.map(a=><option key={a.type} value={a.type}>{a.label}</option>)}
              </select></div>

              {node.actionType==='call_api'&&<div><label style={lbl}>API Template</label><select value={cfg.apiTemplateId||''} onChange={e=>updCfg({apiTemplateId:e.target.value})} style={inp}><option value="">Select…</option>{templates.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}</select></div>}
              {node.actionType==='trigger_n8n'&&<div><label style={lbl}>n8n Workflow</label><select value={cfg.n8nWorkflowId||''} onChange={e=>updCfg({n8nWorkflowId:e.target.value})} style={inp}><option value="">Select…</option>{n8nWfs.map(nw=><option key={nw.id} value={nw.id}>{nw.name}</option>)}</select></div>}
              {node.actionType==='trigger_webhook'&&<div><label style={lbl}>Webhook</label><select value={cfg.webhookId||''} onChange={e=>updCfg({webhookId:e.target.value})} style={inp}><option value="">Select…</option>{hooks.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}</select></div>}
              {node.actionType==='notify_team_member'&&<><div><label style={lbl}>Team Member</label><select value={cfg.userId||''} onChange={e=>updCfg({userId:e.target.value})} style={inp}><option value="">Assigned caller</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div><div><label style={lbl}>Message</label><input value={cfg.message||''} onChange={e=>updCfg({message:e.target.value})} placeholder="Use {{lead.name}}" style={inp}/></div></>}
              {node.actionType==='update_lead_status'&&<div><label style={lbl}>New Status</label><select value={cfg.status||''} onChange={e=>{updCfg({status:e.target.value});upd({detailLabel:e.target.value})}} style={inp}><option value="">Select…</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>}
              {node.actionType==='update_lead_assignee'&&<div><label style={lbl}>Assign To</label><select value={cfg.userId||''} onChange={e=>{const u=users.find(u=>u._id===e.target.value);updCfg({userId:e.target.value});upd({detailLabel:u?.name||''})}} style={inp}><option value="">Select…</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div>}
              {node.actionType==='update_lead_rating'&&<div><label style={lbl}>Rating</label><select value={cfg.rating||''} onChange={e=>{updCfg({rating:Number(e.target.value)});upd({detailLabel:`${e.target.value} ★`})}} style={inp}><option value="">Select…</option>{[1,2,3,4,5].map(r=><option key={r} value={r}>{r} ★</option>)}</select></div>}
              {node.actionType==='update_lead_fields'&&<><div><label style={lbl}>Lead Field</label><select value={cfg.leadField||''} onChange={e=>{updCfg({leadField:e.target.value});upd({detailLabel:FIELD_CATALOG.find(f=>f.key===e.target.value)?.label||''})}} style={inp}><option value="">Select…</option>{FIELD_CATALOG.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select></div><div><label style={{...lbl,marginTop:8}}>Value</label><input value={cfg.value||''} onChange={e=>updCfg({value:e.target.value})} placeholder="Static value or {{submission.fieldId}}" style={inp}/></div></>}
              {node.actionType==='time_delay'&&<div><label style={lbl}>Delay (minutes)</label><input type="number" min="0" value={cfg.minutes||0} onChange={e=>{updCfg({minutes:Number(e.target.value)});upd({detailLabel:`${e.target.value}m`})}} style={inp}/></div>}
              {node.actionType==='add_in_list'&&<div><label style={lbl}>List Name</label><input value={cfg.listName||''} onChange={e=>{updCfg({listName:e.target.value});upd({detailLabel:e.target.value})}} style={inp}/></div>}
              {node.actionType==='remove_from_list'&&<div><label style={lbl}>List Name</label><input value={cfg.listName||''} onChange={e=>{updCfg({listName:e.target.value});upd({detailLabel:e.target.value})}} style={inp}/></div>}
              {node.actionType==='add_call_followup'&&<><div><label style={lbl}>Assign To</label><select value={cfg.userId||''} onChange={e=>updCfg({userId:e.target.value})} style={inp}><option value="">Assigned caller</option>{users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></div><div><label style={{...lbl,marginTop:8}}>Note</label><input value={cfg.note||''} onChange={e=>updCfg({note:e.target.value})} style={inp}/></div></>}
              {node.actionType==='add_payment'&&<div><label style={lbl}>Amount (₹)</label><input type="number" value={cfg.amount||0} onChange={e=>{updCfg({amount:Number(e.target.value)});upd({detailLabel:`₹${e.target.value}`})}} style={inp}/></div>}
              {node.actionType==='send_template'&&<div><label style={lbl}>Template</label><select value={cfg.templateId||''} onChange={e=>{const t=msgTemplates.find(t=>t._id===e.target.value);updCfg({templateId:e.target.value});upd({detailLabel:t?.shortcut||''})}} style={inp}><option value="">Select…</option>{msgTemplates.map(t=><option key={t._id} value={t._id}>{t.shortcut}</option>)}</select></div>}
              {node.actionType==='create_custom_action'&&<div><label style={lbl}>Label</label><input value={cfg.label||''} onChange={e=>{updCfg({label:e.target.value});upd({detailLabel:e.target.value})}} style={inp}/></div>}
              {node.actionType==='add_ivr_action'&&<div style={{fontSize:12,color:C.sub}}>Connect an IVR provider in Settings to configure this action.</div>}
              {node.actionType==='cancel_tasks'&&<div style={{fontSize:12,color:C.sub}}>Cancels all upcoming follow-up tasks for this lead.</div>}
              {node.actionType==='email_report'&&<div><label style={lbl}>Email</label><input value={cfg.email||''} onChange={e=>updCfg({email:e.target.value})} placeholder="admin@example.com" style={inp}/></div>}
            </div>
          )}
          {node.type==='condition'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div><label style={lbl}>Field</label><input value={cfg.field||''} onChange={e=>updCfg({field:e.target.value})} placeholder="e.g. status, rating" style={inp}/></div>
              <div><label style={lbl}>Operator</label><select value={cfg.operator||'equals'} onChange={e=>updCfg({operator:e.target.value})} style={inp}><option value="equals">Equals</option><option value="not_equals">Not Equals</option><option value="contains">Contains</option><option value="exists">Exists</option></select></div>
              <div><label style={lbl}>Value</label><input value={cfg.value||''} onChange={e=>updCfg({value:e.target.value})} style={inp}/></div>
            </div>
          )}
        </div>);
      })()}

      {/* Alerts modal */}
      {showAlerts&&(
        <div style={{position:'fixed',inset:0,background:'rgba(30,27,75,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{width:520,background:'#fff',borderRadius:14,padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:700,color:C.ink}}>Alerts</div>
              <button onClick={()=>setShowAlerts(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.sub,display:'flex'}}><X size={20}/></button>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:8}}>Errors</div>
            {errors.map((e,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fee2e2',color:C.red,padding:'10px 14px',borderRadius:8,fontSize:13.5,fontWeight:600}}>
                <span style={{display:'flex',alignItems:'center',gap:8}}><AlertTriangle size={15}/> {e}</span>
                <span style={{color:C.red,fontWeight:700,textDecoration:'underline',cursor:'pointer'}} onClick={()=>setShowAlerts(false)}>View Nodes</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
    ):(
    <div style={{flex:1,overflow:'auto',padding:20}}>
      <ExecutionsTable executions={executions} hasId={!!id}/>
    </div>
    )}
  </div>);
}
const paletteItem=(active)=>({display:'flex',flexDirection:'row',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:7,cursor:'pointer',fontSize:12,color:active?C.indigo:C.ink,fontWeight:active?600:400,background:active?C.indigoBg:'transparent',transition:'background .1s',lineHeight:1.3});

/* ─── SIDEBAR SECTION ─────────────────────────────────────────────────────── */
function SidebarSection({title,subtitle,children,accent}){
  const [open,setOpen]=useState(true);
  return(
  <div style={{marginBottom:10}}>
    <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px',cursor:'pointer',borderLeft:accent?`3px solid ${C.indigo}`:'none',paddingLeft:accent?8:4}}>
      <div><div style={{fontSize:13.5,fontWeight:700,color:C.ink}}>{title}</div>{subtitle&&<div style={{fontSize:11,color:C.sub}}>{subtitle}</div>}</div>
      {open?<ChevronUp size={14} style={{color:C.sub}}/>:<ChevronDown size={14} style={{color:C.sub}}/>}
    </div>
    {open&&<div style={{padding:'2px 4px 8px'}}>{children}</div>}
  </div>);
}

/* ─── FLOW NODE ───────────────────────────────────────────────────────────── */
function FlowNode({node,pos,selected,menuOpen,onClick,onMenu,onDelete}){
  const colors={event:'var(--theme-primary-deep)',action:C.indigo,condition:'#0e7490'};
  const tagBg={event:'var(--theme-surface-tint2)',action:'#eef2ff',condition:'#e0f2fe'};
  const tagFg={event:'var(--theme-primary-deep)',action:C.indigo,condition:'#0e7490'};
  const tagLabels={event:'EVENT',action:'ACTION',condition:'CONDITION'};
  const header=colors[node.type]||C.indigo;
  const ac=ACTION_CATALOG.find(a=>a.type===node.actionType);
  const NodeIcon=ac?.Icon;
  const detail=node.type==='event'?node.detailLabel:(node.type==='condition'?(node.config?.field?`${node.config.field} ${node.config.operator||'equals'} ${node.config.value||''}`:'Any lead'):node.detailLabel);

  return(
  <div style={{position:'absolute',left:pos.x,top:pos.y,width:NODE_W,zIndex:1}}>
    <div onClick={onClick} style={{cursor:'pointer'}}>
      <div style={{
        background:'#fff',borderRadius:12,
        border:selected?`2px solid ${header}`:`1.5px solid ${C.border}`,
        boxShadow:selected?`0 0 0 3px ${header}22`:'0 2px 12px rgba(30,20,80,.07)',
        overflow:'visible',
      }}>
        {/* tag pill inside top-left */}
        <div style={{padding:'12px 14px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,borderBottom:`1px solid var(--theme-surface-tint)`}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:tagBg[node.type],color:tagFg[node.type],padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',flexShrink:0}}>{tagLabels[node.type]}</span>
            <span style={{fontSize:13.5,fontWeight:700,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{node.label}</span>
          </div>
          {onDelete&&<button onClick={e=>{e.stopPropagation();onMenu();}} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',display:'flex',flexShrink:0,padding:2}}><MoreVertical size={15}/></button>}
        </div>
        {detail&&(
          <div style={{padding:'9px 14px',display:'flex',alignItems:'center',gap:8}}>
            {NodeIcon?<NodeIcon size={14} style={{color:header,flexShrink:0}}/>:<Filter size={14} style={{color:header,flexShrink:0}}/>}
            <span style={{flex:1,fontSize:12.5,color:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{detail}</span>
          </div>
        )}
        {!detail&&<div style={{height:6}}/>}
      </div>
    </div>
    {/* connector dot bottom center */}
    <div style={{position:'absolute',bottom:-8,left:'50%',transform:'translateX(-50%)',width:16,height:16,borderRadius:'50%',border:`2px solid ${header}`,background:'#fff',zIndex:2}}/>
    {menuOpen&&onDelete&&(
      <div style={{position:'absolute',top:36,right:0,background:'#fff',border:`1px solid ${C.border}`,borderRadius:8,boxShadow:'0 4px 14px rgba(0,0,0,.12)',zIndex:5,minWidth:120}}>
        <div onClick={e=>{e.stopPropagation();onDelete();}} style={{padding:'9px 14px',fontSize:13,color:C.red,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><Trash2 size={13}/> Delete</div>
      </div>
    )}
  </div>);
}

/* ─── EXECUTIONS TABLE ────────────────────────────────────────────────────── */
function ExecutionsTable({executions,hasId}){
  if(!hasId) return <div style={{...card,padding:40,textAlign:'center',color:C.sub}}>Save the workflow first to see executions.</div>;
  const statusColors={success:['#d1fae5',C.green],failed:['#fee2e2',C.red],pending:['#e0e7ff','#4f46e5'],cancelled:['#f3f4f6',C.sub]};
  return(
  <div style={{...card,overflow:'hidden'}}>
    <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1fr',padding:'12px 18px',background:'var(--theme-surface-faint2)',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase'}}>
      <span>Lead</span><span>Status</span><span>Duration</span><span>When</span>
    </div>
    {executions.length===0?<div style={{padding:36,textAlign:'center',color:C.sub}}>No executions found</div>
    :executions.map((ex,i)=>{
      const[bg,fg]=statusColors[ex.status]||statusColors.pending;
      return(
      <div key={ex._id} style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1fr',padding:'12px 18px',alignItems:'center',borderBottom:i<executions.length-1?'1px solid var(--theme-surface-faint5)':'none',fontSize:13}}>
        <span style={{color:C.ink,fontWeight:600}}>{ex.lead?.name||'—'}</span>
        <span><span style={{background:bg,color:fg,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{ex.status}</span></span>
        <span style={{color:C.sub}}>{ex.durationMs?`${ex.durationMs}ms`:'—'}</span>
        <span style={{color:C.sub}}>{new Date(ex.createdAt).toLocaleString()}</span>
      </div>);
    })}
  </div>);
}