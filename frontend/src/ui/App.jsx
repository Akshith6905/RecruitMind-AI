import React, { useEffect, useState } from 'react';
import Login from './Login';
import axios from 'axios';
import { ArrowDown, ArrowRight, BrainCircuit, BriefcaseBusiness, Check, CircleHelp, FileText, Plus, Search, Sparkles, Upload, Users, X, Trash2, AlertTriangle } from 'lucide-react';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api' });
const demoRole = { title: 'AI / ML Engineer', team: 'Applied Intelligence', description: 'Build reliable ML powered products and APIs.', required_skills: ['Python', 'Machine Learning', 'FastAPI', 'SQL'], preferred_skills: ['PyTorch', 'Docker', 'AWS'], min_experience: 2 };

export default function App() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]), [job, setJob] = useState(null), [candidate, setCandidate] = useState(null), [evaluation, setEvaluation] = useState(null);
  const [memoryOn, setMemoryOn] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [feedback, setFeedback] = useState(''), [tab, setTab] = useState('Overview');
  const [uploadFile, setUploadFile] = useState(null), [uploadPhase, setUploadPhase] = useState('idle'), [uploadProgress, setUploadProgress] = useState(0), [uploadIssue, setUploadIssue] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showRoleList, setShowRoleList] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [roleForm, setRoleForm] = useState({title: '', skills: ''});
  const [confirmAction, setConfirmAction] = useState(null);
  const refresh = async () => { try { const [j,h] = await Promise.all([api.get('/jobs'), api.get('/health')]); setJobs(j.data); setMemoryOn(h.data.memory_enabled); } catch { setMessage('Start the FastAPI backend to connect this workspace.'); } };
  useEffect(() => { refresh(); }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }
  const createDemo = async () => { setBusy(true); try { const { data } = await api.post('/jobs', demoRole); setJob(data); setJobs(await api.get('/jobs').then(r=>r.data)); setMessage('Role created. Add a PDF or DOCX resume to start the memory workflow.'); } catch { setMessage('Could not create role. Check that the backend is running.'); } finally { setBusy(false); } };
  const createCustom = () => { setRoleForm({title: '', skills: ''}); setShowRoleModal(true); };
  const submitCustomRole = async () => {
    if (!roleForm.title) return;
    setBusy(true);
    try {
      const data = await api.post('/jobs', {title: roleForm.title, team:'Hiring team', required_skills:(roleForm.skills||'').split(',').map(x=>x.trim()).filter(Boolean), preferred_skills:[], description:'', min_experience:0});
      setJob(data.data);
      setShowRoleModal(false);
      await refresh();
    } catch {
      setMessage('Could not create role.');
    } finally {
      setBusy(false);
    }
  };
  const selectResume = e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadFile(file); setUploadProgress(0); setUploadIssue(''); setMessage('');
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(extension)) { setUploadPhase('error'); setUploadIssue('Choose a PDF or DOCX file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadPhase('error'); setUploadIssue('This file is over the 10 MB limit. Choose a smaller resume.'); return; }
    setUploadPhase('ready');
  };
  const clearResume = () => { setUploadFile(null); setUploadPhase('idle'); setUploadProgress(0); setUploadIssue(''); };
  const upload = async () => {
    const activeJob = job || jobs[0];
    if (!uploadFile || !activeJob || uploadPhase === 'error') return;
    setBusy(true); setUploadPhase('uploading'); setUploadProgress(0); setMessage('Uploading resume…');
    try {
      const form = new FormData(); form.append('file', uploadFile);
      const { data } = await api.post(`/jobs/${activeJob.id}/candidates`, form, { onUploadProgress: event => { if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100)); } });
      setCandidate(data); setEvaluation(null); setUploadPhase('uploaded'); setUploadProgress(100); setMessage('Resume uploaded and parsed. Evaluating it against role evidence and relevant memory…');
      await refresh();
      try {
        const result = await api.post(`/candidates/${data.id}/evaluate`);
        setEvaluation(result.data); setCandidate(current => ({ ...current, recommendation: result.data, resume_file: result.data.resume_file || data.resume_file })); setUploadPhase('complete'); setMessage('Resume uploaded, parsed, and evaluated. Its file details are saved in the candidate profile.');
      } catch (err) {
        setUploadPhase('uploaded'); setMessage(`Resume uploaded and parsed, but evaluation failed: ${err.response?.data?.detail || 'try evaluating this candidate again.'}`);
      }
    } catch (err) {
      setUploadPhase('error'); setUploadIssue(err.response?.data?.detail || 'Upload failed. Check the file and try again.'); setMessage('The resume was not uploaded.');
    } finally { setBusy(false); }
  };
  const decision = async value => { if(!candidate) return; setBusy(true); try { const rationale=feedback.trim() || `Recruiter marked ${value} based on the role evidence reviewed.`; const {data}=await api.post(`/candidates/${candidate.id}/decision`,{decision:value,feedback:rationale}); setCandidate(current=>({...current,decision:data.decision,feedback:rationale})); setMessage(data.message); setFeedback(''); await refresh(); setConfirmAction(null); } catch(err){setMessage(err.response?.data?.detail || 'Could not save decision.');} finally{setBusy(false);} };
  const candidateItems = jobs.flatMap(role => (role.candidates || []).map(item => ({...item, job_id:role.id, job_title:role.title, team:role.team})));
  const selectCandidate = async item => {
    setBusy(true);
    try {
      setUploadFile(null); setUploadPhase('idle'); setUploadProgress(0); setUploadIssue('');
      const {data} = await api.get(`/candidates/${item.id}`);
      const role = jobs.find(entry => entry.id === data.job_id);
      setCandidate(data);
      if (role) setJob(role);
      setFeedback(data.feedback || '');
      if (data.recommendation?.match_score != null) setEvaluation(data.recommendation);
      else {
        setEvaluation(null);
        const result = await api.post(`/candidates/${data.id}/evaluate`);
        setEvaluation(result.data);
      }
      setMessage('');
    } catch(err) { setMessage(err.response?.data?.detail || 'Could not load this candidate.'); }
    finally { setBusy(false); }
  };

  const deleteCandidate = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      await api.delete(`/candidates/${candidate.id}`);
      setMessage('Candidate removed.');
      setCandidate(null);
      setEvaluation(null);
      setConfirmAction(null);
      await refresh();
    } catch(err) {
      setMessage(err.response?.data?.detail || 'Could not delete candidate.');
    } finally {
      setBusy(false);
    }
  };

  const deleteRole = async () => {
    const roleToDelete = confirmAction?.role;
    if (!roleToDelete) return;
    setBusy(true);
    try {
      const {data} = await api.delete(`/jobs/${roleToDelete.id}`);
      if (candidate?.job_id === roleToDelete.id) {
        setCandidate(null);
        setEvaluation(null);
        setFeedback('');
        clearResume();
      }
      if (job?.id === roleToDelete.id) setJob(null);
      setJobs(await api.get('/jobs').then(response => response.data));
      setShowRoleList(false);
      setConfirmAction(null);
      setMessage(`Role deleted with ${data.deleted_candidates} candidate${data.deleted_candidates === 1 ? '' : 's'}. Related Hindsight memories were not deleted.`);
    } catch(err) {
      setMessage(err.response?.data?.detail || 'Could not delete role.');
    } finally {
      setBusy(false);
    }
  };

  const active = job || jobs[0];
  return <div className="shell"><aside className="sidebar"><button className="brand brand-button" type="button" onClick={()=>setTab('Overview')} aria-label="Go to Overview"><span className="brand-icon"><BrainCircuit size={20}/></span><span>recruit<span className="brand-accent">mind</span><small>HIRING, WITH CONTEXT</small></span></button><div className="workspace-label">WORKSPACE</div><div className="nav"><button className={tab==='Overview'?'selected':''} onClick={()=>setTab('Overview')}><BriefcaseBusiness size={17}/> Overview</button><button className={tab==='Candidates'?'selected':''} onClick={()=>setTab('Candidates')}><Users size={17}/> Candidates <span className="nav-count">{active?.candidates?.length||'—'}</span></button><button className={tab==='Memory'?'selected':''} onClick={()=>setTab('Memory')}><BrainCircuit size={17}/> Memory impact</button></div><div className="side-bottom"><div className="memory-status"><span className={`status-dot ${memoryOn?'live':''}`}></span><div><strong>{memoryOn?'Hindsight connected':'Memory not configured'}</strong><small>{memoryOn?'Recall + retain active':'Set HINDSIGHT_URL to enable'}</small></div></div><button className="profile" type="button" onClick={() => setUser(null)} title="Sign out" aria-label={`Sign out ${user.name}`}><div className="avatar">{user.initials}</div><div><strong>{user.name}</strong><small>{user.role} · Sign out</small></div></button></div></aside>
    <main><header className="topbar"><div className="crumb">Recruitment <span>/</span> <b>{tab}</b></div><div className="top-right"><button className="icon-button" type="button" aria-label="Help and how RecruitMind works" onClick={()=>setShowHelp(true)}><CircleHelp size={18}/></button><div className="avatar small-avatar">{user.initials}</div></div></header><div className="content"><section className="welcome"><div><div className="eyebrow"><span className="eyebrow-dot"></span> RECRUITMENT WORKSPACE</div><h1>{tab==='Memory'?'How memory changes hiring':tab==='Candidates'?'Candidate pipeline':`Good morning, ${user.name}`}<span className="period">.</span></h1><p>{tab==='Memory'?'See the decisions and recruiter feedback that give future evaluations useful context.':'A clearer view of your roles, candidates, and the decisions behind them.'}</p></div><button className="primary" onClick={createCustom}><Plus size={17}/> Create a role</button></section>
      {message&&<div className="notice"><span>{message}</span><button onClick={()=>setMessage('')}>×</button></div>}
      <section className="stat-grid"><article className="stat-card"><div className="stat-head">OPEN ROLES <BriefcaseBusiness size={16}/></div><strong>{jobs.length}</strong><small>Across your workspace</small></article><article className="stat-card"><div className="stat-head">CANDIDATES REVIEWED <Users size={16}/></div><strong>{jobs.reduce((n,j)=>n+(j.candidates?.length||0),0)}</strong><small>Recruiter-led evaluations</small></article><article className="stat-card memory-stat"><div className="stat-head">MEMORY STATUS <BrainCircuit size={16}/></div><strong className="memory-value">{memoryOn?'Learning':'Not connected'}</strong><small>{memoryOn?'Decisions inform future context':'Connect Hindsight in backend config'}</small></article></section>
      {tab==='Memory'?<section className="panel impact"><div className="panel-title"><div><span className="eyebrow">THE MEMORY LOOP</span><h2>Every decision can make the next one more relevant.</h2></div><span className={`pill ${memoryOn?'green':''}`}><i/> {memoryOn?'LIVE MEMORY':'AWAITING CONNECTION'}</span></div><div className="loop"><div><span className="loop-icon"><FileText/></span><b>New evidence</b><small>Resume + role requirements</small></div><ArrowRight/><div><span className="loop-icon purple"><BrainCircuit/></span><b>Recall context</b><small>{memoryOn?'Relevant Hindsight memories':'Connect Hindsight to activate'}</small></div><ArrowRight/><div><span className="loop-icon amber"><Sparkles/></span><b>Explainable review</b><small>Evidence with recruiter context</small></div><ArrowRight/><div><span className="loop-icon green-bg"><Check/></span><b>Recruiter feedback</b><small>Retained for future recall</small></div></div><div className="memory-demo"><div className="demo-label">CURRENT EVALUATION</div><h3>{candidate?.name||'Select a candidate to see memory impact'}</h3><p>{evaluation?.explanation||'Choose a candidate from the Candidates tab. Their evidence and any Hindsight memories recalled during evaluation will appear here.'}</p>{evaluation&&<div className="method-note">Evaluation method: {evaluation.evaluation_method==='configured_llm'?'configured AI provider':'transparent evidence rules'}{evaluation.evaluation_notice?` · ${evaluation.evaluation_notice}`:''}</div>}{candidate&&<div className="memory-evidence"><b>Candidate evidence</b><span>Skills: {candidate.skills?.join(' · ') || 'No recognized skills extracted'}</span>{candidate.decision&&<span>Recruiter decision: {candidate.decision.toUpperCase()}</span>}</div>}{evaluation?.memory_context?.length>0&&<div className="recalls"><b>Relevant memories recalled</b>{evaluation.memory_context.map((m,i)=><div key={i}>“{m}”</div>)}</div>}{evaluation&&evaluation.memory_context?.length===0&&<div className="no-memories">{evaluation.memory_enabled?'No relevant Hindsight memories were recalled for this evaluation.':'Hindsight is not connected; this evaluation has no historical memory context.'}</div>}<div className="demo-bottom"><span>{evaluation?`${evaluation.memory_context?.length||0} relevant memories in context`:'No candidate selected'}</span>{candidate&&<button className="text-button" onClick={()=>setTab('Candidates')}>Open candidate <ArrowRight size={13}/></button>}</div></div></section>:tab==='Candidates'?<CandidatePipeline items={candidateItems} selected={candidate} evaluation={evaluation} busy={busy} onSelect={selectCandidate} onReviewRole={()=>setTab('Overview')} onDecision={(val)=>setConfirmAction({type: 'decision', value: val})} onDelete={()=>setConfirmAction({type: 'delete'})} feedback={feedback} setFeedback={setFeedback} />:<div className="columns"><section className="panel role-panel"><div className="panel-title"><div><span className="eyebrow">YOUR WORK</span><h2>Active roles</h2></div><button className="text-button" onClick={()=>setShowRoleList(true)}>View all <ArrowRight size={14}/></button></div>{jobs.length===0?<div className="empty"><div className="empty-icon"><BriefcaseBusiness/></div><h3>Your next great hire starts here.</h3><p>Create a role, then add a resume to see an evidence-led evaluation with recruiter memory.</p><button className="primary" disabled={busy} onClick={createDemo}><Plus size={16}/> Create demo role</button></div>:<div className="role-list">{jobs.map(j=><div key={j.id} className="role-row-item"><button type="button" className={`role-row role-select ${active?.id===j.id?'role-active':''}`} onClick={()=>{setJob(j);setCandidate(null);setEvaluation(null)}}><div className="role-icon"><BriefcaseBusiness size={17}/></div><div className="role-name"><strong>{j.title}</strong><small>{j.team} · {j.required_skills?.length||0} required skills</small></div><span className="role-badge">OPEN</span><ArrowRight size={16}/></button><button type="button" className="icon-button role-delete" aria-label={`Delete ${j.title}`} title="Delete role" disabled={busy} onClick={()=>setConfirmAction({type:'delete-role', role:j})}><Trash2 size={16}/></button></div>)}</div>}</section>
      <section className="panel candidate-panel"><div className="panel-title"><div><span className="eyebrow">ROLE WORKFLOW</span><h2>{active?active.title:'Get started'}</h2></div><span className={`pill ${memoryOn?'green':''}`}><i/>{memoryOn?'MEMORY ON':'MEMORY OFF'}</span></div>{active?<><div className="role-detail"><span>REQUIRED SKILLS</span><div className="chips">{active.required_skills?.map(s=><span key={s}>{s}</span>)}</div></div>{candidate?<div className="candidate-result"><div className="candidate-head"><div className="candidate-avatar">{candidate.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>{candidate.name}</strong><small>{candidate.email||'Contact details not found'}</small></div>{evaluation&&<span className="score">{evaluation.match_score}<small> / 100</small></span>}</div><ResumeFileStatus file={candidate.resume_file || evaluation?.resume_file} phase={uploadPhase==='complete'?'complete':'uploaded'}/><div className="profile-skills"><span>EXTRACTED SKILLS</span><p>{candidate.skills?.length?candidate.skills.join(' · '):'No recognized skills found in parsed resume.'}</p></div>{evaluation&&<><div className="evidence"><div className="evidence-title"><Sparkles size={15}/> Evaluation evidence</div><p>{evaluation.explanation}</p>{evaluation.evidence.map((e,i)=><small key={i}>• {e}</small>)}</div><div className="feedback"><label htmlFor="feedback">YOUR REASONING <span>Added to memory when saved</span></label><textarea id="feedback" value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="What influenced your decision? Add specific, job-related reasoning…"/></div><div className="decision-row"><button onClick={()=>decision('shortlist')} disabled={busy}>Shortlist</button><button onClick={()=>decision('maybe')} disabled={busy}>Maybe</button><button onClick={()=>decision('reject')} disabled={busy}>Pass</button></div></>}</div>:<div className="upload-control">{uploadFile?<div className={`upload-card ${uploadPhase}`} aria-live="polite"><div className="upload-card-head"><span className="upload-file-icon"><FileText size={18}/></span><div className="upload-file-copy"><strong title={uploadFile.name}>{uploadFile.name}</strong><small>{formatFileSize(uploadFile.size)} · PDF or DOCX</small></div><span className={`upload-state ${uploadPhase}`}>{uploadPhase==='ready'?'Ready to upload':uploadPhase==='uploading'?`Uploading ${uploadProgress}%`:uploadPhase==='error'?'Needs attention':'Uploaded'}</span>{['ready','error'].includes(uploadPhase)&&<button className="upload-remove" type="button" aria-label="Remove selected resume" onClick={clearResume}><X size={16}/></button>}</div>{uploadPhase==='uploading'&&<div className="upload-progress" role="progressbar" aria-label="Resume upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress}><span style={{width:`${uploadProgress}%`}}/></div>}{uploadPhase==='error'&&<p className="upload-issue">{uploadIssue}</p>}{['ready','error'].includes(uploadPhase)&&<div className="upload-actions"><label className="secondary-button">Choose another<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={selectResume}/></label><button className="primary" type="button" disabled={busy||uploadPhase==='error'} onClick={upload}><Upload size={14}/> Upload &amp; evaluate</button></div>}</div>:<label className="upload-zone"><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={selectResume} disabled={busy}/><span className="upload-icon"><FileText size={21}/></span><strong>Add a candidate resume</strong><small>PDF or DOCX · Up to 10 MB</small><span className="upload-button">Choose file <ArrowRight size={14}/></span></label>}</div>}<div className="panel-foot"><span><Search size={14}/> {candidate?'Candidate evaluated against role evidence':'Skills compared with the role requirements'}</span><button onClick={()=>{if(candidate){setCandidate(null);setEvaluation(null);clearResume();setMessage('')}else{setShowHelp(true)}}}>{candidate?'Review another':'How it works'} <ArrowRight size={13}/></button></div></>:<div className="empty compact"><h3>Create your first role</h3><p>Start with a demo AI / ML engineering role.</p><button className="primary" onClick={createDemo}><Plus size={16}/> Create demo role</button></div>}</section></div>
      }<footer>RecruitMind supports recruiter judgment with role-related evidence. Recommendations are decision support, not hiring decisions.

      {showRoleList && (
        <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setShowRoleList(false); }}>
          <section className="modal-card role-list-modal" role="dialog" aria-modal="true" aria-labelledby="role-list-title">
            <div className="modal-header"><h2 id="role-list-title">All roles</h2><button className="icon-button" type="button" aria-label="Close roles list" onClick={() => setShowRoleList(false)}><X size={18}/></button></div>
            <div className="role-list-modal-body">
              {jobs.length ? jobs.map(item => <div key={item.id} className="role-row-item"><button className={`role-row role-list-choice role-select ${active?.id===item.id?'role-active':''}`} type="button" onClick={() => { setJob(item); setCandidate(null); setEvaluation(null); setShowRoleList(false); setTab('Overview'); }}><span className="role-icon"><BriefcaseBusiness size={17}/></span><span className="role-name"><strong>{item.title}</strong><small>{item.team} · {item.required_skills?.length||0} required skills · {item.candidates?.length||0} candidates</small></span><span className="role-badge">OPEN</span><ArrowRight size={16}/></button><button type="button" className="icon-button role-delete" aria-label={`Delete ${item.title}`} title="Delete role" disabled={busy} onClick={()=>setConfirmAction({type:'delete-role', role:item})}><Trash2 size={16}/></button></div>) : <div className="empty"><h3>No roles yet</h3><p>Create a role to start a hiring workflow.</p></div>}
              <button className="primary" type="button" onClick={() => { setShowRoleList(false); createCustom(); }}><Plus size={15}/> Create a role</button>
            </div>
          </section>
        </div>
      )}
      {showHelp && (
        <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setShowHelp(false); }}>
          <section className="modal-card help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <div className="modal-header"><h2 id="help-title">How RecruitMind works</h2><button className="icon-button" type="button" aria-label="Close help" onClick={() => setShowHelp(false)}><X size={18}/></button></div>
            <div className="help-steps">
              <article><span>1</span><div><strong>Choose a role</strong><p>Select an existing role or create one with its required skills.</p></div></article>
              <article><span>2</span><div><strong>Upload a resume</strong><p>Add a PDF or DOCX file up to 10 MB. RecruitMind extracts the candidate profile.</p></div></article>
              <article><span>3</span><div><strong>Review the evaluation</strong><p>The configured model compares resume evidence with role requirements and may include relevant Hindsight memories. The result supports recruiter review.</p></div></article>
              <article><span>4</span><div><strong>Record your decision</strong><p>Add job-related reasoning. RecruitMind asks you to confirm before saving the decision and sending its rationale to memory.</p></div></article>
            </div>
            <div className="modal-footer"><button className="primary" type="button" onClick={() => setShowHelp(false)}>Got it</button></div>
          </section>
        </div>
      )}
      {confirmAction && (
        <div className="modal-overlay">
          <div className="modal-card confirm-modal">
            <div className="modal-header">
              <h2>{confirmAction.type === 'delete-role' ? 'Delete Role' : confirmAction.type === 'delete' ? 'Delete Candidate' : 'Confirm Decision'}</h2>
              <button className="icon-button" onClick={() => setConfirmAction(null)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              {confirmAction.type === 'delete-role' ? (
                <div className="confirm-content warning">
                  <AlertTriangle size={24} className="warning-icon"/>
                  <div>
                    <p>Delete <strong>{confirmAction.role.title}</strong> and its {confirmAction.role.candidates?.length || 0} candidate profile(s)? This permanently removes the role, resumes, evaluations, and local decision records.</p>
                    <p>Memories already sent to Hindsight will remain in that bank and may still appear in future recall.</p>
                  </div>
                </div>
              ) : confirmAction.type === 'delete' ? (
                <div className="confirm-content warning">
                  <AlertTriangle size={24} className="warning-icon"/>
                  <p>Are you sure you want to permanently delete <strong>{candidate?.name}</strong> from this role? This cannot be undone.</p>
                </div>
              ) : (
                <div className="confirm-content">
                  <p>You are marking <strong>{candidate?.name}</strong> as <strong style={{textTransform:'uppercase'}}>{confirmAction.value}</strong>.</p>
                  <p><strong>Rationale:</strong> {feedback || 'No rationale provided. A default reason will be saved.'}</p>
                  <p className="memory-note"><BrainCircuit size={14}/> This decision and rationale will be saved to Hindsight memory to improve future AI evaluations.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setConfirmAction(null)}>Cancel</button>
              {confirmAction.type === 'delete-role' ? (
                <button className="primary danger-btn" onClick={deleteRole} disabled={busy}>Delete Role</button>
              ) : confirmAction.type === 'delete' ? (
                <button className="primary danger-btn" onClick={deleteCandidate} disabled={busy}>Delete</button>
              ) : (
                <button className="primary" onClick={() => decision(confirmAction.value)} disabled={busy}>Confirm Decision</button>
              )}
            </div>
          </div>
        </div>
      )}
      {showRoleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Create a new role</h2>
              <button className="icon-button" onClick={() => setShowRoleModal(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Role title</label>
                <input type="text" value={roleForm.title} onChange={e => setRoleForm({...roleForm, title: e.target.value})} placeholder="e.g. Frontend Developer" />
              </div>
              <div className="form-group">
                <label>Required skills (comma separated)</label>
                <input type="text" value={roleForm.skills} onChange={e => setRoleForm({...roleForm, skills: e.target.value})} placeholder="e.g. React, JavaScript, CSS" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setShowRoleModal(false)}>Cancel</button>
              <button className="primary" onClick={submitCustomRole} disabled={busy || !roleForm.title}>Create Role</button>
            </div>
          </div>
        </div>
      )}
</footer></div></main></div>
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable';
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ResumeFileStatus({file, phase = 'uploaded'}) {
  const complete = phase === 'complete';
  return <div className={`resume-file-status ${complete?'complete':''}`} aria-live="polite">
    <span className="resume-file-status-icon"><FileText size={16}/></span>
    <div className="resume-file-status-copy">
      <strong>{file?.name || 'Resume uploaded'}</strong>
      <small>{file?.size_bytes ? `${formatFileSize(file.size_bytes)} · ` : ''}{file?.name ? 'Saved to this candidate profile' : 'Original filename and size were not recorded for this earlier upload'}</small>
    </div>
    <span className="resume-uploaded-badge"><Check size={13}/>{complete?'Uploaded & evaluated':'Uploaded & parsed'}</span>
  </div>;
}

function CandidatePipeline({items, selected, evaluation, busy, onSelect, onReviewRole, onDecision, onDelete, feedback, setFeedback}) {
  return <section className="pipeline-grid">
    <div className="panel pipeline-list">
      <div className="panel-title"><div><span className="eyebrow">ALL ROLES</span><h2>Candidate pipeline</h2></div><span className="candidate-count">{items.length} {items.length===1?'candidate':'candidates'}</span></div>
      {items.length===0?<div className="empty"><div className="empty-icon"><Users/></div><h3>No candidates yet</h3><p>Add a resume from a role’s workflow. Parsed candidates will appear here for review.</p><button className="primary" onClick={onReviewRole}>Go to roles <ArrowRight size={14}/></button></div>:<div className="candidate-list">{items.map(item=><button key={item.id} className={`candidate-row ${selected?.id===item.id?'candidate-active':''}`} onClick={()=>onSelect(item)} disabled={busy}><div className="candidate-avatar">{item.name?.split(' ').map(x=>x[0]).slice(0,2).join('')||'?'}</div><div className="candidate-row-copy"><strong>{item.name}</strong><small>{item.job_title} · {item.team}</small></div><span className={`decision-pill ${item.decision||'pending'}`}>{item.decision||'pending'}</span><ArrowRight size={15}/></button>)}</div>}
    </div>
    <div className="panel pipeline-detail">
      {selected?<><div className="panel-title"><div><span className="eyebrow">CANDIDATE PROFILE</span><h2>{selected.name}</h2></div><div style={{display:'flex', gap:'15px', alignItems:'center'}}>{evaluation&&<span className="score">{evaluation.match_score}<small> / 100</small></span>}<button className="icon-button delete-icon" onClick={onDelete} disabled={busy} title="Delete Candidate"><Trash2 size={18}/></button></div></div><p className="candidate-meta">{selected.email||'Email not found'}{selected.phone?` · ${selected.phone}`:''}</p><ResumeFileStatus file={selected.resume_file || selected.recommendation?.resume_file} phase="uploaded"/>
        <div className="profile-skills"><span>EXTRACTED SKILLS</span><div className="chips">{selected.skills?.length?selected.skills.map(s=><span key={s}>{s}</span>):<small>No recognized skills found in the resume.</small>}</div></div>
        <div className="pipeline-evaluation"><div className="evidence-title"><Sparkles size={15}/> Evaluation · {evaluation?.evaluation_method==='configured_llm'?'AI':'Evidence rules'}</div>{evaluation?<><p>{evaluation.explanation}</p>{evaluation.evaluation_notice&&<small className="method-warning">{evaluation.evaluation_notice}</small>}{evaluation.matched_skills?.length>0&&<small><b>Matched:</b> {evaluation.matched_skills.join(', ')}</small>}{evaluation.missing_skills?.length>0&&<small><b>Not found:</b> {evaluation.missing_skills.join(', ')}</small>}</>:<p>{busy?'Loading candidate…':'No evaluation is available yet.'}</p>}</div>
        <div className="profile-blocks">{selected.education?.length>0&&<div><span>EDUCATION</span>{selected.education.map((x,i)=><p key={i}>{x}</p>)}</div>}{selected.experience?.length>0&&<div><span>EXPERIENCE</span>{selected.experience.slice(0,3).map((x,i)=><p key={i}>{x}</p>)}</div>}{selected.decision ? <div><span>RECRUITER DECISION</span><p><b>{selected.decision.toUpperCase()}</b>{selected.feedback?` — ${selected.feedback}`:''}</p></div> :
          <div className="decision-ui">
            <div className="feedback">
              <label htmlFor="feedback">YOUR REASONING <span>Added to memory</span></label>
              <textarea id="feedback" value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Add specific reasoning for your decision..."/>
            </div>
            <div className="decision-row">
              <button className="accept-btn" onClick={()=>onDecision('accept')} disabled={busy}>Accept</button>
              <button className="shortlist-btn" onClick={()=>onDecision('shortlist')} disabled={busy}>Shortlist</button>
              <button className="reject-btn" onClick={()=>onDecision('reject')} disabled={busy}>Reject</button>
            </div>
          </div>
        }</div>
      </>:<div className="empty"><div className="empty-icon"><FileText/></div><h3>Select a candidate</h3><p>Choose someone from the pipeline to review their extracted profile, evaluation evidence, and recruiter decision.</p></div>}
    </div>
  </section>;
}
