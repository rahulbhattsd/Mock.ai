import { useState } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './auth/useAuth.jsx';
import AuthPage        from './auth/AuthPage.jsx';
import RoleSelector    from './candidate/RoleSelector.jsx';
import PermissionsGate from './candidate/PermissionsGate.jsx';
import VoiceInterview  from './candidate/VoiceInterview.jsx';
import FeedbackReport  from './components/FeedbackReport.jsx';

function AppInner() {
  const { user, logout, loading } = useAuth();
  const [screen, setScreen] = useState('select');
  const [interviewConfig, setInterviewConfig] = useState(null);
  const [streams, setStreams] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#080808'}}><span style={{color:'#e8ff47',fontSize:24}}>◉</span></div>;

  if (!user) return <AuthPage onSuccess={(u) => { if (u.role === 'hr') window.location.href = '/hr'; }} />;

  return (
    <div className="screen">
      {screen !== 'interview' && (
  <button onClick={logout} style={{position:'fixed',top:16,right:16,zIndex:2,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',padding:'6px 14px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Sign out</button>
)}
      {screen === 'select'      && <RoleSelector    onStart={(c) => { setInterviewConfig(c); setScreen('permissions'); }} />}
      {screen === 'permissions' && <PermissionsGate onReady={(s) => { setStreams(s); setScreen('interview'); }} />}
      {screen === 'interview'   && <VoiceInterview  config={interviewConfig} streams={streams} onFinish={(d) => { setSessionData(d); setScreen('report'); }} />}
      {screen === 'report'      && <FeedbackReport  sessionData={sessionData} report={sessionData?.report} onRetry={() => { setInterviewConfig(null); setStreams(null); setSessionData(null); setScreen('select'); }} />}
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}

