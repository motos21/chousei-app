"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, addDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

// --- 型定義 ---
type EventData = {
  title: string;
  detail: string;
  fee: string;
  candidates: { id: number; label: string }[];
};

type Participant = {
  id: string;
  name: string;
  comment: string;
  hasPaid: boolean;
  answers: { [key: number]: string };
};

type Message = {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
  createdAt: any;
};

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

    const unsubEvent = onSnapshot(doc(db, "events", id), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as EventData;
        setEvent(data);
        setEditFee(data.fee || "");
      }
    });

    const qParticipants = query(collection(db, "events", id, "participants"), orderBy("created_at", "asc"));
    const unsubParticipants = onSnapshot(qParticipants, (s) => {
      setParticipants(s.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]);
    });

    const qMessages = query(collection(db, "events", id, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(qMessages, (s) => {
      setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]);
    });

    return () => { unsubEvent(); unsubParticipants(); unsubMessages(); };
  }, [id]);

  const bestIds = (() => {
    if (!event || participants.length === 0) return [];
    const scores: { [key: number]: number } = {};
    event.candidates.forEach((c) => {
      scores[c.id] = 0;
      participants.forEach((p) => {
        if (p.answers[c.id] === "o") scores[c.id] += 2;
        if (p.answers[c.id] === "t") scores[c.id] += 1;
      });
    });
    const maxScore = Math.max(...Object.values(scores));
    return maxScore === 0 ? [] : event.candidates.filter((c) => scores[c.id] === maxScore).map((c) => c.id);
  })();

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsUrlCopied(true);
    setTimeout(() => setIsUrlCopied(false), 2000);
  };

  const setAllAnswers = (val: string) => {
    if (!event) return;
    const newAnswers: { [key: number]: string } = {};
    event.candidates.forEach(c => { newAnswers[c.id] = val; });
    setMyAnswers(newAnswers);
  };

  const updateEventInfo = async () => {
     if(!event) return;
     try { await updateDoc(doc(db, "events", id), { fee: editFee }); } catch(e) { console.error(e); }
  };

  const addCandidate = async () => {
    if (!editDate || !event) return;
    const dateObj = new Date(editDate);
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    const dayStr = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
    const newLabel = `${dateStr}(${dayStr}) ${editTime}〜`;
    const maxId = event.candidates.reduce((max, c) => Math.max(max, c.id), -1);
    await updateDoc(doc(db, "events", id), {
      candidates: [...event.candidates, { id: maxId + 1, label: newLabel }],
      fee: editFee 
    });
  };

  const deleteCandidate = async (cid: number) => {
    if (!event || !confirm("削除しますか？")) return;
    await updateDoc(doc(db, "events", id), {
      candidates: event.candidates.filter(c => c.id !== cid)
    });
  };

  const togglePayment = async (pid: string, currentStatus: boolean) => {
    try { await updateDoc(doc(db, "events", id, "participants", pid), { hasPaid: !currentStatus }); } catch (e) { alert("更新に失敗しました"); }
  };

  const totalCollected = participants.filter(p => p.hasPaid).length * (parseInt(event?.fee || "0") || 0);

  const submitAnswer = async () => {
    if (!name) return alert("名前を入力してください");
    if (event && Object.keys(myAnswers).length < event.candidates.length) return alert("全て回答してください");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "events", id, "participants"), {
        name, comment, answers: myAnswers, hasPaid: false, created_at: serverTimestamp(),
      });
      setName(""); setComment(""); setMyAnswers({}); setChatName(name);
      alert("登録しました！");
    } catch { alert("エラー"); } finally { setIsSubmitting(false); }
  };

  const sendMessage = async () => {
    if (!chatText || !chatName) return;
    try { await addDoc(collection(db, "events", id, "messages"), { text: chatText, senderName: chatName, senderId: browserId, createdAt: serverTimestamp() }); setChatText(""); } catch (e) {}
  };
  const deleteMessage = async (mid: string) => { if (confirm("削除しますか？")) await deleteDoc(doc(db, "events", id, "messages", mid)); };

  const renderSymbol = (s: string) => {
    if (s === "o") return <span className="text-green-500 font-bold text-lg">◎</span>;
    if (s === "t") return <span className="text-yellow-500 font-bold text-lg">△</span>;
    if (s === "x") return <span className="text-red-400 font-bold text-lg opacity-50">✕</span>;
    return <span className="text-gray-200">-</span>;
  };

  if (!event) return <div className="p-10 text-center">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-2 sm:px-4 font-sans text-gray-800">
      <main className="max-w-5xl mx-auto space-y-6">
        
        {/* ガイドエリア (New!) */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm shadow-sm">
          <div className="flex items-start gap-3">
             <div className="bg-white p-2 rounded-full shadow-sm text-xl">💡</div>
             <div>
               <h3 className="font-bold text-indigo-900">参加者の皆様へ</h3>
               <p className="text-indigo-700 text-xs sm:text-sm mt-1">
                 下のフォームから名前と出欠を入力してください。<br className="sm:hidden"/>「全部◎」ボタンを使うと入力が楽になります。
               </p>
             </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-indigo-500">幹事の方へ: 右上の「✏️編集」から日程変更や会費設定が可能です</p>
          </div>
        </div>

        {/* ヘッダーカード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
          
          <div className="absolute top-4 right-4 flex gap-2 z-30">
            <button onClick={() => { if(isEditMode) updateEventInfo(); setIsEditMode(!isEditMode); }} className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition backdrop-blur-sm shadow-sm ${isEditMode ? "bg-orange-500 text-white border-orange-400" : "bg-white/20 hover:bg-white/30 border-white/40 text-white"}`}>
              {isEditMode ? "完了" : "✏️ 編集"}
            </button>
            {!isEditMode && (
              <button onClick={copyUrl} className="bg-white/20 hover:bg-white/30 border border-white/40 text-white px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 backdrop-blur-sm shadow-sm">
                {isUrlCopied ? "✨ 完了" : "🔗 共有"}
              </button>
            )}
          </div>

          <div className="bg-indigo-600 p-6 text-white">
            <h1 className="text-2xl font-bold pr-32">{event.title}</h1>
            <p className="mt-2 opacity-90 whitespace-pre-wrap text-sm">{event.detail}</p>
            
            <div className="mt-4 flex flex-wrap items-center gap-4 bg-indigo-700/50 p-3 rounded-lg backdrop-blur-sm inline-flex">
              <div className="text-sm font-bold flex items-center gap-2">
                <span>💰 会費:</span>
                {isEditMode ? (
                  <input type="number" className="text-gray-800 w-24 px-2 py-1 rounded text-sm outline-none" placeholder="3000" value={editFee} onChange={(e) => setEditFee(e.target.value)} />
                ) : (
                  <span className="text-lg">{event.fee ? `${parseInt(event.fee).toLocaleString()}円` : "未定"}</span>
                )}
              </div>
              {!isEditMode && event.fee && (
                <div className="text-sm border-l border-indigo-400 pl-4">
                  集金合計: <span className="font-bold text-yellow-300 text-lg">{totalCollected.toLocaleString()}円</span> 
                  <span className="opacity-75 text-xs ml-1">({participants.filter(p=>p.hasPaid).length}人済)</span>
                </div>
              )}
            </div>
          </div>

          {isEditMode && (
            <div className="bg-orange-50 p-4 border-b border-orange-100 flex flex-col sm:flex-row gap-2 items-center justify-center animate-fadeIn">
              <span className="font-bold text-orange-800 text-sm">日程追加:</span>
              <input type="date" className="border rounded p-1.5 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              <select className="border rounded p-1.5 text-sm bg-white" value={editTime} onChange={(e) => setEditTime(e.target.value)}>
                {timeOptions.map(t => <option key={t} value={t}>{t}〜</option>)}
              </select>
              <button onClick={addCandidate} disabled={!editDate} className="bg-orange-500 text-white px-4 py-1.5 rounded text-sm font-bold">追加</button>
            </div>
          )}

          <div className="overflow-x-auto pb-2">
            <table className="w-full border-collapse text-sm min-w-max">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-3 text-left w-32 sm:w-40 sticky left-0 z-20 bg-gray-50 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    参加者 ({participants.length})
                  </th>
                  <th className="p-2 text-center w-16 bg-gray-50 border-r border-gray-200 text-gray-500 text-xs">支払</th>
                  {event.candidates.map((c) => {
                    const isBest = bestIds.includes(c.id);
                    return (
                      <th key={c.id} className={`p-2 text-center min-w-[90px] border-l border-white relative ${isBest && !isEditMode ? "bg-yellow-100 text-yellow-900" : "bg-indigo-50 text-indigo-900"}`}>
                        {isBest && !isEditMode && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg">👑</div>}
                        {isEditMode && <button onClick={() => deleteCandidate(c.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">×</button>}
                        <div className="font-bold">{c.label.split(' ')[0]}</div>
                        <div className="text-xs opacity-70">{c.label.split(' ')[1]}</div>
                      </th>
                    );
                  })}
                  <th className="p-3 text-left min-w-[200px] pl-4">コメント</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-700 sticky left-0 z-10 bg-white border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[120px]">
                      {p.name}
                    </td>
                    <td className="p-2 text-center border-r border-gray-100">
                      <button onClick={() => togglePayment(p.id, p.hasPaid)} className={`w-8 h-8 rounded-full flex items-center justify-center transition ${p.hasPaid ? "bg-green-100 text-green-600 border border-green-200" : "bg-gray-100 text-gray-300 hover:bg-gray-200"}`}>¥</button>
                    </td>
                    {event.candidates.map((c) => {
                      const isBest = bestIds.includes(c.id);
                      return (
                        <td key={c.id} className={`p-2 text-center border-l border-gray-100 ${isBest && !isEditMode ? "bg-yellow-50/30" : ""}`}>
                          {renderSymbol(p.answers[c.id])}
                        </td>
                      );
                    })}
                    <td className="p-3 text-gray-500 pl-4 truncate max-w-[200px]">{p.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {participants.length === 0 && <div className="p-8 text-center text-gray-400">まだ回答がありません</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold mb-4 pb-2 border-b">出欠を入力</h2>
            <div className="space-y-4">
              <input type="text" className="w-full border rounded p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="お名前" value={name} onChange={(e) => setName(e.target.value)} />
              
              <div className="flex gap-2 mb-2">
                <button onClick={() => setAllAnswers("o")} className="flex-1 bg-green-50 text-green-700 border border-green-200 rounded py-2 text-xs font-bold hover:bg-green-100 transition">全部 ◎</button>
                <button onClick={() => setAllAnswers("t")} className="flex-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded py-2 text-xs font-bold hover:bg-yellow-100 transition">全部 △</button>
                <button onClick={() => setAllAnswers("x")} className="flex-1 bg-red-50 text-red-700 border border-red-200 rounded py-2 text-xs font-bold hover:bg-red-100 transition">全部 ✕</button>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg space-y-2 max-h-64 overflow-y-auto">
                {event.candidates.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                    <span className="text-xs sm:text-sm font-bold text-indigo-900">{c.label}</span>
                    <div className="flex gap-1">
                      {[["o","◎"], ["t","△"], ["x","✕"]].map(([val, label]) => (
                        <button key={val} onClick={() => setMyAnswers({ ...myAnswers, [c.id]: val })} className={`w-8 h-8 rounded text-sm font-bold transition ${myAnswers[c.id] === val ? (val==="o"?"bg-green-500 text-white":val==="t"?"bg-yellow-400 text-white":"bg-red-400 text-white") : "bg-gray-100 text-gray-400"}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <input type="text" className="w-full border rounded p-2.5 outline-none" placeholder="コメント" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button onClick={submitAnswer} disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-bold py-3 rounded hover:bg-indigo-700 disabled:opacity-50">回答を登録</button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
            <h2 className="text-lg font-bold mb-4 pb-2 border-b">メッセージ</h2>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2 bg-gray-50 rounded">
              {messages.map((msg) => {
                const isMe = msg.senderId === browserId;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="text-xs text-gray-400 mb-1">{msg.senderName}</div>
                    <div className={`relative max-w-[85%] p-2 rounded-lg text-sm shadow-sm ${isMe ? "bg-indigo-600 text-white" : "bg-white border text-gray-800"}`}>
                      {msg.text}
                      {isMe && <button onClick={() => deleteMessage(msg.id)} className="absolute -top-2 -right-2 bg-gray-200 text-gray-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <input type="text" placeholder="名前" className="w-1/3 border rounded p-2 text-sm" value={chatName} onChange={(e) => setChatName(e.target.value)} />
              <input type="text" placeholder="送信" className="flex-1 border rounded p-2 text-sm" value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&sendMessage()} />
              <button onClick={sendMessage} className="bg-indigo-600 text-white px-3 rounded text-sm font-bold">送信</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}