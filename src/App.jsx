import React, { useState, useEffect } from 'react';
import './styles/globals.css';
import { useConversations } from './hooks/useConversations';
import { Sidebar }          from './components/sidebar/Sidebar';
import { ChatView }         from './components/chat/ChatView';
import { ProviderPanel }    from './components/settings/ProviderPanel';
import { McpPanel }         from './components/mcp/McpPanel';

export function App() {
  const { conversations, activeId, setActiveId, create, rename, remove } = useConversations();
  const activeConv = conversations.find(c => c.id === activeId) || null;
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [mcpIds, setMcpIds] = useState([]);
  const [rightTab, setRightTab] = useState('providers');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const chosenProvider = providers.find(p => p.id === providerId && !p.needsSetup);

  useEffect(() => {
    window.api.listProviders().then(list => {
      setProviders(list);
      setProviderId(previous => list.some(p => p.id === previous && !p.needsSetup)
        ? previous : (list.find(p => !p.needsSetup)?.id ?? ''));
    }).catch(error => console.error('Unable to load providers:', error));
  }, []);

  async function handleSaveProvider(p) {
    setActionError('');
    const saved = await window.api.saveProvider(p);
    const list = await window.api.listProviders();
    setProviders(list); setProviderId(saved.id); return saved;
  }
  async function handleDeleteProvider(id) {
    const result = await window.api.deleteProvider(id);
    if (result?.changed === false) throw new Error('Provider does not exist in the database.');
    const list = await window.api.listProviders();
    setProviders(list);
    setProviderId(previous => previous === id ? (list.find(p => !p.needsSetup)?.id ?? '') : previous);
  }
  async function handleCreate() {
    setActionError('');
    try {
      await create({ title: 'New chat', providerId: chosenProvider?.id ?? null, model: chosenProvider?.model ?? null });
    } catch (error) {
      setActionError(`Unable to create conversation: ${error.message}`);
      console.error('Create conversation failed:', error);
    }
  }

  async function handleDelete(id) {
    setActionError('');
    try { await remove(id); }
    catch (error) { setActionError(`Unable to delete conversation: ${error.message}`); console.error(error); }
  }
  async function handleRename(id, title) {
    setActionError('');
    try { await rename(id, title); }
    catch (error) { setActionError(`Unable to rename conversation: ${error.message}`); console.error(error); }
  }

  return (
    <div style={{ display:'flex', width:'100%', height:'100vh', overflow:'hidden', position:'relative' }}>
      <Sidebar conversations={conversations} activeId={activeId} onSelect={setActiveId}
        onCreate={handleCreate} onRename={handleRename} onDelete={handleDelete} />

      {actionError && <div role="alert" className="action-error">{actionError}<button onClick={() => setActionError('')} aria-label="Dismiss error">✕</button></div>}

      <ChatView conversation={activeConv} providerId={chosenProvider?.id ?? null} selectedModel={chosenProvider?.model ?? null} systemPrompt={systemPrompt}
        mcpServerIds={mcpIds} settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen(v => !v)}
        onOpenProviders={() => { setRightTab('providers'); setSettingsOpen(true); }} />

      {settingsOpen && <aside className="settings-drawer">
        <div className="settings-tabs">
          {['providers','mcp','system'].map(id => <button key={id} className={rightTab === id ? 'active' : ''}
            onClick={() => setRightTab(id)}>{id === 'mcp' ? 'MCP' : id === 'system' ? 'SYSTEM' : 'PROVIDERS'}</button>)}
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {rightTab === 'providers' && <ProviderPanel providers={providers} selectedId={providerId}
            onSelect={setProviderId} onSave={handleSaveProvider} onDelete={handleDeleteProvider} />}
          {rightTab === 'mcp' && <McpPanel selectedIds={mcpIds}
            onToggle={id => setMcpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />}
          {rightTab === 'system' && <div style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>System prompt</div>
            <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>Injected at the start of every conversation. When MCP context is active it's prepended before this prompt automatically.</div>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              style={{ background:'var(--panel-2)', border:'1px solid var(--border)', borderRadius:0, padding:'10px 12px', color:'var(--text)', fontSize:13, minHeight:200, resize:'vertical', lineHeight:1.6, outline:'none' }} />
          </div>}
        </div>
      </aside>}
    </div>
  );
}
