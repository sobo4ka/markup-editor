import React, { useState, useEffect, useRef } from "react";
import { parseMarkdown } from "./markdownUtils";

const CHALLENGES = [
  { title: "Table Challenge", prompt: "Write a table comparing 3 programming languages (name, type, use case)." },
  { title: "Code Block", prompt: "Write a fenced code block in any language with syntax highlighting." },
  { title: "Document Structure", prompt: "Create a mini article with H1, two H2s, and at least one H3." },
  { title: "Links & Images", prompt: "Add a hyperlink and an image with proper alt text." },
  { title: "Nested Lists", prompt: "Create a nested unordered list with at least 3 levels deep." },
  { title: "Blockquote", prompt: "Add a meaningful blockquote followed by an attribution." },
  { title: "Task List", prompt: "Write a task list with at least 5 items, some checked." },
];

const CHEAT_SHEET = [
  { cat: "Headings", items: [{ syntax: "# H1", desc: "Heading level 1" }, { syntax: "## H2", desc: "Heading level 2" }, { syntax: "### H3", desc: "Heading level 3" }] },
  { cat: "Emphasis", items: [{ syntax: "**bold**", desc: "Bold text" }, { syntax: "*italic*", desc: "Italic text" }, { syntax: "~~strike~~", desc: "Strikethrough" }] },
  { cat: "Lists", items: [{ syntax: "- item", desc: "Unordered list" }, { syntax: "1. item", desc: "Ordered list" }, { syntax: "- [ ] task", desc: "Task list" }, { syntax: "- [x] done", desc: "Checked task" }] },
  { cat: "Links & Images", items: [{ syntax: "[text](url)", desc: "Hyperlink" }, { syntax: "![alt](url)", desc: "Image" }] },
  { cat: "Code", items: [{ syntax: "`inline`", desc: "Inline code" }, { syntax: "``` lang", desc: "Fenced code block" }] },
  { cat: "Tables", items: [{ syntax: "| A | B |", desc: "Table column" }, { syntax: "|---|---|", desc: "Table separator" }] },
  { cat: "Other", items: [{ syntax: "> quote", desc: "Blockquote" }, { syntax: "---", desc: "Horizontal rule" }] },
];

const TOOLBAR = [
  { label: "B", title: "Bold", wrap: ["**", "**"], sample: "bold text" },
  { label: "I", title: "Italic", wrap: ["*", "*"], sample: "italic text" },
  { label: "~~", title: "Strikethrough", wrap: ["~~", "~~"], sample: "strikethrough" },
  { label: "H1", title: "Heading 1", prefix: "# " },
  { label: "H2", title: "Heading 2", prefix: "## " },
  { label: "H3", title: "Heading 3", prefix: "### " },
  { label: "Link", title: "Link", wrap: ["[", "](url)"], sample: "link text" },
  { label: "Img", title: "Image", wrap: ["![", "](url)"], sample: "alt text" },
  { label: "Code", title: "Inline Code", wrap: ["`", "`"], sample: "code" },
  { label: "Block", title: "Code Block", block: "```js\ncode here\n```" },
  { label: "Quote", title: "Blockquote", prefix: "> " },
  { label: "---", title: "Horizontal Rule", block: "\n---\n" },
  { label: "- List", title: "Unordered List", prefix: "- " },
  { label: "1. List", title: "Ordered List", prefix: "1. " },
  { label: "Task", title: "Task List", prefix: "- [ ] " },
];

const INITIAL = "# Welcome to Viks markup editor\n\nStart writing Markdown here and see it rendered live on the right! \n\n## Features to try\n- **Live preview** as you type\n- Syntax cheat sheet panel\n- Document outline in the left panel\n- Validation hints below the editor\n- Click any element in the preview to jump to it in the editor\n- Select text and press Concise, Bullets, or Shorten\n\n### Quick example\n\n```js\nconst greet = function(name) { return 'Hello ' + name; };\nconsole.log(greet('World'));\n```\n\n| Feature | Status |\n|---------|--------|\n| Live preview | Done |\n| Cheat sheet | Done |\n| Click-to-navigate | Done |\n| AI tools | Done |\n\n> The best way to learn Markdown is to write a lot of it.\n\nHappy writing!\n";

