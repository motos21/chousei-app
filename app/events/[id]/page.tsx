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
  senderId: string; // ブラウザID（本人確認用）
  createdAt: any;
};

export default function EventPage() {
  const params = useParams();
  const id = params.id as string;

  // --- ステート管理 ---
  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // 出欠入力用
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [myAnswers, setMyAnswers] = useState<{ [key: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // チャット用
  const [chatText, setChatText] = useState("");
  const [chatName, setChatName] = useState("");
  const [browserId, setBrowserId] = useState("");

  // --- 1. 初期化 & データ監視 ---
  useEffect(() => {
    if (!id) return;

    // ブラウザIDの生成・取得（これで「自分」を識別します）
    let myId = localStorage.getItem("chousei_browser_id");
    if (!myId) {
      myId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("chousei_browser_id", myId);
    }
    setBrowserId(myId);

    // A. イベント情報の取得
    const unsubEvent = onSnapshot(doc(db, "events", id), (doc) => {
      if (doc.exists()) {
        setEvent(doc.data() as EventData);
      }
    });

    // B. 参加者リストの取得
    const qParticipants = query(collection(db, "events", id, "participants"), orderBy("created_at", "asc"));
    const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
      setParticipants(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]);
    });

    // C. チャットメッセージの取得（ここを追加！）
    const qMessages = query(collection(db, "events", id, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]);
    });

    return () => {
      unsubEvent();
      unsubParticipants();
      unsubMessages();
    };
  }, [id]);

  // --- 出欠送信 ---
  const submitAnswer = async () => {
    if (!name) return alert("名前を入力してください");
    if (event && Object.keys(myAnswers).length < event.candidates.length) return alert("すべての日程に回答してください");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "events", id, "participants"), {
        name, comment, answers: myAnswers, created_at: serverTimestamp(),
      });
      setName(""); setComment(""); setMyAnswers({});
      // チャット欄の名前も自動で埋めておく（親切機能）
      setChatName(name);
      alert("回答を登録しました！");
    } catch (e) {
      alert("エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- チャット送信 ---
  const sendMessage = async () => {
    if (!chatText) return;
    if (!chatName) return alert("チャット用の名前を入力してください");

    try {
      await addDoc(collection(db, "events", id, "messages"), {
        text: chatText,
        senderName: chatName,
        senderId: browserId, // ここで自分のIDを添付
        createdAt: serverTimestamp(),
      });
      setChatText(""); // 送信後にフォームを空にする
    } catch (e) {
      console.error(e);
    }
  };

  // --- チャット削除 ---
  const deleteMessage = async (messageId: string) => {
    if (confirm("このメッセージを削除しますか？")) {
      await deleteDoc(doc(db, "events", id, "messages", messageId));
    }
  };

  // --- UIヘルパー ---
  const renderSymbol = (status: string) => {
    if (status === "o") return <span className="text-green-500 font-bold text-lg">◎</span>;
    if (status === "t") return <span className="text-yellow-500 font-bold text-lg">△</span>;
    if (status === "x") return <span className="text-red-500 font-bold text-lg">✕</span>;
    return <span className="text-gray-300">-</span>;
  };

  if (!event) return <div className="p-10 text-center">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 font-sans">
      <main className="max-w-5xl mx-auto space-y-8">
        
        {/* イベント詳細カード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-indigo-600 p-6 text-white">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <p className="mt-2 opacity-90 whitespace-pre-wrap">{event.detail}</p>
          </div>

          <div className="p-6 overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-3 text-left w-40">参加者</th>
                  {event.candidates.map((c) => (
                    <th key={c.id} className="p-3 text-center min-w-[80px] bg-indigo-50/50 text-indigo-900 border-l border-white">
                      {c.label}
                    </th>
                  ))}
                  <th className="p-3 text-left w-64 pl-6">コメント</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-700">{p.name}</td>
                    {event.candidates.map((c) => (
                      <td key={c.id} className="p-3 text-center border-l border-gray-100">
                        {renderSymbol(p.answers[c.id])}
                      </td>
                    ))}
                    <td className="p-3 text-gray-500 pl-6">{p.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左カラム: 出欠入力フォーム */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">出欠を入力</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">お名前</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">日程の回答</label>
                <div className="bg-gray-50 p-3 rounded-lg space-y-2 max-h-60 overflow-y-auto">
                  {event.candidates.map((c) => (
                    <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                      <span className="text-sm font-bold text-indigo-900">{c.label}</span>
                      <div className="flex gap-1">
                        {["o", "t", "x"].map((val) => (
                          <button
                            key={val}
                            onClick={() => setMyAnswers({ ...myAnswers, [c.id]: val })}
                            className={`w-8 h-8 rounded text-sm font-bold transition ${
                              myAnswers[c.id] === val 
                                ? (val === "o" ? "bg-green-500 text-white" : val === "t" ? "bg-yellow-400 text-white" : "bg-red-500 text-white")
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            {val === "o" ? "◎" : val === "t" ? "△" : "✕"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">コメント</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded p-2 outline-none"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              <button
                onClick={submitAnswer}
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded hover:bg-indigo-700 transition disabled:opacity-50"
              >
                登録する
              </button>
            </div>
          </div>

          {/* 右カラム: チャットルーム */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">メッセージボード</h2>
            
            {/* メッセージ表示エリア */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2 bg-gray-50 rounded-lg">
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-10">まだメッセージはありません。<br/>何か書き込んでみましょう！</p>
              )}
              {messages.map((msg) => {
                const isMe = msg.senderId === browserId; // 自分の投稿か判定
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="text-xs text-gray-500 mb-1 px-1">{msg.senderName}</div>
                    <div className={`relative max-w-[80%] p-3 rounded-lg text-sm shadow-sm ${
                      isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-gray-200 rounded-bl-none text-gray-800"
                    }`}>
                      {msg.text}
                      {/* 自分の投稿だけ削除ボタンを表示 */}
                      {isMe && (
                        <button 
                          onClick={() => deleteMessage(msg.id)}
                          className="absolute -top-2 -right-2 bg-gray-200 text-gray-500 rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 送信エリア */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="名前"
                  className="w-1/3 border border-gray-300 rounded p-2 text-sm outline-none"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="メッセージを入力..."
                  className="flex-1 border border-gray-300 rounded p-2 text-sm outline-none"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="bg-indigo-600 text-white px-4 rounded hover:bg-indigo-700 text-sm font-bold"
                >
                  送信
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}