import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { todayISO } from '../services/format.js';

// The browser's built-in speech recognition (Chrome / Edge). No library or API key needed.
const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const SUGGESTIONS = ['Total outstanding', 'Who is overdue?', 'Top customers who owe', 'Recent transactions'];

const WELCOME = {
  role: 'bot',
  text: 'Hi! I am your Khata Copilot 👋\nAsk about balances, or say things like "Ramesh paid 300". Tap the 🎤 to speak.',
};

export default function CopilotPanel({ onDataChanged }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const recogRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Stop the microphone if the panel is removed
  useEffect(() => () => recogRef.current?.abort?.(), []);

  const send = async (text) => {
    const msg = text.trim();
    if (!msg) return;
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setInput('');
    setBusy(true);
    try {
      const data = await api.askCopilot(msg);
      setMessages((m) => [...m, { role: 'bot', ...data, text: data.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'bot', text: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const updateMessage = (index, patch) =>
    setMessages((m) => m.map((x, i) => (i === index ? { ...x, ...patch } : x)));

  // Runs a confirmed action through the normal, validated API
  const confirmAction = async (index, action) => {
    updateMessage(index, { status: 'working' });
    try {
      if (action.kind === 'add_transaction') {
        await api.addTransaction(action.customer_id, {
          type: action.type,
          amount: action.amount,
          note: action.note,
          entry_date: todayISO(),
          due_date: action.due_date,
        });
        updateMessage(index, { status: 'done', statusText: '✅ Entry saved.' });
      } else if (action.kind === 'reverse') {
        await api.reverseTransaction(action.transaction_id, 'Reversed via Copilot');
        updateMessage(index, { status: 'done', statusText: '✅ Transaction reversed.' });
      }
      onDataChanged();
    } catch (err) {
      updateMessage(index, { status: 'error', statusText: '❌ ' + err.message });
    }
  };

  const toggleMic = () => {
    if (!SpeechRecognition) {
      setMicError('Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    setMicError('');
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
      if (e.results[e.results.length - 1].isFinal) finalText = t;
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicError('Microphone is blocked. Click the lock icon in the address bar and allow the microphone.');
      } else if (e.error === 'no-speech') {
        setMicError("I didn't hear anything. Tap the mic and try again.");
      } else if (e.error === 'network') {
        setMicError('Voice input needs an internet connection.');
      } else if (e.error !== 'aborted') {
        setMicError('Voice error: ' + e.error);
      }
    };
    rec.onend = () => {
      setListening(false);
      if (finalText) send(finalText);
    };

    recogRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      setMicError('Could not start the microphone. Please try again.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!busy) send(input);
  };

  if (!open) {
    return (
      <button className="copilot-fab" onClick={() => setOpen(true)} aria-label="Open Khata Copilot">
        🤖 Copilot
      </button>
    );
  }

  return (
    <div className="copilot-panel" role="dialog" aria-label="Khata Copilot">
      <div className="copilot-head">
        <div>
          <strong>🤖 Khata Copilot</strong>
          <small>Ask, speak, or record entries</small>
        </div>
        <button className="copilot-close" onClick={() => setOpen(false)} aria-label="Close Copilot">×</button>
      </div>

      <div className="copilot-body">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'msg-user' : 'msg-bot'} ${m.error ? 'msg-error' : ''}`}>
            {m.text}

            {m.pending_action && !m.status && (
              <div className="msg-actions">
                <button className="btn btn-primary btn-sm" onClick={() => confirmAction(i, m.pending_action)}>Confirm</button>
                <button className="btn btn-secondary btn-sm" onClick={() => updateMessage(i, { status: 'cancelled', statusText: 'Cancelled.' })}>
                  Cancel
                </button>
              </div>
            )}
            {m.status === 'working' && <div className="msg-status">Saving...</div>}
            {m.statusText && <div className="msg-status">{m.statusText}</div>}

            {m.link && (
              <div className="msg-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigate(m.link);
                    setOpen(false);
                  }}
                >
                  Open
                </button>
              </div>
            )}
            {m.whatsapp_url && (
              <div className="msg-actions">
                <a className="btn btn-primary btn-sm" href={m.whatsapp_url} target="_blank" rel="noreferrer">
                  Open WhatsApp
                </a>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg msg-bot">Thinking...</div>}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      {micError && <div className="mic-note" role="alert">{micError}</div>}

      <form className="copilot-form" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`mic-btn ${listening ? 'listening' : ''}`}
          onClick={toggleMic}
          aria-label={listening ? 'Stop listening' : 'Speak'}
          title={listening ? 'Tap to stop' : 'Tap and speak'}
        >
          🎤
        </button>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? 'Listening...' : 'Type or tap the mic'}
          aria-label="Message to Copilot"
          maxLength={300}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}