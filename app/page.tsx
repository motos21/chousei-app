"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("19:00");

  const timeOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  const addCandidate = () => {
    if (!selectedDate) return;
    const dateObj = new Date(selectedDate);
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    const dayStr = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
    const newCandidate = `${dateStr}(${dayStr}) ${selectedTime}〜`;
    if (!candidates.includes(newCandidate)) {
      setCandidates([...candidates, newCandidate]);
    }
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-16 border border-slate-800">
          <div className="bg-[#111] p-8 border-b md:border-b-0 md:border-r border-slate-800 hover:bg-[#161616] transition">
            <div className="text-cyan-500 font-black text-5xl mb-4 opacity-30">01</div>
            <h3 className="font-bold text-lg mb-1 tracking-wider text-cyan-400">CREATE</h3>
            <p className="text-xs text-slate-400">イベントと候補日を作成</p>
          </div>
          <div className="bg-[#111] p-8 border-b md:border-b-0 md:border-r border-slate-800 hover:bg-[#161616] transition">
            <div className="text-pink-500 font-black text-5xl mb-4 opacity-30">02</div>
            <h3 className="font-bold text-lg mb-1 tracking-wider text-pink-500">SHARE</h3>
            <p className="text-xs text-slate-400">URLをメンバーに共有</p>
          </div>
          <div className="bg-[#111] p-8 hover:bg-[#161616] transition">
            <div className="text-orange-500 font-black text-5xl mb-4 opacity-30">03</div>
            <h3 className="font-bold text-lg mb-1 tracking-wider text-orange-500">ANSWER</h3>
            <p className="text-xs text-slate-400">自動で集計完了</p>
          </div>
        </div>

        {/* メインフォーム */}
        <div className="space-y-10">
          
          <div className="relative group">
            <label className="block text-cyan-500 font-black mb-2 text-xs uppercase tracking-widest pl-1">Event Name / イベント名</label>
            <input
              type="text"
              className="w-full bg-[#1A1A1A] border-2 border-slate-700 p-5 text-xl font-bold text-white placeholder-slate-600 focus:border-cyan-500 focus:bg-black outline-none transition-all"
              placeholder="例：プロジェクト定例、忘年会"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="relative group">
            <label className="block text-cyan-500 font-black mb-2 text-xs uppercase tracking-widest pl-1">Detail / 詳細メモ</label>
            <textarea
              className="w-full bg-[#1A1A1A] border-2 border-slate-700 p-5 text-base text-white placeholder-slate-600 focus:border-cyan-500 focus:bg-black outline-none transition-all"
              rows={3}
              placeholder="場所やZoom URLなど..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-cyan-500 font-black mb-4 text-xs uppercase tracking-widest pl-1">Candidates / 候補日程</label>
            
            <div className="flex flex-col sm:flex-row gap-0 mb-4">
              <input
                type="date"
                className="flex-1 bg-[#222] text-white border-2 border-slate-700 p-4 outline-none focus:border-cyan-500 transition-colors"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <select
                className="w-full sm:w-32 bg-[#222] text-white border-2 border-l-0 sm:border-l-0 border-t-0 sm:border-t-2 border-slate-700 p-4 outline-none focus:border-cyan-500 transition-colors"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
              >
                {timeOptions.map((time) => (
                  <option key={time} value={time}>{time}〜</option>
                ))}
              </select>
              <button
                onClick={addCandidate}
                disabled={!selectedDate}
                className="bg-cyan-600 text-black font-black px-8 py-4 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 transition-all uppercase tracking-widest"
              >
                ADD
              </button>
            </div>

            {candidates.length > 0 ? (
              <div className="border border-slate-800 bg-[#0A0A0A]">
                {candidates.map((c, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border-b border-slate-800 last:border-b-0 hover:bg-[#111] transition">
                    <span className="font-bold font-mono text-lg text-slate-200">{c}</span>
                    <button
                      onClick={() => setCandidates(candidates.filter((_, i) => i !== index))}
                      className="text-slate-600 hover:text-red-500 font-bold text-xs uppercase tracking-wider px-2 py-1 border border-transparent hover:border-red-500 transition-all"
                    >
                      DELETE
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-800 text-slate-600 text-xs uppercase tracking-widest">
                NO DATES ADDED
              </div>
            )}
          </div>

          <button
            onClick={createEvent}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-black text-2xl py-6 hover:opacity-90 transition shadow-[0_0_30px_rgba(8,145,178,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none tracking-widest uppercase"
          >
            {isSubmitting ? "PROCESSING..." : "CREATE EVENT"}
          </button>
        </div>
      </main>
    </div>
  );
}