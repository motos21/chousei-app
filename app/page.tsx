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
        fee: "",
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
    <div className="min-h-screen bg-[#0F172A] text-white font-sans selection:bg-cyan-500 selection:text-black">
      <main className="max-w-2xl mx-auto py-12 px-6">
        
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-lg">
            SMART<br/>SCHEDULER
          </h1>
          <p className="text-slate-400 font-bold tracking-wider text-sm">
            URLを送るだけ。最強にシンプルな調整ツール。
          </p>
        </div>

        {/* 3ステップガイド (カードスタイル) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-[#1E293B] p-6 rounded-none border-l-4 border-cyan-400">
            <div className="text-cyan-400 font-black text-4xl mb-2 opacity-50">01</div>
            <h3 className="font-bold text-lg mb-1">イベント作成</h3>
            <p className="text-xs text-slate-400">タイトルと候補日を決める</p>
          </div>
          <div className="bg-[#1E293B] p-6 rounded-none border-l-4 border-pink-500">
            <div className="text-pink-500 font-black text-4xl mb-2 opacity-50">02</div>
            <h3 className="font-bold text-lg mb-1">URLをシェア</h3>
            <p className="text-xs text-slate-400">LINE等でメンバーに送る</p>
          </div>
          <div className="bg-[#1E293B] p-6 rounded-none border-l-4 border-orange-400">
            <div className="text-orange-400 font-black text-4xl mb-2 opacity-50">03</div>
            <h3 className="font-bold text-lg mb-1">自動集計</h3>
            <p className="text-xs text-slate-400">◯✕がリアルタイムに揃う</p>
          </div>
        </div>

        {/* メインフォーム */}
        <div className="bg-[#1E293B] p-8 rounded-2xl shadow-2xl border border-slate-700">
          
          <div className="mb-8">
            <label className="block text-cyan-400 font-bold mb-2 text-sm uppercase tracking-wider">Event Name</label>
            <input
              type="text"
              className="w-full bg-[#0F172A] border-2 border-slate-700 rounded-xl p-4 text-lg focus:border-cyan-400 focus:ring-0 outline-none transition placeholder-slate-600"
              placeholder="イベント名を入力..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="mb-8">
            <label className="block text-cyan-400 font-bold mb-2 text-sm uppercase tracking-wider">Detail</label>
            <textarea
              className="w-full bg-[#0F172A] border-2 border-slate-700 rounded-xl p-4 text-base focus:border-cyan-400 focus:ring-0 outline-none transition placeholder-slate-600"
              rows={3}
              placeholder="詳細メモ（任意）..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>

          <div className="mb-8">
            <label className="block text-cyan-400 font-bold mb-4 text-sm uppercase tracking-wider">Candidates</label>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="date"
                className="flex-1 bg-[#334155] text-white rounded-lg p-3 outline-none cursor-pointer" // カレンダーアイコンが見えにくいブラウザ対策で背景色調整
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <select
                className="w-full sm:w-32 bg-[#334155] text-white rounded-lg p-3 outline-none"
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
                className="bg-cyan-500 text-black font-black px-6 py-3 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 transition active:scale-95"
              >
                追加
              </button>
            </div>

            {candidates.length > 0 ? (
              <ul className="space-y-2">
                {candidates.map((c, index) => (
                  <li key={index} className="flex justify-between items-center bg-[#0F172A] p-3 rounded-lg border border-slate-700">
                    <span className="font-bold font-mono">{c}</span>
                    <button
                      onClick={() => setCandidates(candidates.filter((_, i) => i !== index))}
                      className="text-slate-500 hover:text-pink-500 font-bold text-sm px-2"
                    >
                      DELETE
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">
                日程を追加してください
              </div>
            )}
          </div>

          <button
            onClick={createEvent}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-black text-xl py-5 rounded-xl hover:opacity-90 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed tracking-widest"
          >
            {isSubmitting ? "CREATING..." : "CREATE EVENT"}
          </button>
        </div>
      </main>
    </div>
  );
}