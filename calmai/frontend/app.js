const API_BASE = "http://127.0.0.1:8000";
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("chat-input");
const formEl = document.getElementById("chat-form");
const btnReset = document.getElementById("btn-reset");
const btnMic = document.getElementById("voiceBtn");
const btnNew = document.getElementById("new-chat-btn");

// ------------------ Sessions ------------------
// sessions: array of {id, createdAt, messages: [{role,content,time}]}
function loadSessions(){
  try{
    return JSON.parse(localStorage.getItem('calmai_sessions') || '[]');
  } catch(e){ return []; }
}

function saveSessions(sessions){
  localStorage.setItem('calmai_sessions', JSON.stringify(sessions.slice(-50)));
}

function createSession(){
  const sessions = loadSessions();
  const session = { id: String(Date.now()), createdAt: new Date().toISOString(), messages: [] };
  sessions.push(session);
  saveSessions(sessions);
  localStorage.setItem('calmai_current_session', session.id);
  return session;
}

// ------------------ Settings ------------------
function loadSettings(){
  try{ return JSON.parse(localStorage.getItem('calmai_settings') || '{}'); } catch(e){ return {}; }
}

function saveSettings(s){
  localStorage.setItem('calmai_settings', JSON.stringify(s));
}

// apply theme from settings
const settings = loadSettings();
function applyTheme(value){
  if(value === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
applyTheme(settings.theme);

// Listen for settings changes in other tabs and apply theme live
window.addEventListener('storage', (e) => {
  if(e.key === 'calmai_settings'){
    try{
      const s = JSON.parse(e.newValue || '{}');
      applyTheme(s.theme);
    }catch(err){ /* ignore */ }
  }
});


function getCurrentSession(){
  const sessions = loadSessions();
  const currentId = localStorage.getItem('calmai_current_session');
  let s = sessions.find(x=> x.id === currentId);
  if(!s){
    s = sessions[sessions.length - 1] || createSession();
  }
  return s;
}

function updateCurrentSession(session){
  const sessions = loadSessions();
  const idx = sessions.findIndex(s=> s.id === session.id);
  if(idx >= 0) sessions[idx] = session; else sessions.push(session);
  saveSessions(sessions);
}

function timeNow(){
  return new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
}

function addMsg(role, content){
  const card = document.createElement("div");
  card.className = `msg ${role === "user" ? "you" : "bot"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "role";
  meta.textContent = role === "user" ? "You" : "ChartMind AI";

  const text = document.createElement("div");
  text.innerText = content;

  const t = document.createElement("div");
  t.className = "time";
  t.textContent = timeNow();

  bubble.appendChild(meta);
  bubble.appendChild(text);

  card.appendChild(bubble);
  card.appendChild(t);

  chatEl.appendChild(card);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Loader
function setLoading(on){
  if(on){
    addMsg("assistant", "…thinking");
  } else {
    const list = chatEl.querySelectorAll(".msg.bot .bubble div:nth-child(2)");
    const last = list[list.length - 1];
    if(last?.innerText === "…thinking"){
      last.parentElement.parentElement.remove();
    }
  }
}

// Send message (saves into current session.messages)
async function sendMessage(text){
  addMsg("user", text);
  const session = getCurrentSession();
  session.messages.push({role:"user", content:text, time: new Date().toISOString()});
  updateCurrentSession(session);

  setLoading(true);

  try{
    const res = await fetch(`${API_BASE}/chat`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:text, history: session.messages, settings: loadSettings()})
    });

    const data = await res.json();
    setLoading(false);

    if(data.reply){
      addMsg("assistant", data.reply);
      playVoice(data.reply);
      session.messages.push({role:"assistant", content:data.reply, time: new Date().toISOString()});
      updateCurrentSession(session);
    }
  } catch(err){
    setLoading(false);
    addMsg("assistant", "Connection error. Is your backend running?");
  }
}

// ------------------ Text to Speech ------------------
async function playVoice(text){
  if('speechSynthesis' in window){
    try{
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 1;
      utter.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      return;
    } catch(err){
      console.error('SpeechSynthesis error:', err);
    }
  }

  try{
    const res = await fetch(`${API_BASE}/tts`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text})
    });

    const contentType = res.headers.get('content-type') || '';
    if(contentType.includes('application/json')){
      const data = await res.json();
      if(data.text && 'speechSynthesis' in window){
        const utter = new SpeechSynthesisUtterance(data.text);
        utter.lang = 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
    } else {
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play().catch(e=> console.error('Audio playback error:', e));
    }
  } catch(err){
    console.error("TTS fallback error:", err);
  }
}

// ------------------ Input Form ------------------
formEl.addEventListener("submit", (e)=>{
  e.preventDefault();
  const text = inputEl.value.trim();
  if(!text) return;
  inputEl.value = "";
  sendMessage(text);
});

// ------------------ New Chat ------------------
if(btnNew){
  btnNew.addEventListener('click', ()=>{
    // create a new empty session and clear UI
    const s = createSession();
    chatEl.innerHTML = '';
    addMsg('assistant', 'New chat started');
  });
}

// ------------------ Reset Chat (clear current session messages) ------------------
btnReset.addEventListener("click", ()=>{
  const session = getCurrentSession();
  session.messages = [];
  updateCurrentSession(session);
  chatEl.innerHTML = "";
  addMsg("assistant", "Chat cleared");
});

// ------------------ Voice Recognition ------------------
window.SpeechRecognition = 
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;
let isListening = false;

if(window.SpeechRecognition){
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;

  btnMic.addEventListener("click", ()=>{
    if(!isListening){
      isListening = true;
      btnMic.textContent = "🛑";
      recognition.start();
    } else {
      isListening = false;
      btnMic.textContent = "🎤";
      recognition.stop();
    }
  });

  recognition.onresult = (event)=>{
    const text = event.results[event.results.length - 1][0].transcript;
    inputEl.value = text;
    formEl.dispatchEvent(new Event("submit"));
  };

  recognition.onend = ()=> {
    if(isListening) recognition.start();
  };
}

// ------------------ Initial Load / Restore ------------------
// If a specific session id was selected from `history.html`, restore that session.
const selectedSessionId = localStorage.getItem('calmai_selected_session');
if(selectedSessionId){
  localStorage.removeItem('calmai_selected_session');
  const sessions = loadSessions();
  const session = sessions.find(s=> s.id === selectedSessionId);
  if(session){
    localStorage.setItem('calmai_current_session', session.id);
    chatEl.innerHTML = '';
    session.messages.forEach(m => addMsg(m.role, m.content));
  }
} else {
  // load the current session (or create one) and render its last messages
  const session = getCurrentSession();
  chatEl.innerHTML = '';
  session.messages.slice(-12).forEach(m => addMsg(m.role, m.content));
}
