"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  // --- ステート管理 ---
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 日付と時間の入力用
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("19:00");

  const timeOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  // --- 候補日を追加 ---
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

  // --- 作成処理 ---
  const createEvent = async () => {
    if (!title) { alert("イベント名を入力してください"); return; }
    if (candidates.length === 0) { alert("候補日を少なくとも1つ追加してください"); return; }
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "events"), {
        title: title,
        detail: detail,
        candidates: candidates.map((c, i) => ({ id: i, label: c })),
        fee: "", // 会費初期値
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-gray-800">
      <main className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden p-8">
        
        {/* ヘッダー＆ガイドエリア */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-indigo-700 tracking-tight mb-2">
            Smart Scheduler
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            ログイン不要。URLを送るだけの最もシンプルな調整ツール。
          </p>

          {/* おしゃれな3ステップガイド */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left bg-indigo-50/50 rounded-xl p-5 border border-indigo-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mb-2 shadow-sm">1</div>
              <h3 className="font-bold text-sm text-indigo-900">イベントを作る</h3>
              <p className="text-xs text-gray-500 mt-1">名前と候補日を入力して<br/>ページを作成します</p>
            </div>
            <div className="flex flex-col items-center text-center relative">
              {/* 矢印 (PCのみ表示) */}
              <div className="hidden md:block absolute top-3 -left-1/2 w-full h-[1px] bg-indigo-200 -z-10"></div>
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mb-2 shadow-sm z-10">2</div>
              <h3 className="font-bold text-sm text-indigo-900">URLをシェア</h3>
              <p className="text-xs text-gray-500 mt-1">発行されたURLをLINE等で<br/>メンバーに送ります</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mb-2 shadow-sm">3</div>
              <h3 className="font-bold text-sm text-indigo-900">自動で集計</h3>
              <p className="text-xs text-gray-500 mt-1">みんなが回答すると<br/>◯の数やベスト日が分かります</p>
            </div>
          </div>
        </div>

        {/* 入力フォーム */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">イベント名 <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-gray-50 focus:bg-white"
            placeholder="例：Q3 定例ミーティング、忘年会"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">詳細・メモ</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-gray-50 focus:bg-white"
            rows={3}
            placeholder="場所やZoomのURLなど"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>

        <div className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-4">候補日程を追加</label>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="date"
              className="flex-1 border border-gray-300 rounded-lg p-2.5 focus:ring-indigo-500 outline-none"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <select
              className="w-32 border border-gray-300 rounded-lg p-2.5 focus:ring-indigo-500 outline-none bg-white"
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
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-bold disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm"
            >
              追加
            </button>
          </div>

          {candidates.length > 0 ? (
            <ul className="space-y-2">
              {candidates.map((c, index) => (
                <li key={index} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                  <span className="font-medium text-gray-700">{c}</span>
                  <button
                    onClick={() => setCandidates(candidates.filter((_, i) => i !== index))}
                    className="text-gray-400 hover:text-red-500 text-sm font-bold transition"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4 bg-white rounded-lg border border-dashed border-gray-300">
              候補日がまだありません。<br/>上のフォームから追加してください。
            </p>
          )}
        </div>

        <button
          onClick={createEvent}
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 shadow-lg hover:shadow-xl transition disabled:bg-gray-400 disabled:shadow-none transform hover:-translate-y-0.5"
        >
          {isSubmitting ? "イベントを作成中..." : "イベントを作成する"}
        </button>
      </main>
    </div>
  );
}