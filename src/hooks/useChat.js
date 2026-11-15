import { useState, useEffect, useCallback, useRef } from 'react';

export function useChat(conversationId) {
  const [messages, setMessages]   = useState([]);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy]           = useState(false);
  const streamRef  = useRef('');
  const cleanupRef = useRef(null);
  const busyRef = useRef(false);
  const activeConversationRef = useRef(conversationId);
  activeConversationRef.current = conversationId;

  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    let active = true;
    window.api.listMessages(conversationId)
      .then(list => { if (active && activeConversationRef.current === conversationId) setMessages(list); })
      .catch(error => console.error('Unable to load conversation messages:', error));
    streamRef.current = '';
    setStreaming('');
    return () => { active = false; };
  }, [conversationId]);

  useEffect(() => {
    if (cleanupRef.current) cleanupRef.current();
    const unsub = window.api.onChatToken(({ conversationId: cid, token }) => {
      if (cid !== conversationId) return;
      streamRef.current += token;
      setStreaming(streamRef.current);
    });
    cleanupRef.current = unsub;
    return () => { if (unsub) unsub(); };
  }, [conversationId]);

  const send = useCallback(async ({ input, providerId, systemPrompt = '', mcpServerIds = [], portedContext = null }) => {
    const text = typeof input === 'string' ? input.trim() : '';
    if (!conversationId || !text || !providerId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    streamRef.current = '';
    setStreaming('');

    try {
      const userMsg = await window.api.saveMessage({ conversation_id: conversationId, role: 'user', content: text });
      if (activeConversationRef.current === conversationId) setMessages(prev => [...prev, userMsg]);

      const res = await window.api.sendChat({ conversationId, input: text, providerId, systemPrompt, mcpServerIds, portedContext });
      const assistantContent = res?.ok
        ? res.output
        : `⚠️ ${res?.error || 'The request failed. Please try again.'}`;
      const aMsg = await window.api.saveMessage({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
        tokens_in: res?.ok ? res.tokensIn : 0,
        tokens_out: res?.ok ? res.tokensOut : 0,
      });
      if (activeConversationRef.current === conversationId) setMessages(prev => [...prev, aMsg]);
      return res;
    } catch (err) {
      const message = err?.message || 'An unexpected error occurred.';
      try {
        const eMsg = await window.api.saveMessage({
          conversation_id: conversationId,
          role: 'assistant',
          content: `⚠️ ${message}`,
        });
        if (activeConversationRef.current === conversationId) setMessages(prev => [...prev, eMsg]);
      } catch (saveError) {
        console.error('Unable to persist chat error:', saveError);
      }
      return { ok: false, error: message };
    } finally {
      streamRef.current = '';
      setStreaming('');
      busyRef.current = false;
      setBusy(false);
    }
  }, [conversationId]);

  return { messages, streaming, busy, send };
}
