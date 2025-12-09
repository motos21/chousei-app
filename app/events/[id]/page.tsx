"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, addDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

type EventData = { title: string; detail: string; fee: string; candidates: { id: number; label: string }[]; };
type Participant = { id: string; name: string; comment: string; hasPaid: boolean; answers: { [key: number]: string }; };
type Message = { id: string; text: string; senderName: string; senderId: string; createdAt: any; };

export default function EventPage() {
  const params = useParams();
  const id = params.id as string;
  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [myAnswers, setMyAnswers] = useState<{ [key: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatName, setChatName] = useState("");
  const [browserId, setBrowserId] = useState("");
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("19:00");
  const [editFee, setEditFee] = useState("");

  const timeOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  useEffect(() => {
    if (!id) return;
    let myId = localStorage.getItem("chousei_browser_id");
    if (!myId) {
      myId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("chousei_browser_id", myId);
    }
    setBrowserId(myId);

    const unsubEvent = onSnapshot(doc(db, "events", id), (d) => { if (d.exists()) { const data = d.data() as EventData; setEvent(data); setEditFee(data.fee || ""); }});
    const qParticipants = query(collection(db, "events", id, "participants"), orderBy("created_at", "asc"));
    const unsubParticipants = onSnapshot(qParticipants, (s) => setParticipants(s.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]));
    const qMessages = query(collection(db, "events", id, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(qMessages, (s) => setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]));
    return () => { unsubEvent(); unsubParticipants(); unsubMessages(); };
  }, [id]);

  const bestIds = (() => {
    if (!event || participants.length === 0) return [];
    const scores: { [key: number]: number } = {};
    event.candidates.forEach((c) => { scores[c.id] = 0; participants.forEach((p) => { if (p.answers[c.id] === "o") scores[c.id] += 2; if (p.answers[c.id] === "t") scores[c.id] += 1; }); });
    const maxScore = Math.max(...Object.values(scores));
    return maxScore === 0 ? [] : event.candidates.filter((c) => scores[c.id] === maxScore).map((c) => c.id);
  })();

  const copyUrl = () => { navigator.clipboard.writeText(window.location.href); setIsUrlCopied(true); setTimeout(() => setIsUrlCopied(false), 2000); };
  const setAllAnswers = (val: string) => { if (!event) return; const newAnswers: { [key: number]: string } = {}; event.candidates.forEach(c => { newAnswers[c.id] = val; }); setMyAnswers(newAnswers); };
  const updateEventInfo = async () => { if(!event) return; try { await updateDoc(doc(db, "events", id), { fee: editFee }); } catch(e) { console.error(e); } };
  const addCandidate = async () => { if (!editDate || !event) return; const dateObj = new Date(editDate); const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`; const dayStr = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()]; const newLabel = `${dateStr}(${dayStr}) ${editTime}〜`; const maxId = event.candidates.reduce((max, c) => Math.max(max, c.id), -1); await updateDoc(doc(db, "events", id), { candidates: [...event.candidates, { id: maxId + 1, label: newLabel }], fee: editFee }); };
  const deleteCandidate = async (cid: number) => { if (!event || !confirm("削除しますか？")) return; await updateDoc(doc(db, "events", id), { candidates: event.candidates.filter(c => c.id !== cid) }); };
  const togglePayment = async (pid: string, currentStatus: boolean) => { try { await updateDoc(doc(db, "events", id, "participants", pid), { hasPaid: !currentStatus }); } catch (e) { alert("更新失敗"); } };
  const totalCollected = participants.filter(p => p.hasPaid).length * (parseInt(event?.fee || "0") || 0);

  const submitAnswer = async () => {
    if (!name) return alert("名前を入力してください");
    if (event && Object.keys(myAnswers).length < event.candidates.length) return alert("全て回答してください");
    setIsSubmitting(true);
    try { await addDoc(collection(db, "events", id, "participants"), { name, comment, answers: myAnswers, hasPaid: false, created_at: serverTimestamp(), }); setName(""); setComment(""); setMyAnswers({}); setChatName(name); alert("登録しました！"); } catch { alert("エラー"); } finally { setIsSubmitting(false); }
  };
  const sendMessage = async () => { if (!chatText || !chatName) return; try { await addDoc(collection(db, "events", id, "messages"), { text: chatText, senderName: chatName, senderId: browserId, createdAt: serverTimestamp() }); setChatText(""); } catch (e) {} };
  const deleteMessage = async (mid: string) => { if (confirm("削除しますか？")) await deleteDoc(doc(db, "events", id, "messages", mid)); };

  const renderSymbol = (s: string) => {
    if (s === "o") return <span className="text-green-400 font-black text-xl">◎</span>;
    if (s === "t") return <span className="text-yellow-400 font-black text-xl">△</span>;
    if (s === "x") return <span className="text-slate-600 font-bold text-xl">✕</span>;
    return <span className="text-slate-700">-</span>;
  };

  if (!event) return <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-cyan-400 font-mono animate-pulse">LOADING SYSTEM...</div>;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-cyan-500 selection:text-black pb-20">
      <main className="max-w-6xl mx-auto px-2 sm:px-6 pt-6 space-y-8">
        
        {/* ナビゲーションバー */}
        <div className="flex justify-between items-center bg-[#1E293B] p-4 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex items-center gap-3">
             <div className="bg-cyan-500 text-black w-8 h-8 rounded-lg flex items-center justify-center font-black">!</div>
             <p className="text-xs sm:text-sm font-bold text-slate-300">
               <span className="text-cyan-400">GUEST MODE:</span> 名前を入力して「◎」を押してください
             </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if(isEditMode) updateEventInfo(); setIsEditMode(!isEditMode); }} className={`px-4 py-2 rounded-lg text-xs font-black tracking-wider transition ${isEditMode ? "bg-orange-500 text-black" : "bg-slate-700 hover:bg-slate-600 text-white"}`}>
              {isEditMode ? "FINISH" : "EDIT"}
            </button>
            {!isEditMode && (
              <button onClick={copyUrl} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-black tracking-wider transition">
                {isUrlCopied ? "COPIED!" : "SHARE"}
              </button>
            )}
          </div>
        </div>

        {/* イベント情報カード */}
        <div className="bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 border-b border-slate-700 relative overflow-hidden">
            {/* 装飾 */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500 blur-[80px] opacity-20 pointer-events-none"></div>
            
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 relative z-10">{event.title}</h1>
            <p className="text-slate-400 whitespace-pre-wrap text-sm relative z-10 border-l-2 border-cyan-500 pl-4">{event.detail}</p>
            
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="bg-black/30 px-4 py-2 rounded-lg border border-slate-600 flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-400 uppercase">Fee</span>
                {isEditMode ? (
                  <input type="number" className="bg-slate-800 text-white w-24 px-2 py-1 rounded text-sm outline-none border border-slate-600 focus:border-cyan-400" placeholder="3000" value={editFee} onChange={(e) => setEditFee(e.target.value)} />
                ) : (
                  <span className="font-mono text-xl">{event.fee ? `¥${parseInt(event.fee).toLocaleString()}` : "---"}</span>
                )}
              </div>
              {!isEditMode && event.fee && (
                <div className="text-xs text-slate-400">
                  TOTAL: <span className="font-mono text-xl text-yellow-400">¥{totalCollected.toLocaleString()}</span> 
                  <span className="ml-1 opacity-50">({participants.filter(p=>p.hasPaid).length} PAID)</span>
                </div>
              )}
            </div>
          </div>

          {/* 編集フォーム */}
          {isEditMode && (
            <div className="bg-orange-900/20 p-4 border-b border-orange-500/30 flex flex-col sm:flex-row gap-2 items-center justify-center">
              <span className="font-bold text-orange-500 text-xs uppercase">Add Date</span>
              <input type="date" className="bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              <select className="bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white" value={editTime} onChange={(e) => setEditTime(e.target.value)}>
                {timeOptions.map(t => <option key={t} value={t}>{t}〜</option>)}
              </select>
              <button onClick={addCandidate} disabled={!editDate} className="bg-orange-500 text-black px-6 py-2 rounded font-bold text-sm hover:bg-orange-400">ADD</button>
            </div>
          )}

          {/* 出欠テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-[#0F172A] border-b border-slate-700">
                  <th className="p-4 text-left w-40 sticky left-0 z-20 bg-[#0F172A] border-r border-slate-700 text-slate-400 font-bold uppercase text-xs">Name</th>
                  <th className="p-2 text-center w-16 bg-[#0F172A] border-r border-slate-700 text-slate-500 text-[10px] uppercase">Paid</th>
                  {event.candidates.map((c) => {
                    const isBest = bestIds.includes(c.id);
                    return (
                      <th key={c.id} className={`p-3 text-center min-w-[100px] border-l border-slate-800 relative ${isBest && !isEditMode ? "bg-yellow-500/10 text-yellow-400" : "text-cyan-400"}`}>
                        {isBest && !isEditMode && <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] tracking-widest text-yellow-500 font-black">BEST</div>}
                        {isEditMode && <button onClick={() => deleteCandidate(c.id)} className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs z-10 hover:bg-red-600">×</button>}
                        <div className="font-bold text-lg leading-tight font-mono">{c.label.split(' ')[0]}</div>
                        <div className="text-[10px] opacity-60">{c.label.split(' ')[1]}</div>
                      </th>
                    );
                  })}
                  <th className="p-4 text-left min-w-[200px] text-slate-400 font-bold uppercase text-xs pl-6">Comment</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition">
                    <td className="p-4 font-bold text-white sticky left-0 z-10 bg-[#1E293B] border-r border-slate-700 truncate max-w-[160px]">
                      {p.name}
                    </td>
                    <td className="p-2 text-center border-r border-slate-700 bg-[#1E293B]">
                      <button onClick={() => togglePayment(p.id, p.hasPaid)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition font-bold ${p.hasPaid ? "bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-slate-700 text-slate-500 hover:bg-slate-600"}`}>¥</button>
                    </td>
                    {event.candidates.map((c) => {
                      const isBest = bestIds.includes(c.id);
                      return (
                        <td key={c.id} className={`p-2 text-center border-l border-slate-800 ${isBest && !isEditMode ? "bg-yellow-500/5" : ""}`}>
                          {renderSymbol(p.answers[c.id])}
                        </td>
                      );
                    })}
                    <td className="p-4 text-slate-400 pl-6 truncate max-w-[200px] font-mono text-xs">{p.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {participants.length === 0 && <div className="p-12 text-center text-slate-500 font-mono text-xs tracking-widest">NO PARTICIPANTS YET</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 入力フォーム */}
          <div className="bg-[#1E293B] p-6 rounded-2xl shadow-xl border border-slate-700">
            <h2 className="text-cyan-400 font-black text-lg mb-6 border-b border-slate-700 pb-2 uppercase tracking-widest">Your Entry</h2>
            <div className="space-y-4">
              <input type="text" className="w-full bg-[#0F172A] border border-slate-600 rounded-xl p-4 text-white placeholder-slate-600 focus:border-cyan-400 outline-none transition" placeholder="YOUR NAME" value={name} onChange={(e) => setName(e.target.value)} />
              
              <div className="flex gap-2">
                <button onClick={() => setAllAnswers("o")} className="flex-1 bg-green-900/30 text-green-400 border border-green-900 rounded-lg py-2 text-xs font-bold hover:bg-green-900/50 transition">ALL ◎</button>
                <button onClick={() => setAllAnswers("t")} className="flex-1 bg-yellow-900/30 text-yellow-400 border border-yellow-900 rounded-lg py-2 text-xs font-bold hover:bg-yellow-900/50 transition">ALL △</button>
                <button onClick={() => setAllAnswers("x")} className="flex-1 bg-red-900/30 text-red-400 border border-red-900 rounded-lg py-2 text-xs font-bold hover:bg-red-900/50 transition">ALL ✕</button>
              </div>

              <div className="bg-[#0F172A] p-4 rounded-xl space-y-2 max-h-64 overflow-y-auto border border-slate-700 custom-scrollbar">
                {event.candidates.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-[#1E293B] p-3 rounded-lg border border-slate-700">
                    <span className="text-sm font-bold text-slate-300 font-mono">{c.label}</span>
                    <div className="flex gap-1">
                      {[["o","◎","text-green-400"], ["t","△","text-yellow-400"], ["x","✕","text-red-400"]].map(([val, label, color]) => (
                        <button key={val} onClick={() => setMyAnswers({ ...myAnswers, [c.id]: val })} className={`w-10 h-10 rounded-lg text-lg font-black transition ${myAnswers[c.id] === val ? `bg-slate-700 ${color} shadow-lg scale-105` : "bg-[#0F172A] text-slate-600 hover:bg-slate-800"}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <input type="text" className="w-full bg-[#0F172A] border border-slate-600 rounded-xl p-4 text-white placeholder-slate-600 focus:border-cyan-400 outline-none transition" placeholder="COMMENT (Optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button onClick={submitAnswer} disabled={isSubmitting} className="w-full bg-cyan-500 text-black font-black text-lg py-4 rounded-xl hover:bg-cyan-400 transition shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 tracking-widest">SUBMIT</button>
            </div>
          </div>

          {/* チャット */}
          <div className="bg-[#1E293B] p-6 rounded-2xl shadow-xl border border-slate-700 flex flex-col h-[600px]">
            <h2 className="text-pink-500 font-black text-lg mb-6 border-b border-slate-700 pb-2 uppercase tracking-widest">Messages</h2>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
              {messages.map((msg) => {
                const isMe = msg.senderId === browserId;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">{msg.senderName}</div>
                    <div className={`relative max-w-[85%] p-3 rounded-2xl text-sm shadow-md font-medium ${isMe ? "bg-pink-600 text-white rounded-br-none" : "bg-[#0F172A] border border-slate-700 text-slate-300 rounded-bl-none"}`}>
                      {msg.text}
                      {isMe && <button onClick={() => deleteMessage(msg.id)} className="absolute -top-2 -right-2 bg-slate-700 text-slate-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-500 hover:text-white transition">×</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-4 border-t border-slate-700">
              <input type="text" placeholder="NAME" className="w-1/3 bg-[#0F172A] border border-slate-600 rounded-lg p-3 text-sm text-white focus:border-pink-500 outline-none" value={chatName} onChange={(e) => setChatName(e.target.value)} />
              <input type="text" placeholder="MESSAGE..." className="flex-1 bg-[#0F172A] border border-slate-600 rounded-lg p-3 text-sm text-white focus:border-pink-500 outline-none" value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&sendMessage()} />
              <button onClick={sendMessage} className="bg-pink-600 text-white px-4 rounded-lg font-bold hover:bg-pink-500 transition">➤</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}