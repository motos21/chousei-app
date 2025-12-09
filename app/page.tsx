"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type HistoryItem = { id: string; title: string; visitedAt: number };

export default function Home() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // --- 追加モード管理 ---
  const [addMode, setAddMode] = useState<"single" | "range">("single");
  
  // 単発用
  const [singleDate, setSingleDate] = useState("");
  
  // 期間用
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 共通の時間
  const [selectedTime, setSelectedTime] = useState("19:00");

  const timeOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  useEffect(() => {
    const loadHistory = async () => {
      const stored = localStorage.getItem("chousei_history");
      if (stored) {
        const items: HistoryItem[] = JSON.parse(stored);
        setHistory(items.sort((a, b) => b.visitedAt - a.visitedAt).slice(0, 5));
      }
    };
    loadHistory();
  }, []);

  // --- 単発追加 ---
  const addSingleCandidate = () => {
    if (!singleDate) return;
    const dateObj = new Date(singleDate);
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    const dayStr = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
    const newCandidate = `${dateStr}(${dayStr}) ${selectedTime}〜`;
    
    if (!candidates.includes(newCandidate)) {
      setCandidates([...candidates, newCandidate]);
    }
  };

  // --- 期間一括追加 ---
  const addRangeCandidates = () => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 日付が逆転していたら入れ替え
    if (start > end) {
      alert("開始日が終了日より後になっています");
      return;
    }

    const newItems: string[] = [];
    // startからendまでループ
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
       const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
       const dayStr = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
       const candidate = `${dateStr}(${dayStr}) ${selectedTime}〜`;
       if (!candidates.includes(candidate) && !newItems.includes(candidate)) {
         newItems.push(candidate);
       }
    }
    setCandidates([...candidates, ...newItems]);
  };

  const createEvent = async () => {
    if (!title) { alert("イベント名を入力してください"); return; }
    if (candidates.length === 0) { alert("候補日を少なくとも1つ追加してください"); return; }
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "events"), {
        title: title,
        detail: detail,
        candidates: candidates.map((c, i) => ({ id: i, label: c })),
        created_at: serverTimestamp(),
      });
      const newHistory = [{ id: docRef.id, title, visitedAt: Date.now() }, ...history];
      localStorage.setItem("chousei_history", JSON.stringify(newHistory));
      router.push(`/events/${docRef.id}`);
    } catch (e) {
      console.error("Error:", e);
      alert("エラーが発生しました");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500 selection:text-black">
      <main className="max-w-3xl mx-auto py-16 px-6">
        
        {/* タイトルエリア */}
        <div className="mb-16 border-l-8 border-cyan-500 pl-6">
          <h1 className="text-6xl font-black tracking-tighter mb-2 leading-none">
            SMART<br/><span className="text-cyan-500">SCHEDULER</span>
          </h1>
          <p className="text-slate-400 font-bold tracking-widest text-sm mt-4 uppercase">
            Simple Adjustment Tool / ログイン不要の調整ツール
          </p>
        </div>

        {/* 3ステップガイド */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-16 border border-white">
          <div className="bg-[#111] p-8 border-b md:border-b-0 md:border-r border-white hover:bg-[#161616] transition">
            <div className="text-cyan-500 font-black text-5xl mb-4 opacity-30">01</div>
            <h3 className="font-bold text-lg mb-1 tracking-wider text-cyan-400">CREATE</h3>
            <p className="text-xs text-slate-300">イベントと候補日を作成</p>
          </div>
          <div className="bg-[#111] p-8 border-b md:border-b-0 md:border-r border-white hover:bg-[#161616] transition">
            <div className="text-pink-500 font-black text-5xl mb-4 opacity-30">02</div>
            <h3 className="font-bold text-lg mb-1 tracking-wider text-pink-500">SHARE</h3>
            <p className="text-xs text-slate-300">URLをメンバーに共有</p>
          </div>
          <div className="bg-[#111] p-8 hover:bg-[#161616] transition">
            <div className="text-orange-500 font-black text-5xl mb-4 opacity-30">03</div>
            <h3 className="font-bold text-lg mb-1 tracking-wider text-orange-500">ANSWER</h3>
            <p className="text-xs text-slate-300">自動で集計完了</p>
          </div>
        </div>

        {/* メインフォーム */}
        <div className="space-y-10">
          
          <div className="relative group">
            <label className="block text-cyan-500 font-black mb-2 text-xs uppercase tracking-widest pl-1">Event Name / イベント名</label>
            <input
              type="text"
              className="w-full bg-[#000] border-2 border-white p-5 text-xl font-bold text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition-all"
              placeholder="例：プロジェクト定例、忘年会"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="relative group">
            <label className="block text-cyan-500 font-black mb-2 text-xs uppercase tracking-widest pl-1">Detail / 詳細メモ</label>
            <textarea
              className="w-full bg-[#000] border-2 border-white p-5 text-base text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition-all"
              rows={3}
              placeholder="場所やZoom URLなど..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-cyan-500 font-black mb-4 text-xs uppercase tracking-widest pl-1">Candidates / 候補日程</label>
            
            {/* モード切り替えタブ */}
            <div className="flex mb-4 gap-2">
              <button 
                onClick={() => setAddMode("single")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest transition border ${addMode === "single" ? "bg-cyan-600 text-black border-cyan-600" : "bg-black text-slate-500 border-slate-700 hover:border-slate-500"}`}
              >
                Single Date (単発)
              </button>
              <button 
                onClick={() => setAddMode("range")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest transition border ${addMode === "range" ? "bg-cyan-600 text-black border-cyan-600" : "bg-black text-slate-500 border-slate-700 hover:border-slate-500"}`}
              >
                Date Range (期間一括)
              </button>
            </div>

            {/* 追加フォームエリア */}
            <div className="bg-[#111] border border-white p-4 mb-4">
              
              {/* 時間選択 (共通) */}
              <div className="mb-4">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Time / 時間 (固定)</label>
                <select
                  className="w-full bg-[#000] text-white border border-slate-600 p-3 outline-none focus:border-cyan-500"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}〜</option>
                  ))}
                </select>
              </div>

              {addMode === "single" ? (
                // 単発モード
                <div className="flex gap-2">
                  <input
                    type="date"
                    // ↓ ここに [color-scheme:dark] を指定してカレンダーアイコンを白くしています
                    className="flex-1 bg-[#000] text-white border border-slate-600 p-3 outline-none focus:border-cyan-500 [color-scheme:dark]"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                  />
                  <button
                    onClick={addSingleCandidate}
                    disabled={!singleDate}
                    className="bg-cyan-600 text-black font-black px-6 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 uppercase"
                  >
                    ADD
                  </button>
                </div>
              ) : (
                // 期間モード
                <div className="flex flex-col gap-2">
                   <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold">Start</label>
                      <input
                        type="date"
                        className="w-full bg-[#000] text-white border border-slate-600 p-3 outline-none focus:border-cyan-500 [color-scheme:dark]"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <span className="text-white pt-4">～</span>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold">End</label>
                      <input
                        type="date"
                        className="w-full bg-[#000] text-white border border-slate-600 p-3 outline-none focus:border-cyan-500 [color-scheme:dark]"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                   </div>
                   <button
                    onClick={addRangeCandidates}
                    disabled={!startDate || !endDate}
                    className="w-full bg-cyan-600 text-black font-black py-3 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 uppercase mt-2"
                  >
                    ADD ALL DATES
                  </button>
                </div>
              )}
            </div>

            {/* 追加済みリスト */}
            {candidates.length > 0 ? (
              <div className="border border-white bg-[#0A0A0A]">
                {candidates.map((c, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border-b border-white last:border-b-0 hover:bg-[#111] transition">
                    <span className="font-bold font-mono text-lg text-slate-200">{c}</span>
                    <button
                      onClick={() => setCandidates(candidates.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-red-500 font-bold text-xs uppercase tracking-wider px-2 py-1 border border-transparent hover:border-red-500 transition-all"
                    >
                      DELETE
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-white text-slate-500 text-xs uppercase tracking-widest">
                NO DATES ADDED
              </div>
            )}
          </div>

          <button
            onClick={createEvent}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-black text-2xl py-6 hover:opacity-90 transition shadow-[0_0_30px_rgba(8,145,178,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none tracking-widest uppercase border-2 border-transparent hover:border-white"
          >
            {isSubmitting ? "PROCESSING..." : "CREATE EVENT"}
          </button>
        </div>

        {/* 最近見たイベント */}
        {history.length > 0 && (
          <div className="mt-24 border-t border-slate-800 pt-12">
             <h2 className="text-slate-500 font-black text-xs uppercase tracking-widest mb-6">RECENT EVENTS / 最近見たイベント</h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {history.map((h) => (
                 <Link href={`/events/${h.id}`} key={h.id} className="block group">
                   <div className="bg-[#111] border border-slate-700 p-6 group-hover:border-cyan-500 group-hover:bg-[#1A1A1A] transition duration-300">
                     <h3 className="font-bold text-white text-lg mb-1 truncate">{h.title}</h3>
                     <p className="text-slate-500 text-xs font-mono">ID: {h.id}</p>
                   </div>
                 </Link>
               ))}
             </div>
          </div>
        )}

      </main>
    </div>
  );
}