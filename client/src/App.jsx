import { useState } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './auth/useAuth.jsx';
import AuthPage        from './auth/AuthPage.jsx';
import RoleSelector    from './candidate/RoleSelector.jsx';
import JDInterviewSetup from './candidate/JDInterviewSetup.jsx';
import JobBoard from './candidate/JobBoard.jsx';
import PermissionsGate from './candidate/PermissionsGate.jsx';
import VoiceInterview  from './candidate/VoiceInterview.jsx';
import FeedbackReport  from './components/FeedbackReport.jsx';
import HRDashboard from './hr/HRDashboard.jsx';

function getApplyJdId() {
  const match = window.location.pathname.match(/^\/apply\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isJobsPath() {
  return window.location.pathname === '/jobs';
}

function AppInner() {
  const { user, logout, loading } = useAuth();
  const applyJdId = getApplyJdId();
  const [screen, setScreen] = useState(applyJdId ? 'apply' : isJobsPath() ? 'jobs' : 'select');
  const [selectedJdId, setSelectedJdId] = useState(applyJdId);
  const [interviewConfig, setInterviewConfig] = useState(null);
  const [streams, setStreams] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [startError, setStartError] = useState('');

  const stopStreams = (activeStreams) => {
    Object.values(activeStreams || {}).forEach((stream) => {
      stream?.getTracks?.().forEach((track) => track.stop());
    });
  };

  const handleStart = (config) => {
    setStartError('');
    setInterviewConfig(config);
    setScreen('permissions');
  };

  const handleStartFailure = ({ error, config }) => {
    stopStreams(streams);
    setStreams(null);
    setInterviewConfig(config);
    setStartError(error);
    setScreen(config?.interviewType === 'jd_based' ? 'apply' : 'select');
  };

  const goHome = () => {
    window.history.pushState({}, '', '/');
    setSelectedJdId(null);
    setScreen('select');
  };

  const goBrowseJobs = () => {
    window.history.pushState({}, '', '/jobs');
    setScreen('jobs');
  };

  const handleSelectJob = (jdId) => {
    window.history.pushState({}, '', `/apply/${encodeURIComponent(jdId)}`);
    setSelectedJdId(jdId);
    setScreen('apply');
  };

  const handleRetry = () => {
    stopStreams(streams);
    setInterviewConfig(null);
    setStreams(null);
    setSessionData(null);
    setStartError('');
    setScreen(applyJdId ? 'apply' : 'select');
  };

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#080808'}}><span style={{color:'#e8ff47',fontSize:24}}>◉</span></div>;

  if (!user) return <AuthPage onSuccess={(u) => { if (u.role === 'hr') window.location.href = '/hr'; }} />;

  if (user.role === 'hr') return <HRDashboard user={user} onLogout={logout} />;

  return (
    <div className="screen">
      {screen === 'apply' && (
        <button onClick={logout} style={{position:'fixed',top:16,right:16,zIndex:2,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',padding:'6px 14px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Sign out</button>
      )}
      {screen === 'select'      && <RoleSelector    onStart={handleStart} initialConfig={interviewConfig} onBrowseJobs={goBrowseJobs} onLogout={logout} />}
      {screen === 'jobs'        && <JobBoard onSelectJob={handleSelectJob} onHome={goHome} />}
      {screen === 'apply'       && <JDInterviewSetup jdId={selectedJdId} onStart={handleStart} onCancel={goBrowseJobs} initialError={startError} />}
      {screen === 'permissions' && <PermissionsGate onReady={(s) => { setStreams(s); setScreen('interview'); }} />}
      {screen === 'interview'   && <VoiceInterview  config={interviewConfig} streams={streams} onStartFailure={handleStartFailure} onFinish={(d) => { stopStreams(streams); setStreams(null); setSessionData(d); setScreen('report'); }} />}
      {screen === 'report'      && <FeedbackReport  sessionData={sessionData} report={sessionData?.report} onRetry={handleRetry} onHome={goHome} onBrowseJobs={goBrowseJobs} />}
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
