"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  doc, 
  onSnapshot, 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from "firebase/firestore";

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
  hasPaid?: boolean; // 支払いフラグ
  created_at?: any;
};

type Message = { 
  id: string; 
  text: string; 
  senderName: string; 
  senderId: string; 
  createdAt: any; 
};

type HistoryItem = { id: string; title: string; visitedAt: number };

export default function EventPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // 自分の入力用
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [myAnswers, setMyAnswers] = useState<{ [key: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // チャット用
  const [chatText, setChatText] = useState("");
  const [chatName, setChatName] = useState("");
  const [browserId, setBrowserId] = useState("");

  // UI制御
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // 編集モード

  // 日程追加用
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("19:00");

  const timeOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  // --- 初期化 & データ監視 ---
  useEffect(() => {
    if (!id) return;

    // ブラウザID生成（チャットの本人判定用）
    let myId = localStorage.getItem("chousei_browser_id");
    if (!myId) {
      myId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("chousei_browser_id", myId);
    }
    setBrowserId(myId);

    // ★以前入力した名前があれば復元する（修正ポイント）
    const savedName = localStorage.getItem("chousei_user_name");
    if (savedName) {
      setName(savedName);
      setChatName(savedName);
    }

    // 1. イベント情報の取得
    const unsubEvent = onSnapshot(doc(db, "events", id), (d) => { 
        if (d.exists()) {
            const data = d.data() as EventData;
            setEvent(data);
            
            // 履歴保存
            const stored = localStorage.getItem("chousei_history");
            let history: HistoryItem[] = stored ? JSON.parse(stored) : [];
            history = history.filter(h => h.id !== id);
            history.unshift({ id, title: data.title, visitedAt: Date.now() });
            localStorage.setItem("chousei_history", JSON.stringify(history.slice(0, 10)));
        }
    });

    // 2. 参加者の取得
    const qParticipants = query(collection(db, "events", id, "participants"), orderBy("created_at", "asc"));
    const unsubParticipants = onSnapshot(qParticipants, (s) => {
      setParticipants(s.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]);
    });

    // 3. チャットの取得
    const qMessages = query(collection(db, "events", id, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(qMessages, (s) => {
      setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]);
    });

    return () => { unsubEvent(); unsubParticipants(); unsubMessages(); };
  }, [id]);

  // --- ロジック ---

  // 最適な日程の算出 (◎=2点, △=1点)
  const bestIds = (() => {
    if (!event || participants.length === 0) return [];
    const scores: { [key: number]: number } = {};
    
    // 初期化
    event.candidates.forEach((c) => { scores[c.id] = 0; });
    
    // 集計
    participants.forEach((p) => { 
      event.candidates.forEach((c) => {
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

  // --- 編集機能 (日程追加・削除・支払い) ---
  const addCandidate = async () => { 
    if (!editDate || !event) return; 
    const dateObj = new Date(editDate); 
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`; 
    const dayStr = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()]; 
    const newLabel = `${dateStr}(${dayStr}) ${editTime}〜`; 
    
    const maxId = event.candidates.reduce((max, c) => Math.max(max, c.id), -1); 
    
    try {
      await updateDoc(doc(db, "events", id), { 
        candidates: [...event.candidates, { id: maxId + 1, label: newLabel }]
      });
      setEditDate("");
    } catch (e) {
      alert("更新エラー: 権限を確認してください");
    }
  };

  const deleteCandidate = async (cid: number) => { 
    if (!event || !confirm("この日程を削除しますか？")) return; 
    try {
      await updateDoc(doc(db, "events", id), { 
        candidates: event.candidates.filter(c => c.id !== cid) 
      });
    } catch (e) {
      alert("削除エラー");
    }
  };

  // 支払いステータスの切り替え
  const togglePayment = async (pid: string, currentStatus: boolean = false) => { 
    if (!confirm(currentStatus ? "「未払い」に戻しますか？" : "「支払い済み」にしますか？")) return;
    try { 
      await updateDoc(doc(db, "events", id, "participants", pid), { hasPaid: !currentStatus }); 
    } catch (e) { 
      alert("更新失敗: 権限などを確認してください"); 
    } 
  };

  // 参加登録
  const submitAnswer = async () => {
    if (!name) return alert("名前を入力してください");
    if (event && Object.keys(myAnswers).length < event.candidates.length) return alert("全ての日程に回答してください");
    
    setIsSubmitting(true);
    try { 
      await addDoc(collection(db, "events", id, "participants"), { 
        name, 
        comment, 
        answers: myAnswers, 
        hasPaid: false, 
        created_at: serverTimestamp(), 
      }); 
      
      // ★送信成功時に名前を保存して、チャット欄にも反映（修正ポイント）
      localStorage.setItem("chousei_user_name", name);
      setChatName(name);

      setName(""); 
      setComment(""); 
      setMyAnswers({}); 
      alert("登録しました！"); 
    } catch (e: any) { 
      console.error(e);
      alert("送信エラー: " + e.message); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  // チャット送信（大幅修正済み）
  const sendMessage = async () => { 
    if (!chatText) return;

    // ★修正: チャット欄の名前が空なら、メインの名前欄を使う
    const sender = chatName || name;

    if (!sender) return alert("名前を入力してください");

    try { 
      await addDoc(collection(db, "events", id, "messages"), { 
        text: chatText, 
        senderName: sender, 
        senderId: browserId, 
        createdAt: serverTimestamp() 
      }); 
      
      setChatText(""); 
      
      // ★追加: 名前を保存して次回入力を楽にする
      setChatName(sender);
      localStorage.setItem("chousei_user_name", sender);

    } catch (e: any) {
      console.error(e);
      alert("チャット送信エラー: " + e.message);
    } 
  };

  const deleteMessage = async (mid: string) => { 
    if (confirm("削除しますか？")) await deleteDoc(doc(db, "events", id, "messages", mid)); 
  };

  const renderSymbol = (s: string) => {
    if (s === "o") return <span className="text-cyan-400 font-black text-xl">◎</span>;
    if (s === "t") return <span className="text-yellow-400 font-black text-xl">△</span>;
    if (s === "x") return <span className="text-slate-700 font-bold text-xl">✕</span>;
    return <span className="text-slate-800">-</span>;
  };

  if (!event) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-cyan-500 font-mono tracking-widest animate-pulse">SYSTEM LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-cyan-500 selection:text-black pb-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-12">
        
        {/* ナビゲーション */}
        <div className="flex justify-between items-center border-b border-white pb-6">
          <div className="flex items-center gap-3">
             <div className="bg-cyan-600 text-black w-6 h-6 flex items-center justify-center font-black text-xs">ID</div>
             <p className="text-xs font-mono text-cyan-500 tracking-widest">{id}</p>
          </div>
          <div className="flex gap-0 border border-white">
            <button onClick={() => setIsEditMode(!isEditMode)} className={`px-5 py-2 text-xs font-black tracking-widest transition ${isEditMode ? "bg-orange-500 text-black" : "bg-[#111] hover:bg-[#222] text-slate-300"}`}>
              {isEditMode ? "DONE" : "EDIT"}
            </button>
            <button onClick={copyUrl} className="bg-[#111] hover:bg-[#222] text-slate-300 px-5 py-2 text-xs font-black tracking-widest transition border-l border-white">
              {isUrlCopied ? "COPIED!" : "SHARE URL"}
            </button>
          </div>
        </div>

        {/* イベント情報 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-8">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight uppercase">{event.title}</h1>
              <div className="bg-[#111] border-l-4 border-cyan-500 p-6 border border-white border-l-0">
                <p className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">{event.detail}</p>
              </div>
            </div>

            {/* 編集モードフォーム (日程追加) */}
            {isEditMode && (
              <div className="bg-[#150a05] border border-orange-900/50 p-6 animate-fadeIn">
                <p className="text-orange-500 font-bold text-xs uppercase tracking-widest mb-4">ADD NEW DATE / 日程追加</p>
                <div className="flex flex-col sm:flex-row gap-0">
                  <input type="date" className="bg-[#000] border border-white p-3 text-sm text-white outline-none focus:border-orange-500" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  <select className="bg-[#000] border border-l-0 sm:border-l-0 border-t-0 sm:border-t border-white p-3 text-sm text-white outline-none focus:border-orange-500" value={editTime} onChange={(e) => setEditTime(e.target.value)}>
                    {timeOptions.map(t => <option key={t} value={t}>{t}〜</option>)}
                  </select>
                  <button onClick={addCandidate} disabled={!editDate} className="bg-orange-600 text-black px-6 py-3 font-bold text-xs hover:bg-orange-500 uppercase tracking-widest border border-white border-l-0 sm:border-l-0 border-t-0 sm:border-t">ADD</button>
                </div>
              </div>
            )}

            {/* 出欠テーブル */}
            <div className="overflow-x-auto border border-white bg-[#0A0A0A]">
              <table className="w-full border-collapse text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[#111] border-b border-white">
                    <th className="p-4 text-left w-40 sticky left-0 z-20 bg-[#111] border-r border-white text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                      Participant Name
                    </th>
                    {event.candidates.map((c) => {
                      const isBest = bestIds.includes(c.id);
                      return (
                        <th key={c.id} className={`p-3 text-center min-w-[100px] border-l border-white relative ${isBest && !isEditMode ? "bg-cyan-900/20" : ""}`}>
                          {isBest && !isEditMode && <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500"></div>}
                          {isEditMode && (
                            <button onClick={() => deleteCandidate(c.id)} className="absolute top-1 right-1 text-red-500 hover:text-white hover:bg-red-500 w-4 h-4 flex items-center justify-center text-[10px] transition">×</button>
                          )}
                          <div className={`font-bold text-base font-mono ${isBest ? "text-cyan-400" : "text-slate-400"}`}>{c.label.split(' ')[0]}</div>
                          <div className="text-[10px] text-slate-600 uppercase mt-1">{c.label.split(' ')[1]}</div>
                        </th>
                      );
                    })}
                    <th className="p-4 text-left min-w-[200px] text-slate-500 font-bold uppercase text-[10px] tracking-widest pl-6 border-l border-white">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-b border-white hover:bg-[#161616] transition group">
                      <td className="p-4 font-bold text-white sticky left-0 z-10 bg-[#0A0A0A] border-r border-white truncate max-w-[160px]">
                        <div className="flex items-center justify-between gap-2">
                          <span>{p.name}</span>
                          {/* 編集モード時の集金ボタン */}
                          {isEditMode && (
                            <button 
                              onClick={() => togglePayment(p.id, p.hasPaid)}
                              className={`text-[10px] px-2 py-0.5 border ${p.hasPaid ? "bg-cyan-900 text-cyan-300 border-cyan-500" : "bg-[#222] text-slate-500 border-slate-700"}`}
                            >
                              {p.hasPaid ? "¥ PAID" : "¥ UNPAID"}
                            </button>
                          )}
                        </div>
                      </td>
                      {event.candidates.map((c) => {
                        const isBest = bestIds.includes(c.id);
                        return (
                          <td key={c.id} className={`p-2 text-center border-l border-white ${isBest && !isEditMode ? "bg-cyan-900/10" : ""}`}>
                            {renderSymbol(p.answers[c.id])}
                          </td>
                        );
                      })}
                      <td className="p-4 text-slate-500 pl-6 truncate max-w-[200px] font-mono text-xs border-l border-white">{p.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {participants.length === 0 && <div className="p-12 text-center text-slate-600 font-mono text-xs tracking-widest uppercase">No participants yet / まだ参加者がいません</div>}
            </div>
          </div>

          {/* 右サイドバー (入力 & チャット) */}
          <div className="lg:col-span-4 space-y-10">
            
            {/* 入力フォーム */}
            <div className="bg-[#111] p-8 border border-white hover:border-cyan-500 transition duration-300">
              <h2 className="text-white font-black text-xl mb-1 uppercase tracking-wider">Your Entry</h2>
              <p className="text-slate-500 text-xs mb-6 font-bold">出欠を入力してください</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-cyan-500 text-[10px] font-black uppercase tracking-widest mb-2">Name / 名前</label>
                  <input type="text" className="w-full bg-[#000] border-2 border-white p-4 text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition-colors" placeholder="山田 太郎" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                
                <div>
                  <label className="block text-cyan-500 text-[10px] font-black uppercase tracking-widest mb-2">Select / 一括選択</label>
                  <p className="text-slate-500 text-[10px] mb-2">ボタンを押すと全日程を一括設定できます</p>
                  <div className="flex gap-0 border-2 border-white">
                    <button onClick={() => setAllAnswers("o")} className="flex-1 bg-[#111] text-cyan-400 py-3 text-xs font-black hover:bg-cyan-900/20 transition border-r border-white">ALL ◎</button>
                    <button onClick={() => setAllAnswers("t")} className="flex-1 bg-[#111] text-yellow-400 py-3 text-xs font-black hover:bg-yellow-900/20 transition border-r border-white">ALL △</button>
                    <button onClick={() => setAllAnswers("x")} className="flex-1 bg-[#111] text-slate-400 py-3 text-xs font-black hover:bg-slate-800 transition">ALL ✕</button>
                  </div>
                </div>

                <div className="bg-[#000] p-1 space-y-1 max-h-64 overflow-y-auto border-2 border-white custom-scrollbar">
                  {event.candidates.map((c) => (
                    <div key={c.id} className="flex justify-between items-center bg-[#111] p-3 border border-white">
                      <span className="text-xs font-bold text-slate-300 font-mono">{c.label}</span>
                      <div className="flex gap-1">
                        {[["o","◎","text-cyan-400"], ["t","△","text-yellow-400"], ["x","✕","text-slate-600"]].map(([val, label, color]) => (
                          <button key={val} onClick={() => setMyAnswers({ ...myAnswers, [c.id]: val })} className={`w-8 h-8 text-sm font-black transition ${myAnswers[c.id] === val ? `bg-[#000] border border-white ${color}` : "text-slate-700 hover:text-slate-500"}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                   <label className="block text-cyan-500 text-[10px] font-black uppercase tracking-widest mb-2">Comment / コメント</label>
                   <input type="text" className="w-full bg-[#000] border-2 border-white p-4 text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition-colors" placeholder="遅れます等..." value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
                
                <button onClick={submitAnswer} disabled={isSubmitting} className="w-full bg-cyan-600 text-black font-black text-lg py-5 hover:bg-cyan-500 transition shadow-[0_0_20px_rgba(8,145,178,0.2)] disabled:opacity-50 tracking-widest uppercase border border-white">
                  SUBMIT ENTRY
                </button>
              </div>
            </div>

            {/* チャット */}
            <div className="bg-[#111] p-8 border border-white flex flex-col h-[500px]">
              <h2 className="text-pink-500 font-black text-xl mb-1 uppercase tracking-wider">Board</h2>
              <p className="text-slate-500 text-xs mb-6 font-bold">連絡事項や挨拶はこちらへ</p>
              
              <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 custom-scrollbar">
                {messages.map((msg) => {
                  const isMe = msg.senderId === browserId;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-bold">{msg.senderName}</div>
                      <div className={`relative max-w-[85%] p-4 text-sm font-medium border ${isMe ? "bg-pink-900/20 border-pink-500/50 text-pink-100" : "bg-[#0A0A0A] border-white text-slate-300"}`}>
                        {msg.text}
                        {isMe && <button onClick={() => deleteMessage(msg.id)} className="absolute -top-2 -right-2 bg-[#000] border border-pink-500 text-pink-500 w-5 h-5 flex items-center justify-center text-[10px] hover:bg-pink-500 hover:text-black transition">×</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-4 border-t border-white">
                <input type="text" placeholder="NAME" className="w-1/3 bg-[#000] border border-white p-3 text-xs text-white focus:border-pink-500 outline-none" value={chatName} onChange={(e) => setChatName(e.target.value)} />
                <input type="text" placeholder="MESSAGE..." className="flex-1 bg-[#000] border border-white p-3 text-xs text-white focus:border-pink-500 outline-none" value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&sendMessage()} />
                <button onClick={sendMessage} className="bg-pink-600 text-black px-5 font-bold hover:bg-pink-500 transition uppercase text-xs tracking-widest border border-white">SEND</button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}