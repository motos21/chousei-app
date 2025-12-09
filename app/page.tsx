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

  // --- カレンダー表示用の状態管理 ---
  const [currentDate, setCurrentDate] = useState(new Date()); // 表示中の月

  // --- 期間選択用 ---
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- 共通の時間設定 ---
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

  // --- ヘルパー関数: 日付文字列生成 ---
  // Dateオブジェクトから "12/9(火) 19:00〜" 形式の文字列を作成
  const formatCandidateString = (dateObj: Date, time: string) => {
    const m = dateObj.getMonth() + 1;
    const d = dateObj.getDate();
    const dayStr = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
    return `${m}/${d}(${dayStr}) ${time}〜`;
  };

  // 文字列 "12/9(火) 19:00〜" から日付部分 "12/9" だけ判定用に抽出する簡易ヘルパー
  // (厳密な年管理が必要な場合はロジックを強化してください。今回は簡易版として実装)
  const isSelected = (year: number, month: number, day: number) => {
    // 候補リストの中に、この日付が含まれているかチェック
    // ※年をまたぐ場合などは厳密なID管理推奨ですが、ここでは表示文字列ベースでマッチングさせます
    const searchStr = `${month + 1}/${day}(`; 
    return candidates.some(c => c.startsWith(searchStr));
  };

  // --- カレンダーの日付をクリックした時の処理 ---
  const toggleDate = (year: number, month: number, day: number) => {
    const dateObj = new Date(year, month, day);
    const candidateStr = formatCandidateString(dateObj, selectedTime);

    // 既に候補にあるかチェック（完全一致で判定）
    if (candidates.includes(candidateStr)) {
      setCandidates(candidates.filter(c => c !== candidateStr));
    } else {
      // 日付順に並べ替えて追加したい場合はここでソートロジックを入れる
      // 今回は単純追加（あとでリスト表示側でソートも可能）
      const newCandidates = [...candidates, candidateStr];
      // 簡易ソート: 文字列ベースだと限界があるため、そのまま追加するか、
      // 本格的にやるならオブジェクト{date: Date, str: string}で管理するのがベスト
      setCandidates(newCandidates);
    }
  };

  // --- 期間一括追加 ---
  const addRangeCandidates = () => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      alert("開始日が終了日より後になっています");
      return;
    }

    const newItems: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
       const candidate = formatCandidateString(d, selectedTime);
       if (!candidates.includes(candidate) && !newItems.includes(candidate)) {
         newItems.push(candidate);
       }
    }
    setCandidates([...candidates, ...newItems]);
  };

  // --- カレンダー描画用データ生成 ---
  const renderCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay(); // 1日の曜日
    const lastDate = new Date(year, month + 1, 0).getDate(); // 月の最終日

    const cells = [];
    
    // 空白セル
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-12 w-full"></div>);
    }

    // 日付セル
    for (let day = 1; day <= lastDate; day++) {
      const active = isSelected(year, month, day);
      const isToday = 
        new Date().getDate() === day && 
        new Date().getMonth() === month && 
        new Date().getFullYear() === year;

      cells.push(
        <div 
          key={`day-${day}`}
          onClick={() => toggleDate(year, month, day)}
          className={`
            h-12 w-full flex items-center justify-center cursor-pointer border transition-all duration-200 font-bold relative
            ${active 
              ? "bg-cyan-600 border-cyan-500 text-black shadow-[0_0_15px_rgba(8,145,178,0.5)] z-10" 
              : "bg-[#050505] border-slate-800 text-slate-400 hover:bg-[#1A1A1A] hover:border-slate-600 hover:text-white"
            }
            ${isToday && !active ? "border-cyan-500 text-cyan-500" : ""}
          `}
        >
          {day}
        </div>
      );
    }
    return cells;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // --- イベント作成送信 ---
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

          {/* 候補日程セクション */}
          <div>
            <label className="block text-cyan-500 font-black mb-4 text-xs uppercase tracking-widest pl-1">
              Select Dates / 候補日選択
            </label>
            
            {/* カレンダーエリア全体 */}
            <div className="bg-[#0A0A0A] border-2 border-white p-6">
              
              {/* コントロールエリア (時間 & 期間一括) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-slate-800 pb-8">
                {/* 左: 時間固定 */}
                <div>
                   <label className="text-[10px] text-cyan-500 uppercase tracking-widest font-bold mb-2 block">
                     ① Fixed Time / 時間(固定)
                   </label>
                   <select
                    className="w-full bg-[#111] text-white border border-slate-700 p-3 outline-none focus:border-cyan-500 font-bold"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>{time}〜</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-2">
                    ※ 選択した時間が全ての日程に適用されます
                  </p>
                </div>

                {/* 右: 期間一括追加 */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2 block">
                     ② Range Add / 期間一括追加 (Optional)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input type="date" className="w-1/2 bg-[#111] border border-slate-700 p-2 text-sm [color-scheme:dark] outline-none focus:border-cyan-500"
                      value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <input type="date" className="w-1/2 bg-[#111] border border-slate-700 p-2 text-sm [color-scheme:dark] outline-none focus:border-cyan-500"
                      value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <button
                    onClick={addRangeCandidates}
                    disabled={!startDate || !endDate}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold tracking-widest uppercase disabled:opacity-30 transition"
                  >
                    期間を一括でリストに追加
                  </button>
                </div>
              </div>

              {/* カレンダー本体 */}
              <div className="mb-4">
                 <div className="flex justify-between items-center mb-4">
                    <button onClick={prevMonth} className="text-white hover:text-cyan-500 p-2 font-black text-xl">&lt;</button>
                    <span className="text-xl font-black tracking-widest text-white">
                      {currentDate.getFullYear()} . {currentDate.getMonth() + 1}
                    </span>
                    <button onClick={nextMonth} className="text-white hover:text-cyan-500 p-2 font-black text-xl">&gt;</button>
                 </div>

                 {/* 曜日ヘッダー */}
                 <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                    {["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d => (
                      <div key={d} className="text-[10px] font-bold text-slate-500">{d}</div>
                    ))}
                 </div>

                 {/* 日付グリッド */}
                 <div className="grid grid-cols-7 gap-1">
                    {renderCalendarGrid()}
                 </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 mt-2">
                日付をクリックして ON/OFF を切り替えられます
              </div>

            </div>

            {/* 追加済みリスト表示エリア */}
            <div className="mt-4 border border-white bg-[#0A0A0A]">
              <div className="p-2 bg-[#111] border-b border-white text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Selected Dates List ({candidates.length})
              </div>
              
              {candidates.length > 0 ? (
                <div className="max-h-60 overflow-y-auto">
                  {candidates.map((c, index) => (
                    <div key={index} className="flex justify-between items-center p-4 border-b border-slate-800 last:border-b-0 hover:bg-[#111] transition group">
                      <span className="font-bold font-mono text-lg text-cyan-400 group-hover:text-cyan-300 transition">{c}</span>
                      <button
                        onClick={() => setCandidates(candidates.filter((_, i) => i !== index))}
                        className="text-slate-500 hover:text-red-500 font-bold text-xs uppercase tracking-wider px-2 transition-all"
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-600 text-xs uppercase tracking-widest">
                  NO DATES SELECTED
                </div>
              )}
            </div>
          </div>

          {/* 送信ボタン */}
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