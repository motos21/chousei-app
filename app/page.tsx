"use client";

import { useState, useEffect } from "react";
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

  // --- 30分刻みの時間リストを生成 ---
  // 例: ["00:00", "00:30", ... "23:30"]
  const timeOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  // --- 候補日を追加する処理 ---
  const addCandidate = () => {
    if (!selectedDate) return;
    
    // 日付のフォーマット整形 (2023-12-01 -> 12/01)
    const dateObj = new Date(selectedDate);
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    
    // 曜日を取得
    const dayStr = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];

    // 結合してリストに追加 (例: 12/10(金) 19:00〜)
    const newCandidate = `${dateStr}(${dayStr}) ${selectedTime}〜`;
    
    // 重複チェック（同じ日時がなければ追加）
    if (!candidates.includes(newCandidate)) {
      setCandidates([...candidates, newCandidate]);
    }
  };

  // --- Firebaseに保存する処理 ---
  const createEvent = async () => {
    if (!title) {
      alert("イベント名を入力してください");
      return;
    }
    if (candidates.length === 0) {
      alert("候補日を少なくとも1つ追加してください");
      return;
    }

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
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <main className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-8 border border-gray-200">
        
        {/* ヘッダー部分 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Smart Scheduler
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            日程調整をシンプルに、スマートに。
          </p>
        </div>

        {/* 1. イベント名 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">イベント名 <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            placeholder="例：Q3 定例ミーティング"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* 2. 詳細メモ */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">詳細・メモ</label>
          <textarea
            className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            rows={3}
            placeholder="Web会議のURLや場所など"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>

        {/* 3. 候補日程の選択エリア */}
        <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-4">候補日程を追加</label>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            {/* カレンダー入力 */}
            <input
              type="date"
              className="flex-1 border border-gray-300 rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            
            {/* 時間選択（30分刻み） */}
            <select
              className="w-32 border border-gray-300 rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            >
              {timeOptions.map((time) => (
                <option key={time} value={time}>{time}〜</option>
              ))}
            </select>

            {/* 追加ボタン */}
            <button
              onClick={addCandidate}
              disabled={!selectedDate}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-md hover:bg-indigo-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              追加
            </button>
          </div>

          {/* 追加済みリスト */}
          {candidates.length > 0 ? (
            <ul className="space-y-2">
              {candidates.map((c, index) => (
                <li key={index} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm border border-gray-100">
                  <span className="font-medium text-gray-700">{c}</span>
                  <button
                    onClick={() => setCandidates(candidates.filter((_, i) => i !== index))}
                    className="text-gray-400 hover:text-red-500 text-sm font-medium transition"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">候補日がまだ追加されていません</p>
          )}
        </div>

        {/* 作成ボタン */}
        <button
          onClick={createEvent}
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg hover:bg-indigo-700 shadow-lg hover:shadow-xl transition disabled:bg-gray-400 disabled:shadow-none"
        >
          {isSubmitting ? "イベントを作成中..." : "イベントを作成する"}
        </button>
      </main>
    </div>
  );
}