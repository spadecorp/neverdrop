import React, { useState } from 'react';

export function Sidebar({ conversations, activeId, onSelect, onCreate, onRename, onDelete }) {
  const [search, setSearch] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const filtered = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside style={{ width:270, minWidth:270, background:'var(--panel)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', height:'100%' }}>
      <div className="sidebar-brand">
        <div className="brand-lockup">
          <div className="brand-copy">
            <img className="brand-logo" src={`${import.meta.env.BASE_URL}spade-wordmark.png`} alt="SPaDe Corp" />
            <div className="brand-caption">ENTERPRISE WORKSPACE</div>
          </div>
          <button className="new-chat-button" onClick={onCreate}>＋ New chat</button>
        </div>
        <div className="current-product">
          <div className="product-icon">N</div>
          <div className="current-product-copy">
            <strong>NeverDrop</strong>
            <span>Enterprise · AI workspace</span>
          </div>
          <span className="current-pill">ACTIVE</span>
        </div>
        <button className="products-toggle" onClick={() => setShowProducts(v => !v)} aria-expanded={showProducts}>
          <span><span className="products-toggle-dot" /> Product family</span>
          <span className="products-chevron">{showProducts ? '⌃' : '⌄'}</span>
        </button>
        {showProducts && (
          <div className="product-family">
            <div className="product-group">
              <span className="product-group-label">TRADING</span>
              <span>Auto-trading bot <em>Planned</em></span>
              <span>Sector rotation <em>Planned</em></span>
              <span>End-of-day scans <em>Planned</em></span>
            </div>
            <div className="product-group">
              <span className="product-group-label">ENTERPRISE</span>
              <span className="product-current">NeverDrop AI <em>Current app</em></span>
              <span>Availability dashboard <em>Planned</em></span>
            </div>
            <div className="product-group">
              <span className="product-group-label">DOMESTIC</span>
              <span>Home dashboard <em>Planned</em></span>
              <span>Location reminders <em>Planned</em></span>
              <span>Library watchlist <em>Planned</em></span>
              <span>Smart Grocer <em className="available">Available</em></span>
            </div>
            <a className="explore-products" href="https://spade-corp.com/" target="_blank" rel="noreferrer">Explore SPaDe Corp <span>↗</span></a>
          </div>
        )}
        <div className="sidebar-section-label">YOUR WORKSPACE</div>
        <input className="chat-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" />
      </div>

      <div className="conv-list">
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', color:'var(--faint)', fontSize:13, paddingTop:40 }}>
            {search ? 'No matching chats' : 'No conversations yet'}
          </div>
        )}
        {filtered.map(c => (
          <ConvItem key={c.id} c={c} active={activeId === c.id}
            onSelect={() => onSelect(c.id)}
            onRename={() => { setRenameTitle(c.title); setDialog({ type: 'rename', id: c.id, title: c.title }); }}
            onDelete={() => setDialog({ type: 'delete', id: c.id, title: c.title })} />
        ))}
      </div>
      {dialog && <div className="nd-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setDialog(null); }}>
        <div className="nd-modal" role="dialog" aria-modal="true" aria-label={dialog.type === 'delete' ? 'Delete conversation' : 'Rename conversation'}>
          <h3>{dialog.type === 'delete' ? 'Delete conversation?' : 'Rename conversation'}</h3>
          {dialog.type === 'delete' ? <p>Delete “{dialog.title}” and all its messages? This cannot be undone.</p> :
            <input autoFocus aria-label="Conversation title" value={renameTitle} onChange={e => setRenameTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && renameTitle.trim()) { onRename(dialog.id, renameTitle.trim()); setDialog(null); } if (e.key === 'Escape') setDialog(null); }} />}
          <div className="nd-modal-actions">
            <button className="spade-button" onClick={() => setDialog(null)}>Cancel</button>
            <button className="spade-button primary" disabled={dialog.type === 'rename' && !renameTitle.trim()} onClick={() => {
              if (dialog.type === 'delete') onDelete(dialog.id);
              else if (renameTitle.trim()) onRename(dialog.id, renameTitle.trim());
              setDialog(null);
            }}>{dialog.type === 'delete' ? 'Delete' : 'Save'}</button>
          </div>
        </div>
      </div>}
    </aside>
  );
}

function ConvItem({ c, active, onSelect, onRename, onDelete }) {
  const [hover, setHover] = useState(false);
  return (
    <div className={`conv-item${active ? ' active' : ''}`} onClick={onSelect} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight: active ? 700 : 500, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{c.model || '—'} · {c.message_count || 0} msgs</div>
      </div>
      {(hover || active) && (
        <div style={{ display:'flex', gap:4, marginLeft:6, flexShrink:0 }}>
          <button onClick={e => { e.stopPropagation(); onRename(); }} style={{ fontSize:12, padding:'2px 5px', borderRadius:4, color:'var(--muted)', background:'var(--panel-3)' }}>✎</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ fontSize:12, padding:'2px 5px', borderRadius:4, color:'var(--error)', background:'var(--panel-3)' }}>✕</button>
        </div>
      )}
    </div>
  );
}