function extractHeadings(md: string) {
  return md.split("\n").reduce(function(acc: {level: number, text: string, line: number}[], line: string, i: number) {
    const m = line.match(/^(#{1,6}) (.+)/);
    if (m) acc.push({ level: m[1].length, text: m[2], line: i });
    return acc;
  }, []);
}

function validateDoc(md: string) {
  const hints = [];
  const h1s = (md.match(/^# .+/gm) || []).length;
  if (h1s === 0) hints.push({ type: "warn", msg: "No H1 heading - best practice is one title per document." });
  if (h1s > 1) hints.push({ type: "warn", msg: "You have " + h1s + " H1 headings - best practice is exactly one." });
  if (/!\[\]\(/.test(md)) hints.push({ type: "warn", msg: "Image(s) missing alt text." });
  if (md.split("\n").filter(function(l: string) { return l.length > 120; }).length > 2) hints.push({ type: "tip", msg: "Several lines exceed 120 chars - consider breaking them up." });
  return hints;
}

function getGeminiKey() {
  let key = localStorage.getItem("gemini_api_key");
  if (!key) {
    key = window.prompt("Enter your Gemini API key (free at aistudio.google.com):");
    if (key) localStorage.setItem("gemini_api_key", key.trim());
  }
  return key ? key.trim() : null;
}

function callClaude(prompt: string) {
  const key = getGeminiKey();
  if (!key) return Promise.reject(new Error("No API key provided."));
  return fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + key, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  }).then(function(res) {
    return res.json();
  }).then(function(data) {
    if (data.error) throw new Error(data.error.message);
    return (data.content || []).map(function(b: { text?: string }) { return b.text || ""; }).join("").trim();
  });
}

export default function App() {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const savedSel = useRef<{start:number,end:number}|null>(null);

  const u0  = useState(INITIAL);   const md = u0[0];           const setMd = u0[1];
  const u1  = useState(true);      const dark = u1[0];          const setDark = u1[1];
  const u2  = useState(false);     const showCheat = u2[0];     const setShowCheat = u2[1];
  const u3  = useState(true);      const showOutline = u3[0];   const setShowOutline = u3[1];
  const u4  = useState(true);      const showHints = u4[0];     const setShowHints = u4[1];
  const u5  = useState(true);      const showChallenge = u5[0]; const setShowChallenge = u5[1];
  const u6  = useState(0);         const chalIdx = u6[0];       const setChalIdx = u6[1];
  const u7  = useState<{id:number,preview:string,date:string,content:string}[]>([]);        const history = u7[0];       const setHistory = u7[1];
  const u8  = useState("outline"); const panel = u8[0];         const setPanel = u8[1];
  const u9  = useState(false);     const saved = u9[0];         const setSaved = u9[1];
  const u10 = useState(false);     const confirmNew = u10[0];   const setConfirmNew = u10[1];
  const u11 = useState(false);     const concising = u11[0];    const setConcising = u11[1];
  const u12 = useState<string | null>(null);      const conciseErr = u12[0];   const setConciseErr = u12[1];
  const u13 = useState(false);     const bulleting = u13[0];    const setBulleting = u13[1];
  const u14 = useState<string | null>(null);      const bulletErr = u14[0];    const setBulletErr = u14[1];
  const u15 = useState(50);        const shortenPct = u15[0];   const setShortenPct = u15[1];
  const u16 = useState(false);     const shortening = u16[0];   const setShortening = u16[1];
  const u17 = useState<string | null>(null);      const shortenErr = u17[0];   const setShortenErr = u17[1];

useEffect(function() {
  const saved = localStorage.getItem("md_history");
  if (saved) setHistory(JSON.parse(saved));
}, []);

  const rendered  = parseMarkdown(md);
  const headings  = extractHeadings(md);
  const hints     = validateDoc(md);
  const words     = md.trim() ? md.trim().split(/\s+/).length : 0;
  const readTime  = Math.max(1, Math.ceil(words / 200));

  const bg       = dark ? "#0f1117" : "#f8f9fa";
  const surface  = dark ? "#1a1d27" : "#ffffff";
  const surface2 = dark ? "#22263a" : "#f0f2f5";
  const border   = dark ? "#2e3250" : "#d0d7e0";
  const text     = dark ? "#e2e8f0" : "#1a202c";
  const muted    = dark ? "#718096" : "#718096";
  const accent   = "#6c63ff";

  function saveSelection() {
    const ta = taRef.current;
    if (ta) savedSel.current = { start: ta.selectionStart, end: ta.selectionEnd };
  }

  function syncPreviewToLine(lineNum: number) {
    const preview = previewRef.current;
    if (!preview || lineNum == null) return;
    const all = preview.querySelectorAll("[data-line]");
    if (!all.length) return;
    let best = null, bestDiff = Infinity;
    for (let i = 0; i < all.length; i++) {
      const dl = parseInt(all[i].getAttribute("data-line") ?? "0", 10);
      const diff = Math.abs(dl - lineNum);
      if (diff < bestDiff) { bestDiff = diff; best = all[i]; }
    }
    if (best) {
      preview.scrollTop = (best as HTMLElement).offsetTop - preview.clientHeight / 3;
    }
  }

  function jumpToLine(lineNum: number) {
    const ta = taRef.current;
    if (!ta || lineNum == null) return;
    const lines = md.split("\n");
    const pos = lines.slice(0, lineNum).reduce(function(a, l) { return a + l.length + 1; }, 0);
    ta.focus();
    ta.setSelectionRange(pos, pos + (lines[lineNum] || "").length);
    // Use same getBoundingClientRect approach for accuracy
    // Temporarily set scrollTop to 0, measure, then restore isn't needed —
    // instead use a range-based measurement via a hidden mirror with exact styles
    const cs = window.getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.7 || 24;
    const paddingLeft = parseFloat(cs.paddingLeft) || 16;
    const paddingRight = parseFloat(cs.paddingRight) || 16;
    const availWidth = ta.clientWidth - paddingLeft - paddingRight;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    let totalWrapped = 0;
    for (let li = 0; li < lineNum; li++) {
      const lineText = lines[li];
      if (lineText === "") { totalWrapped += 1; continue; }
      const w = ctx.measureText(lineText).width;
      totalWrapped += Math.max(1, Math.ceil(w / availWidth));
    }
    ta.scrollTop = totalWrapped * lh - ta.clientHeight / 3;
    syncPreviewToLine(lineNum);
  }

  function handleEditorClick() {
    saveSelection();
    setTimeout(function() {
      const ta = taRef.current;
      if (!ta) return;
      const lineNum = md.slice(0, ta.selectionStart).split("\n").length - 1;
      syncPreviewToLine(lineNum);
    }, 10);
  }

  function handleEditorKeyUp() {
    saveSelection();
    setTimeout(function() {
      const ta = taRef.current;
      if (!ta) return;
      const lineNum = md.slice(0, ta.selectionStart).split("\n").length - 1;
      syncPreviewToLine(lineNum);
    }, 10);
  }

  function handlePreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (el.dataset && el.dataset.line !== undefined) {
        jumpToLine(parseInt(el.dataset.line, 10));
        return;
      }
      el = el.parentElement;
    }
  }

  function applyToolbar(item: typeof TOOLBAR[number]) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = md.slice(start, end);
    let newText = md, cursor = start;
    if (item.block) {
      newText = md.slice(0, start) + item.block + md.slice(end);
      cursor = start + item.block.length;
    } else if (item.prefix) {
      const lineStart = md.lastIndexOf("\n", start - 1) + 1;
      newText = md.slice(0, lineStart) + item.prefix + md.slice(lineStart);
      cursor = start + item.prefix.length;
    } else if (item.wrap) {
      const content = sel || item.sample;
      newText = md.slice(0, start) + item.wrap[0] + content + item.wrap[1] + md.slice(end);
      cursor = start + item.wrap[0].length + content.length + item.wrap[1].length;
    }
    setMd(newText);
    setTimeout(function() { if (ta) { ta.focus(); ta.setSelectionRange(cursor, cursor); } }, 0);
  }

  function getSelection() {
    const ta = taRef.current;
    let sel = savedSel.current;
    if (!sel || sel.start === sel.end) sel = ta ? { start: ta.selectionStart, end: ta.selectionEnd } : null;
    return sel;
  }

  function replaceSelection(sel: {start: number, end: number}, replacement: string) {
    const ta = taRef.current;
    setMd(md.slice(0, sel.start) + replacement + md.slice(sel.end));
    setTimeout(function() {
      if (ta) { ta.focus(); ta.setSelectionRange(sel.start, sel.start + replacement.length); }
    }, 0);
  }

  function handleConcise() {
    const sel = getSelection();
    if (!sel || sel.start === sel.end) { setConciseErr("Select some text first."); setTimeout(function() { setConciseErr(null); }, 3000); return; }
    const sel2 = sel;
    const selected = md.slice(sel2.start, sel2.end).trim();
    setConcising(true); setConciseErr(null);
    callClaude("Rewrite the following text to be concise and clear. Keep the original style. Preserve bullets and tables if present. Remove only fluff and repetitions. Return only the rewritten text.\n\n" + selected)
      .then(function(r) { if (r) replaceSelection(sel2, r); })
      .catch(function(e) { setConciseErr(e.message); setTimeout(function() { setConciseErr(null); }, 6000); })
      .then(function() { setConcising(false); });
  }

  function handleBullets() {
    const sel = getSelection();
    if (!sel || sel.start === sel.end) { setBulletErr("Select some text first."); setTimeout(function() { setBulletErr(null); }, 3000); return; }
    const sel2 = sel;
    const selected = md.slice(sel2.start, sel2.end).trim();
    setBulleting(true); setBulletErr(null);
    callClaude("Reformat the following text so each sentence is a separate bullet point using a dash (-). Do not add, remove, or change words. Every bullet must be at least 4 words. Return only the bullet points.\n\n" + selected)
      .then(function(r) { if (r) replaceSelection(sel2, r); })
      .catch(function(e) { setBulletErr(e.message); setTimeout(function() { setBulletErr(null); }, 6000); })
      .then(function() { setBulleting(false); });
  }

  function handleShorten() {
    const sel = getSelection();
    if (!sel || sel.start === sel.end) { setShortenErr("Select some text first."); setTimeout(function() { setShortenErr(null); }, 3000); return; }
    const sel2 = sel;
    const selected = md.slice(sel2.start, sel2.end).trim();
    const pct = shortenPct;
    if (isNaN(pct) || pct < 1 || pct > 99) { setShortenErr("Enter a % between 1 and 99."); setTimeout(function() { setShortenErr(null); }, 3000); return; }
    const targetWords = Math.round(selected.split(/\s+/).filter(Boolean).length * (1 - pct / 100));
    setShortening(true); setShortenErr(null);
    callClaude("Summarise the following text by shortening it by approximately " + pct + "% (target: ~" + targetWords + " words). Keep all important details: numbers, evidence, key points, names, dates. Remove only fluff and repetition. You may restructure prose into bullets where helpful, but every bullet must be at least 4 words. Preserve tables. Return only the rewritten text.\n\n" + selected)
      .then(function(r) { if (r) replaceSelection(sel2, r); })
      .catch(function(e) { setShortenErr(e.message); setTimeout(function() { setShortenErr(null); }, 6000); })
      .then(function() { setShortening(false); });
  }

  function saveFile() {
    try {
      const a = document.createElement("a");
      a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
      a.download = "document.md"; a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { /* ignore download errors */ }
    const entry = { id: Date.now(), preview: md.slice(0, 80), date: new Date().toLocaleString(), content: md };
    const next = [entry].concat(history).slice(0, 20);
    setHistory(next);
    try { localStorage.setItem("md_history", JSON.stringify(next)); } catch { /* ignore storage errors */ }
    setSaved(true);
    setTimeout(function() { setSaved(false); }, 2000);
  }

  function copyText(t: string) {
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta);
  }

  const hBtn   = { background: "none", border: "1px solid " + border, color: text, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" };
  const hBtnOn = { background: accent, border: "1px solid " + accent, color: "#fff", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" };
  const tbBtn  = { background: "none", border: "1px solid " + border, color: text, borderRadius: 4, padding: "3px 7px", cursor: "pointer", fontSize: 11, fontFamily: "monospace" };
  const aiBtn  = function(col: string, busy: boolean) { return { background: "none", border: "1px solid " + col, color: busy ? accent : col, borderRadius: 4, padding: "3px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, opacity: busy ? 0.6 : 1 }; };

  const css = [
    ".mdp [data-line]:hover{background:" + (dark ? "#ffffff0a" : "#6c63ff0a") + ";border-radius:4px}",
    ".mdp h1{font-size:1.8em;font-weight:800;margin:0 0 12px;color:" + text + "}",
    ".mdp h2{font-size:1.4em;font-weight:700;margin:20px 0 8px;color:" + text + "}",
    ".mdp h3{font-size:1.15em;font-weight:600;margin:16px 0 6px;color:" + text + "}",
    ".mdp h4,.mdp h5,.mdp h6{font-weight:600;margin:12px 0 4px;color:" + text + "}",
    ".mdp p{margin:0 0 12px;line-height:1.7;color:" + text + "}",
    ".mdp a{color:" + accent + ";text-decoration:none}",
    ".mdp code{background:" + surface2 + ";padding:2px 5px;border-radius:4px;font-family:monospace;font-size:.9em;color:" + (dark ? "#f6ad55" : "#c05621") + "}",
    ".mdp pre{background:" + surface2 + ";padding:14px;border-radius:8px;overflow-x:auto;margin:12px 0}",
    ".mdp pre code{background:none;padding:0;color:" + (dark ? "#a0d9a0" : "#276749") + "}",
    ".mdp blockquote{border-left:3px solid " + accent + ";margin:12px 0;padding:8px 16px;background:" + surface2 + ";border-radius:0 6px 6px 0;color:" + muted + "}",
    ".mdp table{border-collapse:collapse;width:100%;margin:12px 0}",
    ".mdp th{background:" + surface2 + ";padding:8px 12px;text-align:left;border:1px solid " + border + ";font-weight:700}",
    ".mdp td{padding:7px 12px;border:1px solid " + border + "}",
    ".mdp ul{margin:8px 0 8px 20px;padding:0;list-style-type:disc}",
    ".mdp ol{margin:8px 0 8px 20px;padding:0;list-style-type:decimal}",
    ".mdp li{margin:3px 0;line-height:1.6;color:" + text + ";display:list-item}",
    ".mdp li.task{list-style:none;margin-left:-16px}",
    ".mdp li.done{opacity:.7}",
    ".mdp hr{border:none;border-top:1px solid " + border + ";margin:20px 0}",
    ".mdp strong{font-weight:700}",
    ".mdp em{font-style:italic}",
    ".mdp del{opacity:.6;text-decoration:line-through}",
    ".mdp img{max-width:100%}"
  ].join("\n");

  const anyErr = conciseErr || bulletErr || shortenErr;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:bg, color:text, fontFamily:"system-ui,sans-serif", fontSize:25, overflow:"hidden" }}>
      <style>{css}</style>

      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:surface, borderBottom:"1px solid "+border, flexShrink:0, flexWrap:"wrap" }}>
        <span style={{ fontWeight:800, fontSize:15, color:accent, marginRight:4 }}>Viks markup editor</span>
        {confirmNew
          ? <><span style={{ fontSize:12, color:"#f6ad55" }}>Discard changes?</span>
              <button style={{ ...hBtn, color:"#f6ad55", borderColor:"#f6ad55" }} onClick={function() { setMd("# Untitled\n\n"); setConfirmNew(false); }}>Yes</button>
              <button style={hBtn} onClick={function() { setConfirmNew(false); }}>No</button></>
          : <button style={hBtn} onClick={function() { setConfirmNew(true); }}>New</button>
        }
        <button style={showOutline ? hBtnOn : hBtn} onClick={function() { setShowOutline(!showOutline); }}>Outline</button>
        <button style={showCheat ? hBtnOn : hBtn} onClick={function() { setShowCheat(!showCheat); }}>Cheat Sheet</button>
        <button style={showHints ? hBtnOn : hBtn} onClick={function() { setShowHints(!showHints); }}>Hints</button>
        <button style={showChallenge ? hBtnOn : hBtn} onClick={function() { setShowChallenge(!showChallenge); }}>Challenge</button>
        <button style={hBtn} onClick={function() { copyText(md); }}>Copy Raw</button>
        <button style={hBtn} onClick={function() { copyText(rendered); }}>Copy HTML</button>
        <button style={{ ...hBtn, background: saved ? "#276749" : accent, border:"none", color:"#fff", fontWeight:700 }} onClick={saveFile}>{saved ? "Saved!" : "Save .md"}</button>
        <button style={hBtn} onClick={function() { setDark(!dark); }}>{dark ? "Light" : "Dark"}</button>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {showOutline && (
          <div style={{ width:260, background:surface, borderRight:"1px solid "+border, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
            <div style={{ display:"flex", borderBottom:"1px solid "+border }}>
              <button style={{ flex:1, padding:"8px 4px", textAlign:"center", cursor:"pointer", fontWeight:600, color: panel==="outline" ? accent : muted, background:"none", border:"none", borderBottom: panel==="outline" ? "2px solid "+accent : "none" }} onClick={function() { setPanel("outline"); }}>Outline</button>
              <button style={{ flex:1, padding:"8px 4px", textAlign:"center", cursor:"pointer", fontWeight:600, color: panel==="history" ? accent : muted, background:"none", border:"none", borderBottom: panel==="history" ? "2px solid "+accent : "none" }} onClick={function() { setPanel("history"); }}>History</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:8 }}>
              {panel === "outline"
                ? headings.length === 0
                  ? <div style={{ color:muted, fontSize:12, marginTop:8 }}>No headings yet.</div>
                  : headings.map(function(h, i) {
                      return <div key={i} onClick={function() { jumpToLine(h.line); }} style={{ paddingLeft:(h.level-1)*10, marginBottom:4, fontSize:12, color: h.level===1 ? text : h.level===2 ? accent : muted, fontWeight: h.level<=2 ? 600 : 400, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", cursor:"pointer" }}>{"#".repeat(h.level)} {h.text}</div>;
                    })
                : history.length === 0
                  ? <div style={{ color:muted, marginTop:8 }}>No saved docs yet.</div>
                  : history.map(function(h) {
                      return <div key={h.id} style={{ marginBottom:10, cursor:"pointer", padding:"6px 8px", borderRadius:6, background:surface2, border:"1px solid "+border }} onClick={function() { setMd(h.content); }}>
                        <div style={{ color:muted, marginBottom:2 }}>{h.date}</div>
                        <div style={{ color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.preview}...</div>
                      </div>;
                    })
              }
            </div>
          </div>
        )}

        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, padding:"6px 10px", background:surface2, borderBottom:"1px solid "+border, flexShrink:0, alignItems:"center" }}>
            {TOOLBAR.map(function(item, i) {
              return <button key={i} style={tbBtn} title={item.title} onClick={function() { applyToolbar(item); }}>{item.label}</button>;
            })}
            <button style={aiBtn("#a78bfa", concising)} onClick={handleConcise} disabled={concising}>{concising ? "..." : "Concise"}</button>
            <button style={aiBtn("#68d391", bulleting)} onClick={handleBullets} disabled={bulleting}>{bulleting ? "..." : "Bullets"}</button>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:11, color:muted, whiteSpace:"nowrap" }}>Shorten by</span>
              <input type="number" min="1" max="99" value={shortenPct}
                onChange={function(e) { setShortenPct(Math.min(99, Math.max(1, parseInt(e.target.value) || 1))); }}
                style={{ width:46, background: dark?"#22263a":"#f0f2f5", border:"1px solid "+border, color:text, borderRadius:4, padding:"3px 5px", fontSize:11, textAlign:"center" }}
              />
              <span style={{ fontSize:11, color:muted }}>%</span>
              <button style={aiBtn("#f6ad55", shortening)} onClick={handleShorten} disabled={shortening}>{shortening ? "..." : "Shorten"}</button>
            </span>
            <span style={{ marginLeft:"auto", display:"flex", gap:12, color:muted, fontSize:11 }}>
              <span>{words} words</span>
              <span>{readTime} min read</span>
            </span>
          </div>

          {anyErr && (
            <div style={{ padding:"4px 12px", background:"#7c3a2020", color:"#fc8181", fontSize:11, borderBottom:"1px solid #fc818140", flexShrink:0 }}>
              {anyErr}
            </div>
          )}

          <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>
            <textarea ref={taRef}
              style={{ flex:1, background:surface, color:text, border:"none", padding:16, fontSize:14, fontFamily:"monospace", lineHeight:1.7, resize:"none", outline:"none", borderRight:"1px solid "+border }}
              value={md}
              onChange={function(e) { setMd(e.target.value); }}
              spellCheck={false}
              placeholder="Start writing Markdown..."
              onMouseUp={handleEditorClick}
              onKeyUp={handleEditorKeyUp}
            />
            <div ref={previewRef} style={{ flex:1, overflowY:"auto", padding:20, background:surface, cursor:"pointer", position:"relative" }}>
              <style>{css}</style>
              <div className="mdp" onClick={handlePreviewClick} style={{listStyleType:"disc"}} dangerouslySetInnerHTML={{ __html: rendered }} />
            </div>
            {showCheat && (
              <div style={{ position:"absolute", right:0, top:0, bottom:0, width:270, background:surface, borderLeft:"1px solid "+border, zIndex:10, overflowY:"auto", padding:16 }}>
                <div style={{ fontWeight:800, fontSize:14, marginBottom:12, color:accent }}>Cheat Sheet</div>
                {CHEAT_SHEET.map(function(cat) {
                  return <div key={cat.cat} style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:700, fontSize:11, color:muted, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{cat.cat}</div>
                    {cat.items.map(function(item) {
                      return <div key={item.syntax} style={{ marginBottom:6 }}>
                        <code style={{ fontSize:11, background:surface2, padding:"2px 5px", borderRadius:3, color: dark?"#f6ad55":"#c05621", display:"block", marginBottom:2, whiteSpace:"pre-wrap" }}>{item.syntax}</code>
                        <span style={{ fontSize:11, color:muted }}>{item.desc}</span>
                      </div>;
                    })}
                  </div>;
                })}
              </div>
            )}
          </div>

          {showHints && hints.length > 0 && (
            <div style={{ borderTop:"1px solid "+border, padding:"6px 16px", background:surface2, display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", flexShrink:0 }}>
              <span style={{ fontSize:11, color:muted, fontWeight:600 }}>Hints:</span>
              {hints.map(function(h, i) {
                return <span key={i} style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background: h.type==="warn"?"#7c3a2020":"#2a4a6a20", color: h.type==="warn"?"#f6ad55":"#63b3ed", border:"1px solid "+(h.type==="warn"?"#f6ad5540":"#63b3ed40") }}>{h.type==="warn" ? "Warning" : "Tip"}: {h.msg}</span>;
              })}
            </div>
          )}
          {showHints && hints.length === 0 && md.length > 50 && (
            <div style={{ borderTop:"1px solid "+border, padding:"6px 16px", background:surface2, flexShrink:0 }}>
              <span style={{ fontSize:11, color:"#68d391" }}>No issues found.</span>
            </div>
          )}

          {showChallenge && (
            <div style={{ borderTop:"1px solid "+border, padding:"8px 16px", background:surface, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
              <span style={{ fontSize:11, fontWeight:700, color:accent }}>Challenge:</span>
              <span style={{ fontSize:12, color:text, flex:1 }}>{CHALLENGES[chalIdx].title} - {CHALLENGES[chalIdx].prompt}</span>
              <button style={hBtn} onClick={function() { setChalIdx((chalIdx + 1) % CHALLENGES.length); }}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
