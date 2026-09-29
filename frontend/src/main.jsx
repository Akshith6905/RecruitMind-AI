import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.jsx';
import './ui/styles.css';
import './ui/pipeline.css';
import './ui/upload-status.css';

class AppBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('RecruitMind render failed', error); }
  render() {
    if (this.state.error) return <main style={{maxWidth:560,margin:'12vh auto',padding:28,background:'#fff',border:'1px solid #e9ebef',borderRadius:12,fontFamily:'system-ui'}}>
      <h1 style={{fontSize:20}}>RecruitMind hit a display error</h1>
      <p style={{color:'#707887'}}>The preview loaded, but this error stopped the screen from rendering:</p>
      <pre style={{whiteSpace:'pre-wrap',color:'#9b3342',fontSize:12}}>{String(this.state.error?.stack || this.state.error)}</pre>
    </main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<AppBoundary><App /></AppBoundary>);
