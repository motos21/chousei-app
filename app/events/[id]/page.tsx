"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, addDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

// --- 型定義 ---
type EventData = {
  title: string;
  detail: string;
  candidates: { id: number; label: string }[];
};

type Participant = {
  id: string;
  name: string;
  comment: string;
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

  // --- ステート管理 ---
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

  // --- データ取得 ---
  useEffect(() => {
    if (!id) return;
    let myId = localStorage.getItem("chousei_browser_id");
    if (!myId) {
      myId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("chousei_browser_id", myId);
    }
    setBrowserId(myId);

    const unsubEvent = onSnapshot(doc(db, "events", id), (doc) => {
      if (doc.exists()) setEvent(doc.data() as EventData);
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

  // --- ヘルパー関数: ベスト日程のIDを取得 ---
  const getBestCandidateIds = () => {
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
  };
  const bestIds = getBestCandidateIds();

  // --- 機能: URLコピー ---
  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsUrlCopied(true);
    setTimeout(() => setIsUrlCopied(false), 2000);
  };

  // --- DB操作 ---
  const submitAnswer = async () => {
    if (!name) return alert("名前を入力してください");
    if (event && Object.keys(myAnswers).length < event.candidates.length) return alert("全ての日程に回答してください");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "events", id, "participants"), {
        name, comment, answers: myAnswers, created_at: serverTimestamp(),
      });
      setName(""); setComment(""); setMyAnswers({}); setChatName(name);
      alert("回答を登録しました！");
    } catch { alert("エラーが発生しました"); } finally { setIsSubmitting(false); }
  };

  const sendMessage = async () => {
    if (!chatText || !chatName) return;
    try {
      await addDoc(collection(db, "events", id, "messages"), {
        text: chatText, senderName: chatName, senderId: browserId, createdAt: serverTimestamp(),
      });
      setChatText("");
    } catch (e) { console.error(e); }
  };

  const deleteMessage = async (mid: string) => {
    if (confirm("削除しますか？")) await deleteDoc(doc(db, "events", id, "messages", mid));
  };

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
        
        {/* ヘッダーカード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
          
          {/* URLコピーボタン (右上) */}
          <button
            onClick={copyUrl}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 border border-white/40 text-white px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition backdrop-blur-sm shadow-sm z-30"
          >
            {isUrlCopied ? (
              <><span>✨</span> コピー完了</>
            ) : (
              <><span>🔗</span> URLをコピー</>
            )}
          </button>

          <div className="bg-indigo-600 p-6 text-white">
            <h1 className="text-2xl font-bold pr-32">{event.title}</h1>
            <p className="mt-2 opacity-90 whitespace-pre-wrap text-sm">{event.detail}</p>
          </div>

          {/* 出欠表（スマホ対応：名前固定） */}
          <div className="overflow-x-auto pb-2">
            <table className="w-full border-collapse text-sm min-w-max">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {/* 名前列を固定 (sticky) */}
                  <th className="p-3 text-left w-32 sm:w-40 sticky left-0 z-20 bg-gray-50 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    参加者 ({participants.length})
                  </th>
                  {event.candidates.map((c) => {
                    const isBest = bestIds.includes(c.id);
                    return (
                      <th key={c.id} className={`p-2 text-center min-w-[90px] border-l border-white relative ${
                        isBest ? "bg-yellow-100 text-yellow-900" : "bg-indigo-50 text-indigo-900"
                      }`}>
                        {isBest && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg">👑</div>}
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
                    {/* 名前列を固定 (sticky) */}
                    <td className="p-3 font-bold text-gray-700 sticky left-0 z-10 bg-white border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[120px]">
                      {p.name}
                    </td>
                    {event.candidates.map((c) => {
                      const isBest = bestIds.includes(c.id);
                      return (
                        <td key={c.id} className={`p-2 text-center border-l border-gray-100 ${isBest ? "bg-yellow-50/30" : ""}`}>
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

        {/* 下段：入力＆チャット */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 出欠入力 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold mb-4 pb-2 border-b">出欠を入力</h2>
            <div className="space-y-4">
              <input type="text" className="w-full border rounded p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="お名前" value={name} onChange={(e) => setName(e.target.value)} />
              
              <div className="bg-gray-50 p-3 rounded-lg space-y-2 max-h-64 overflow-y-auto">
                {event.candidates.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                    <span className="text-xs sm:text-sm font-bold text-indigo-900">{c.label}</span>
                    <div className="flex gap-1">
                      {[["o","◎"], ["t","△"], ["x","✕"]].map(([val, label]) => (
                        <button key={val} onClick={() => setMyAnswers({ ...myAnswers, [c.id]: val })} 
                          className={`w-8 h-8 rounded text-sm font-bold transition ${
                            myAnswers[c.id] === val ? 
                            (val==="o"?"bg-green-500 text-white":val==="t"?"bg-yellow-400 text-white":"bg-red-400 text-white") : "bg-gray-100 text-gray-400"
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <input type="text" className="w-full border rounded p-2.5 outline-none" placeholder="コメント" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button onClick={submitAnswer} disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-bold py-3 rounded hover:bg-indigo-700 disabled:opacity-50">回答を登録</button>
            </div>
          </div>

          {/* チャット */}
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
              <input type="text" placeholder="送信する..." className="flex-1 border rounded p-2 text-sm" value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&sendMessage()} />
              <button onClick={sendMessage} className="bg-indigo-600 text-white px-3 rounded text-sm font-bold">送信</button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}