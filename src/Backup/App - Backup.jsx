import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  Wallet, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  PlusCircle, 
  FileText,
  DollarSign,
  Save,
  History,
  CheckCircle2,
  Plus,
  Minus,
  Filter,
  Check,
  Ban,
  Trash2,
  UserCheck,
  Lock,
  Unlock,
  Info,
  XCircle,
  X,
  Edit3,
  Menu,
  Store,
  ArrowLeft,
  Camera,
  Loader2,
  Receipt,
  AlertCircle,
  Zap,
  ChevronRight,
  CreditCard,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  onSnapshot, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';

// --- API Key disediakan oleh persekitaran runtime (Dikosongkan mengikut arahan) ---
const apiKey = ""; 

// --- Firebase Setup ---
let firebaseConfig;
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
} else {
  firebaseConfig = {
    apiKey: "AIzaSyAdE8cebXj4qox6s33f7ikrA9jyvXZ2fTA",
    authDomain: "salestamtam-c40f0.firebaseapp.com",
    projectId: "salestamtam-c40f0",
    storageBucket: "salestamtam-c40f0.firebasestorage.app",
    messagingSenderId: "373200023968",
    appId: "1:373200023968:web:18e843716ca06b378ab4c5",
    measurementId: "G-VC59MMG97Z"
  };
}

const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics tidak disokong di dalam persekitaran ini.", e);
}

const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tamtam-erp-default';

// ============================================================================
// KOMPONEN POP-UP RESITSCAN PRO (100% Kod Pengguna Yang Diintegrasikan)
// ============================================================================
const ReceiptScannerProPopup = ({ isOpen, onClose, onApply }) => {
  const [image, setImage] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState(null);
  const [scannedData, setScannedData] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('scanner'); 
  
  const fileInputRef = useRef(null);

  // Muat sejarah dari localStorage dengan kawalan keselamatan ralat
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('receipt_history_pro');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        setHistory(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.warn("Gagal memuatkan sejarah", e);
      setHistory([]);
    }
  }, []);

  // Simpan sejarah apabila berubah
  useEffect(() => {
    localStorage.setItem('receipt_history_pro', JSON.stringify(Array.isArray(history) ? history : []));
  }, [history]);

  // LOGIK KELAJUAN: Mampatkan imej dengan agresif sebelum hantar ke AI
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Saiz 1000px adalah 'sweet spot' untuk kelajuan muat naik vs ketajaman teks AI
          const MAX_SIZE = 1000;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Kualiti 0.6 mengurangkan saiz fail sehingga 90% tanpa merosakkan teks
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          resolve(compressedBase64);
        };
      };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsCompressing(true);
      setError(null);
      try {
        const compressed = await compressImage(file);
        setImage(compressed);
        setBase64Image(compressed.split(',')[1]);
        setScannedData(null);
      } catch (err) {
        setError("Gagal memproses imej. Sila gunakan format yang sah.");
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const processReceipt = async () => {
    if (!base64Image) return;

    setLoading(true);
    setError(null);

    // Prompt dioptimumkan untuk respon JSON terpantas
    const systemPrompt = `Analyze receipt. Return ONLY JSON:
    {
      "merchant": "Store Name",
      "date": "YYYY-MM-DD",
      "items": [{"description": "Item name", "price": 0.00}],
      "total": 0.00,
      "currency": "RM"
    }`;

    const payload = {
      contents: [{
        role: "user",
        parts: [
          { text: "Extract receipt data fast." },
          { inlineData: { mimeType: "image/jpeg", data: base64Image } }
        ]
      }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
      }
    };

    const fetchWithRetry = async (retries = 0) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
           const errorData = await response.json();
           throw new Error(errorData.error?.message || 'API Error');
        }
        
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
          throw new Error("Tiada data teks dikembalikan oleh AI.");
        }

        // PEMBETULAN: Bersihkan markdown jika AI memulangkan blok kod JSON
        const cleanJsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJsonText);
      } catch (err) {
        if (retries < 2) { // Kurangkan retry untuk kelajuan
          await new Promise(res => setTimeout(res, 1000));
          return fetchWithRetry(retries + 1);
        }
        throw err;
      }
    };

    try {
      const data = await fetchWithRetry();
      setScannedData(data);
    } catch (err) {
      console.error("AI Error:", err);
      setError(`AI Gagal Memproses: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = () => {
    if (!scannedData) return;
    const newEntry = {
      id: Date.now(),
      ...scannedData,
      image: image,
      timestamp: new Date().toLocaleString('ms-MY')
    };
    
    const currentHistory = Array.isArray(history) ? history : [];
    setHistory([newEntry, ...currentHistory]);
    
    // INTEGRASI DENGAN TAMTAM ERP (Hantar data ke borang)
    if (onApply) {
      onApply(scannedData);
    }

    setScannedData(null);
    setImage(null);
    setBase64Image(null);
    setView('history');

    // Tutup popup secara automatik selepas simpan
    if (onClose) onClose();
  };

  const deleteHistoryItem = (id) => {
    const currentHistory = Array.isArray(history) ? history : [];
    setHistory(currentHistory.filter(item => item.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 text-slate-900 font-sans selection:bg-indigo-100">
      
      {/* Kotak Pop-up Utama */}
      <div className="bg-[#F8FAFC] w-full max-w-5xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Navigation */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-800 leading-none">ResitScan Pro</h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Turbo Engine v2.5</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button 
                onClick={() => setView('scanner')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${view === 'scanner' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Scanner
              </button>
              <button 
                onClick={() => setView('history')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${view === 'history' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Laporan
              </button>
            </div>
            
            {/* Butang Tutup Pop-Up */}
            <button onClick={onClose} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </nav>

        {/* Mobile Tab Nav (Khas skrin kecil) */}
        <div className="w-full sm:hidden flex bg-white px-4 py-2 border-b border-slate-200 shrink-0">
          <div className="flex w-full bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setView('scanner')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${view === 'scanner' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Scanner
            </button>
            <button 
              onClick={() => setView('history')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${view === 'history' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Laporan
            </button>
          </div>
        </div>

        {/* Container Scrollable Dalaman */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {view === 'scanner' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Upload Section */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-2 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-slate-800">Tangkap Resit</h2>
                      <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1">
                        <Zap size={12} /> FAST OCR
                      </div>
                    </div>
                    
                    {!image && !isCompressing ? (
                      <div 
                        onClick={() => fileInputRef.current.click()}
                        className="border-2 border-dashed border-slate-200 rounded-[1.5rem] p-12 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group relative overflow-hidden"
                      >
                        <div className="bg-indigo-50 p-5 rounded-3xl mb-4 group-hover:scale-110 transition-transform duration-300">
                          <Camera className="w-10 h-10 text-indigo-500" />
                        </div>
                        <p className="text-slate-700 font-bold">Tekan untuk muat naik</p>
                        <p className="text-slate-400 text-xs mt-2 text-center px-4">Imej akan dioptimumkan secara automatik untuk kelajuan maksimum.</p>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                        />
                      </div>
                    ) : isCompressing ? (
                      <div className="border-2 border-dashed border-indigo-100 bg-indigo-50/50 rounded-[1.5rem] p-12 flex flex-col items-center justify-center animate-pulse">
                        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
                        <p className="text-indigo-700 font-bold">Mengecilkan Saiz...</p>
                      </div>
                    ) : (
                      <div className="relative rounded-[1.5rem] overflow-hidden bg-slate-900 border border-slate-200 aspect-[3/4] shadow-inner">
                        <img src={image} alt="Preview" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                        <button 
                          onClick={() => { setImage(null); setBase64Image(null); setScannedData(null); }}
                          className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-red-500 transition-all border border-white/20"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    )}

                    {image && !scannedData && !loading && (
                      <button 
                        onClick={processReceipt}
                        className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-600 active:scale-95 transition-all shadow-xl shadow-slate-200"
                      >
                        Mula Imbasan Pantas
                        <ChevronRight size={20} />
                      </button>
                    )}

                    {loading && (
                      <div className="w-full mt-6 bg-indigo-50 text-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 border border-indigo-100">
                        <Loader2 className="animate-spin" size={20} />
                        AI Sedang Membaca...
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 p-5 rounded-2xl flex items-start gap-4 animate-in fade-in zoom-in-95">
                    <AlertCircle className="shrink-0 mt-0.5 text-rose-500" size={24} />
                    <div>
                      <p className="font-bold">Masalah Dikesan</p>
                      <p className="text-sm opacity-90">{error}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Results Section */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 min-h-[500px] flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-indigo-600" size={24} />
                      <h2 className="text-xl font-extrabold text-slate-800">Data Pengekstrakan</h2>
                    </div>
                    {scannedData && (
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        Ready to Save
                      </span>
                    )}
                  </div>

                  {!scannedData && !loading && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                      <div className="bg-slate-50 p-8 rounded-full mb-6">
                        <Receipt size={64} className="text-slate-200" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700">Menunggu Imbasan</h3>
                      <p className="text-slate-400 text-sm max-w-[280px] mt-2">Sila muat naik imej resit di sebelah untuk memulakan pengekstrakan data automatik.</p>
                    </div>
                  )}

                  {loading && (
                    <div className="flex-1 p-8 space-y-8 animate-pulse">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-16 bg-slate-100 rounded-2xl" />
                        <div className="h-16 bg-slate-100 rounded-2xl" />
                      </div>
                      <div className="space-y-4">
                        <div className="h-4 bg-slate-100 rounded-full w-1/4" />
                        <div className="h-32 bg-slate-50 rounded-2xl" />
                      </div>
                      <div className="h-20 bg-slate-100 rounded-2xl" />
                    </div>
                  )}

                  {scannedData && (
                    <div className="flex-1 p-8 flex flex-col animate-in fade-in duration-500">
                      <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Merchant / Pembekal</label>
                          <div className="text-lg font-bold text-slate-800 truncate border-b-2 border-indigo-50 pb-1">
                            {typeof scannedData.merchant === 'object' ? JSON.stringify(scannedData.merchant) : scannedData.merchant || 'Tiada Nama'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Tarikh Urusniaga</label>
                          <div className="text-lg font-bold text-slate-800 border-b-2 border-indigo-50 pb-1">
                            {typeof scannedData.date === 'object' ? JSON.stringify(scannedData.date) : scannedData.date || 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Senarai Perolehan</label>
                          <span className="text-xs font-bold text-slate-400">{Array.isArray(scannedData.items) ? scannedData.items.length : 0} items</span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-h-[250px] overflow-y-auto custom-scrollbar">
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-100">
                              {(Array.isArray(scannedData.items) ? scannedData.items : []).map((item, idx) => (
                                <tr key={idx} className="group">
                                  <td className="py-3 pr-3 text-slate-700 font-medium group-hover:text-indigo-600 transition-colors">
                                    {typeof item.description === 'object' ? JSON.stringify(item.description) : item.description}
                                  </td>
                                  <td className="py-3 pl-3 text-right font-mono font-bold text-slate-900">
                                    {typeof scannedData.currency === 'object' ? JSON.stringify(scannedData.currency) : scannedData.currency || 'RM'} {Number(item.price || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mt-8 pt-8 border-t-2 border-dashed border-slate-100 flex flex-col md:flex-row justify-between items-center md:items-end gap-4">
                        <div className="text-center md:text-left">
                          <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Jumlah Bayaran</p>
                          <p className="text-4xl font-black text-indigo-600 font-mono tracking-tighter">
                            {typeof scannedData.currency === 'object' ? JSON.stringify(scannedData.currency) : scannedData.currency || 'RM'} {Number(scannedData.total || 0).toFixed(2)}
                          </p>
                        </div>
                        <button 
                          onClick={saveToHistory}
                          className="bg-indigo-600 text-white w-full md:w-auto px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 group active:scale-95"
                        >
                          <Save className="group-hover:scale-110 transition-transform hidden sm:block" />
                          Simpan & Pindah Borang
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* History/Report View */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                  <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Belanja</p>
                    <p className="text-2xl font-black text-slate-800 font-mono">RM {(Array.isArray(history) ? history : []).reduce((acc, curr) => acc + Number(curr.total || 0), 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                  <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
                    <Receipt size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resit Direkod</p>
                    <p className="text-2xl font-black text-slate-800 font-mono">{(Array.isArray(history) ? history : []).length}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                  <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status Claim</p>
                    <p className="text-2xl font-black text-slate-800 font-mono">Siap</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                  <h2 className="text-2xl font-black text-slate-800">Senarai Arkib</h2>
                  <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
                    Filter: Semua Bulan
                  </div>
                </div>

                {(!history || history.length === 0) ? (
                  <div className="p-24 text-center">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <History size={32} className="text-slate-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Tiada Rekod Tersimpan</h3>
                    <p className="text-slate-400 text-sm">Resit yang anda simpan akan dipaparkan di sini.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(Array.isArray(history) ? history : []).map((item) => (
                      <div key={item.id} className="p-6 md:p-8 flex flex-col md:flex-row gap-6 hover:bg-indigo-50/20 transition-all group">
                        <div className="w-24 h-32 md:w-28 md:h-36 bg-slate-100 rounded-2xl shrink-0 overflow-hidden border border-slate-200 shadow-sm group-hover:shadow-md transition-shadow">
                          <img src={item.image} alt="Receipt thumbnail" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 flex flex-col md:flex-row justify-between gap-6">
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-xl font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                {typeof item.merchant === 'object' ? JSON.stringify(item.merchant) : item.merchant}
                              </h3>
                              <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                <span className="flex items-center gap-1.5"><FileText size={12} /> {typeof item.date === 'object' ? JSON.stringify(item.date) : item.date}</span>
                                <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={12} /> Tersimpan</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {(Array.isArray(item.items) ? item.items : []).slice(0, 3).map((li, i) => (
                                <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200">
                                  {typeof li.description === 'object' ? JSON.stringify(li.description) : li.description}
                                </span>
                              ))}
                              {(Array.isArray(item.items) ? item.items : []).length > 3 && (
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-100">
                                  +{(item.items || []).length - 3} item lagi
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-start md:items-end justify-between min-w-[150px]">
                            <div className="text-left md:text-right w-full flex justify-between md:block">
                              <div>
                                <p className="text-3xl font-black text-slate-900 font-mono tracking-tighter">
                                  {typeof item.currency === 'object' ? JSON.stringify(item.currency) : item.currency || 'RM'} {Number(item.total || 0).toFixed(2)}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.timestamp}</p>
                              </div>
                              <div className="flex gap-2 items-center md:items-end">
                                <button 
                                  onClick={() => deleteHistoryItem(item.id)}
                                  className="text-slate-300 hover:text-rose-500 p-2.5 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
// ============================================================================
// TAMAT KOMPONEN RESITSCAN PRO
// ============================================================================


// MAIN APP (TAM-TAM ERP)
const App = () => {
  // Branch Selection State
  const [selectedBranch, setSelectedBranch] = useState(null); 
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // States Data untuk Cawangan Spesifik
  const [salesData, setSalesData] = useState([]);
  const [expensesData, setExpensesData] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [capitalExpenses, setCapitalExpenses] = useState([]);

  // States Khas untuk MASTER DASHBOARD (Gabungan)
  const [masterStats, setMasterStats] = useState({
    tamtam: { earning: 0, legacyExp: 0, expense: 0 },
    ayam: { earning: 0, legacyExp: 0, expense: 0 }
  });

  // Forms & Inputs
  const [formSales, setFormSales] = useState({ date: new Date().toISOString().split('T')[0], walkin: '', panda: '', grab: '', misi: '' });
  const [formExpense, setFormExpense] = useState({ date: new Date().toISOString().split('T')[0], category: 'Kos Mentah (COGS)', amount: '', description: '' });
  const [newInventoryItem, setNewInventoryItem] = useState({ name: '', stock: '', unit: '' });
  const [manualStockInputs, setManualStockInputs] = useState({});
  const [formCapital, setFormCapital] = useState({ description: '', cost: '', date: new Date().toISOString().split('T')[0], details: '', paidBy: '1' });
  const [partnersConfig, setPartnersConfig] = useState([ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ]);

  // Dropdown Notes State untuk ROI
  const [expandedCapitalNotes, setExpandedCapitalNotes] = useState({});

  // Modals & UI Toggles
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [inventoryToDelete, setInventoryToDelete] = useState(null);
  
  // Edit & Delete Modal/Asset states
  const [capitalToDelete, setCapitalToDelete] = useState(null);
  const [editingCapital, setEditingCapital] = useState(null);
  const [editCapitalForm, setEditCapitalForm] = useState({ description: '', cost: '', date: '', details: '', paidBy: '1' });
  
  // Import feature
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [pendingSyncData, setPendingSyncData] = useState(null);
  const fileInputRef = useRef(null);
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Error handling
  const [dbError, setDbError] = useState(null);
  const [formError, setFormError] = useState(null); 

  // 1. Auth Logic
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenError) {
            console.warn("Token tersuai tidak sah, beralih ke log masuk tanpa nama...");
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        if (error.code === 'auth/configuration-not-found') {
           setDbError("Modul Authentication belum diaktifkan untuk projek ini.");
        } else {
           setDbError(`Ralat Pengesahan: ${error.message}`);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2A. Data Fetching (MASTER DASHBOARD - Latar Belakang)
  useEffect(() => {
    if (!user || selectedBranch) return; 
    const unsubscribes = [];
    const fetchBranchStats = (branch) => {
      const salesCol = collection(db, 'artifacts', appId, 'public', 'data', `sales_${branch}`);
      const expCol = collection(db, 'artifacts', appId, 'public', 'data', `expenses_${branch}`);
      unsubscribes.push(onSnapshot(salesCol, (snap) => {
        let earning = 0; let legacyExp = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          earning += Number(d.walkin||0) + Number(d.panda||0) + Number(d.grab||0) + Number(d.misi||0);
          legacyExp += Number(d.cogs||0) + Number(d.opex||0);
        });
        setMasterStats(prev => ({ ...prev, [branch]: { ...prev[branch], earning, legacyExp } }));
      }));
      unsubscribes.push(onSnapshot(expCol, (snap) => {
        let expense = 0; snap.docs.forEach(doc => { expense += Number(doc.data().amount||0); });
        setMasterStats(prev => ({ ...prev, [branch]: { ...prev[branch], expense } }));
      }));
    };
    fetchBranchStats('tamtam'); fetchBranchStats('ayam');
    return () => unsubscribes.forEach(u => u());
  }, [user, selectedBranch]);


  // 2B. Data Fetching (CAWANGAN SPESIFIK)
  useEffect(() => {
    if (!user || !selectedBranch) return; 
    const handleSnapshotError = (err) => { setDbError(err.code === 'permission-denied' ? "Ralat Akses Pangkalan Data." : err.message); };
    const colSuffix = `_${selectedBranch}`;
    
    const salesCol = collection(db, 'artifacts', appId, 'public', 'data', `sales${colSuffix}`);
    const unsubscribeSales = onSnapshot(salesCol, (snapshot) => { const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); data.sort((a, b) => new Date(a.date) - new Date(b.date)); setSalesData(data); }, handleSnapshotError);
    
    const expDocCol = collection(db, 'artifacts', appId, 'public', 'data', `expenses${colSuffix}`);
    const unsubscribeExpenses = onSnapshot(expDocCol, (snapshot) => { const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); data.sort((a, b) => new Date(a.date) - new Date(b.date)); setExpensesData(data); }, handleSnapshotError);
    
    const invCol = collection(db, 'artifacts', appId, 'public', 'data', `inventory${colSuffix}`);
    const unsubscribeInv = onSnapshot(invCol, (snapshot) => { if (!snapshot.empty) setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, handleSnapshotError);
    
    const logsCol = collection(db, 'artifacts', appId, 'public', 'data', `stockLogs${colSuffix}`);
    const unsubscribeLogs = onSnapshot(logsCol, (snapshot) => { const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); logs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); setStockLogs(logs.slice(0, 10)); }, handleSnapshotError);
    
    const capExpCol = collection(db, 'artifacts', appId, 'public', 'data', `capital_expenses${colSuffix}`);
    const unsubscribeCapExp = onSnapshot(capExpCol, (snapshot) => { const exps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); exps.sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0)); setCapitalExpenses(exps); }, handleSnapshotError);
    
    const partnersDoc = doc(db, 'artifacts', appId, 'public', 'data', 'settings', `partners_config${colSuffix}`);
    const unsubscribePartners = onSnapshot(partnersDoc, (docSnap) => {
      const defaultP = [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];
      if (docSnap.exists() && Array.isArray(docSnap.data().partners) && docSnap.data().partners.length > 0) {
        setPartnersConfig(docSnap.data().partners);
      } else {
        setDoc(partnersDoc, { partners: defaultP }, { merge: true }).catch(err => console.error(err));
        setPartnersConfig(defaultP);
      }
    }, handleSnapshotError);
    return () => { unsubscribeSales(); unsubscribeExpenses(); unsubscribeInv(); unsubscribeLogs(); unsubscribeCapExp(); unsubscribePartners(); };
  }, [user, selectedBranch]);

  const stats = useMemo(() => {
    let totalCapital = 0;
    const partnerCapitals = { '1': 0, '2': 0 };
    
    (capitalExpenses || []).forEach(exp => {
      const cost = Number(exp.cost || 0);
      totalCapital += cost;
      if(partnerCapitals[exp.paidBy] !== undefined) {
        partnerCapitals[exp.paidBy] += cost;
      }
    });

    const safePartners = partnersConfig && partnersConfig.length > 0 ? partnersConfig : [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];

    const computedPartners = safePartners.map(p => {
      const amount = partnerCapitals[p.id] || 0;
      const equity = totalCapital > 0 ? (amount / totalCapital) * 100 : (100 / safePartners.length);
      return { ...p, amount, equity };
    });

    let totalEarning = 0;
    let totalExpense = 0;

    (salesData || []).forEach(day => {
      totalEarning += Number(day.walkin || 0) + Number(day.panda || 0) + Number(day.grab || 0) + Number(day.misi || 0);
      totalExpense += Number(day.cogs || 0) + Number(day.opex || 0); 
    });

    (expensesData || []).forEach(exp => {
      totalExpense += Number(exp.amount || 0);
    });

    let netProfit = totalEarning - totalExpense;

    const roiProgress = totalCapital > 0 ? (netProfit / totalCapital) * 100 : 0;
    const allSigned = computedPartners.length > 0 && computedPartners.every(p => p.signed);

    return { totalCapital, computedPartners, totalEarning, totalExpense, netProfit, roiProgress, allSigned };
  }, [salesData, expensesData, capitalExpenses, partnersConfig]);

  const monthlyStats = useMemo(() => {
    const grouped = {};
    (salesData || []).forEach(sale => {
      const month = sale.date.substring(0, 7); 
      if (!grouped[month]) {
        grouped[month] = { earning: 0, expense: 0, profit: 0, walkin: 0, apps: 0 };
      }
      const apps = Number(sale.panda || 0) + Number(sale.grab || 0) + Number(sale.misi || 0);
      const dayEarning = Number(sale.walkin || 0) + apps;
      const legacyCost = Number(sale.cogs || 0) + Number(sale.opex || 0); 
      
      grouped[month].earning += dayEarning;
      grouped[month].expense += legacyCost;
      grouped[month].walkin += Number(sale.walkin || 0);
      grouped[month].apps += apps;
    });

    (expensesData || []).forEach(exp => {
      const month = exp.date.substring(0, 7);
      if (!grouped[month]) {
        grouped[month] = { earning: 0, expense: 0, profit: 0, walkin: 0, apps: 0 };
      }
      grouped[month].expense += Number(exp.amount || 0);
    });
    
    Object.keys(grouped).forEach(m => {
      grouped[m].profit = grouped[m].earning - grouped[m].expense;
    });

    return Object.entries(grouped)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month)); 
  }, [salesData, expensesData]);

  const handleActionError = (e) => {
    console.error(e);
    if (e.code === 'permission-denied') {
      setDbError("Sistem dihalang untuk menyimpan data. Sila semak Firestore Security Rules anda.");
    }
  };

  const handleAddCapitalExpense = async () => {
    if (!user || !formCapital.description || !formCapital.cost) return;
    try {
      const capExpCol = collection(db, 'artifacts', appId, 'public', 'data', `capital_expenses_${selectedBranch}`);
      await addDoc(capExpCol, {
        description: formCapital.description,
        cost: Number(formCapital.cost),
        paymentDate: formCapital.date,
        details: formCapital.details,
        paidBy: formCapital.paidBy,
        createdAt: new Date().toISOString()
      });
      
      const safePartners = partnersConfig && partnersConfig.length > 0 ? partnersConfig : [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];
      const resetPartners = safePartners.map(p => ({ ...p, signed: false, signedAt: null }));
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', `partners_config_${selectedBranch}`), { partners: resetPartners });
      
      setFormCapital({ description: '', cost: '', date: new Date().toISOString().split('T')[0], details: '', paidBy: '1' });
    } catch (e) { handleActionError(e); }
  };

  const handleDeleteCapitalExpense = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `capital_expenses_${selectedBranch}`, id));
      
      const safePartners = partnersConfig && partnersConfig.length > 0 ? partnersConfig : [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];
      const resetPartners = safePartners.map(p => ({ ...p, signed: false, signedAt: null }));
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', `partners_config_${selectedBranch}`), { partners: resetPartners });
    } catch (e) { handleActionError(e); }
  };

  const handleUpdateCapitalExpense = async () => {
    if (!user || !editingCapital) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `capital_expenses_${selectedBranch}`, editingCapital);
      await updateDoc(docRef, {
        description: editCapitalForm.description,
        cost: Number(editCapitalForm.cost),
        paymentDate: editCapitalForm.date,
        details: editCapitalForm.details,
        paidBy: editCapitalForm.paidBy
      });
      
      const safePartners = partnersConfig && partnersConfig.length > 0 ? partnersConfig : [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];
      const resetPartners = safePartners.map(p => ({ ...p, signed: false, signedAt: null }));
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', `partners_config_${selectedBranch}`), { partners: resetPartners });

      setEditingCapital(null);
    } catch (e) { handleActionError(e); }
  };

  const handleToggleSignature = async (partnerId) => {
    if (!user) return;
    try {
      const safePartners = partnersConfig && partnersConfig.length > 0 ? partnersConfig : [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];
      const updated = safePartners.map(p => {
        if (p.id === partnerId) {
          const isSigning = !p.signed;
          return { ...p, signed: isSigning, signedAt: isSigning ? new Date().toLocaleString('ms-MY') : null };
        }
        return p;
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', `partners_config_${selectedBranch}`), { partners: updated }, { merge: true });
    } catch (e) { handleActionError(e); }
  };

  const toggleCapitalNote = (id) => {
    setExpandedCapitalNotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleAddInventoryItem = async () => {
    if (!user) return;
    if (!newInventoryItem.name || !newInventoryItem.unit) {
      setFormError("Sila isikan Nama Item dan Unit Ukuran terlebih dahulu.");
      setTimeout(() => setFormError(null), 3000); 
      return;
    }
    try {
      const invCol = collection(db, 'artifacts', appId, 'public', 'data', `inventory_${selectedBranch}`);
      await addDoc(invCol, {
        item: newInventoryItem.name,
        stock: Number(newInventoryItem.stock || 0),
        unit: newInventoryItem.unit
      });
      setNewInventoryItem({ name: '', stock: '', unit: '' });
      setFormError(null);
    } catch (err) { handleActionError(err); }
  };

  const confirmDeleteInventory = async () => {
    if (!user || !inventoryToDelete) return;
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `inventory_${selectedBranch}`, inventoryToDelete));
        setInventoryToDelete(null);
    } catch (e) { handleActionError(e); }
  };

  const handleUpdateStockManual = async (itemId, currentStock, type) => {
    if (!user) return;
    
    const rawInput = manualStockInputs[itemId];
    const inputVal = (rawInput === undefined || rawInput === '') ? 1 : Number(rawInput);
    if (inputVal <= 0) return;

    const change = type === 'restock' ? inputVal : -inputVal;
    const newStock = Math.max(0, currentStock + change);
    
    try {
      const itemDoc = doc(db, 'artifacts', appId, 'public', 'data', `inventory_${selectedBranch}`, itemId);
      await updateDoc(itemDoc, { stock: newStock });
      const logsCol = collection(db, 'artifacts', appId, 'public', 'data', `stockLogs_${selectedBranch}`);
      const item = inventory.find(i => i.id === itemId);
      await addDoc(logsCol, { itemId, itemName: item.item, change, type, timestamp: serverTimestamp() });
      setManualStockInputs(prev => ({ ...prev, [itemId]: '' }));
    } catch (err) { handleActionError(err); }
  };

  const handleSaveSales = async () => {
    if (!user) return;
    try {
      const salesCol = collection(db, 'artifacts', appId, 'public', 'data', `sales_${selectedBranch}`);
      await addDoc(salesCol, {
        date: formSales.date,
        walkin: Number(formSales.walkin), panda: Number(formSales.panda),
        grab: Number(formSales.grab), misi: Number(formSales.misi),
        createdAt: new Date().toISOString()
      });
      const [year, month, day] = formSales.date.split('-').map(Number);
      const nextDateObj = new Date(year, month - 1, day + 1);
      const nextDateStr = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth() + 1).padStart(2, '0')}-${String(nextDateObj.getDate()).padStart(2, '0')}`;

      setFormSales({ date: nextDateStr, walkin: '', panda: '', grab: '', misi: '' });
    } catch (e) { handleActionError(e); }
  };

  const handleSaveExpense = async () => {
    if (!user || !formExpense.amount) {
      setFormError("Sila masukkan jumlah RM perbelanjaan.");
      setTimeout(() => setFormError(null), 3000);
      return;
    }
    try {
      const expCol = collection(db, 'artifacts', appId, 'public', 'data', `expenses_${selectedBranch}`);
      await addDoc(expCol, {
        date: formExpense.date,
        category: formExpense.category,
        amount: Number(formExpense.amount),
        description: formExpense.description,
        createdAt: new Date().toISOString()
      });

      setFormExpense(prev => ({ ...prev, amount: '', description: '' }));
    } catch (e) { handleActionError(e); }
  };

  const confirmDeleteSale = async () => {
    if (!user || !saleToDelete) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `sales_${selectedBranch}`, saleToDelete)); setSaleToDelete(null); } catch (e) { handleActionError(e); }
  };

  const confirmDeleteExpense = async () => {
    if (!user || !expenseToDelete) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `expenses_${selectedBranch}`, expenseToDelete)); setExpenseToDelete(null); } catch (e) { handleActionError(e); }
  };
  
  const confirmDeleteCapitalExpense = async () => {
    if (!user || !capitalToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `capital_expenses_${selectedBranch}`, capitalToDelete));
      const safePartners = partnersConfig && partnersConfig.length > 0 ? partnersConfig : [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];
      const resetPartners = safePartners.map(p => ({ ...p, signed: false, signedAt: null }));
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', `partners_config_${selectedBranch}`), { partners: resetPartners });
      setCapitalToDelete(null);
    } catch (e) { handleActionError(e); }
  };

  const expectedCategory = selectedBranch === 'tamtam' ? 'BURGER' : 'KIOSK';
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    setUploadSuccess(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        setIsUploading(false);
        return; 
      }

      const rawItems = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim());
        
        if (cols.length >= 9) {
          const itemName = cols[0]; 
          const category = cols[2]; 
          const netSales = parseFloat(cols[8].replace(/,/g, '')) || 0; 
          
          if (itemName) {
             rawItems.push({ item: itemName, category: category, net_sales: netSales, channel: 'Walk-in' });
          }
        }
      }

      const branchItems = rawItems.filter(i => i.category && i.category.toUpperCase().includes(expectedCategory));
      const excludedItems = rawItems.filter(i => !i.category || !i.category.toUpperCase().includes(expectedCategory));

      const summary = {
        date: importDate,
        walkin: branchItems.reduce((s, i) => s + i.net_sales, 0),
        panda: 0, grab: 0, misi: 0, cogs: 0, opex: 0, 
        fileName: file.name
      };

      setPendingSyncData({ rawItems, branchItems, excludedItems, summary });
      setIsUploading(false);
      event.target.value = null; 
    };
    reader.readAsText(file);
  };
  
  const handleConfirmSync = async () => {
    if (!pendingSyncData || !user) return;
    try {
      setIsUploading(true);
      const salesCol = collection(db, 'artifacts', appId, 'public', 'data', `sales_${selectedBranch}`);
      await addDoc(salesCol, { 
        ...pendingSyncData.summary,
        source: `Loyverse Export: ${pendingSyncData.summary.fileName}`,
        createdAt: new Date().toISOString()
      });
      setIsUploading(false);
      setUploadSuccess(true);
      setPendingSyncData(null);
    } catch (e) { handleActionError(e); setIsUploading(false); }
  };
  
  const triggerFileInput = () => fileInputRef.current?.click();

  const switchTab = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleLogoutBranch = () => {
    setSelectedBranch(null);
    setActiveTab('overview');
  };

  if (!user && !dbError) return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Menghubungkan ke Cloud...</p>
      </div>
    </div>
  );

  if (user && !selectedBranch && !dbError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-orange-600/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="z-10 w-full max-w-4xl text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-lg">TamTam ERP</h1>
          </div>
          <p className="text-slate-400 mb-12 font-medium tracking-widest uppercase text-xs md:text-sm">Pilih Bahagian Perniagaan Untuk Diuruskan</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
            <button 
              onClick={() => { setSelectedBranch('tamtam'); setActiveTab('overview'); }} 
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-orange-500/50 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/20 active:scale-95"
            >
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl mb-6 overflow-hidden bg-black p-2 shadow-xl group-hover:scale-105 transition-transform duration-300">
                 <img src="/tamtam-logo.jpg" alt="TamTam Burger" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mb-2">TamTam Burger</h2>
              <span className="text-xs font-bold uppercase tracking-widest text-orange-400 bg-orange-500/10 px-3 py-1 rounded-lg">Kategori Burger</span>
            </button>

            <button 
              onClick={() => { setSelectedBranch('ayam'); setActiveTab('overview'); }} 
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-red-500/50 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-500/20 active:scale-95"
            >
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl mb-6 overflow-hidden bg-black shadow-xl group-hover:scale-105 transition-transform duration-300 flex items-center justify-center relative">
                 <img src="/brosmart-logo.jpg" alt="Ayam Gunting" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-tr from-red-600/20 to-transparent pointer-events-none"></div>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mb-2">Ayam Gunting</h2>
              <span className="text-xs font-bold uppercase tracking-widest text-red-400 bg-red-500/10 px-3 py-1 rounded-lg">Kategori Kiosk</span>
            </button>
          </div>
          
          <div className="mt-16 flex items-center justify-center gap-3 opacity-60">
             <img src="/hgv-logo.jpg" alt="HGV" className="h-6 rounded bg-white px-1" />
             <span className="text-xs font-bold">x</span>
             <img src="/brosmart-logo.jpg" alt="Bros Mart" className="h-6 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />

      {/* Komponen ResitScan Pro (Dipanggil sebagai Modal Pop-Up) */}
      <ReceiptScannerProPopup 
        isOpen={isScannerModalOpen} 
        onClose={() => setIsScannerModalOpen(false)} 
        onApply={(scannedData) => {
          const itemsArr = Array.isArray(scannedData.items) ? scannedData.items : [];
          const itemsText = itemsArr.map(i => typeof i.description === 'object' ? JSON.stringify(i.description) : i.description).join(', ');
          const merchantText = typeof scannedData.merchant === 'object' ? JSON.stringify(scannedData.merchant) : scannedData.merchant;
          const mergedDesc = `${merchantText ? merchantText + ' - ' : ''}${itemsText || ''}`.substring(0, 150);
          
          setFormExpense(prev => ({
            ...prev,
            amount: Number(scannedData.total || 0) || prev.amount,
            description: mergedDesc
          }));
        }}
      />

      {/* Modal Paparan Error Firebase Config */}
      {dbError && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
            <AlertTriangle size={64} className="text-rose-500 mx-auto mb-4" />
            <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 tracking-tight">Maklumat Pangkalan Data</h3>
            <p className="text-sm text-slate-600 mb-6 font-medium leading-relaxed">{dbError}</p>
            <button onClick={() => setDbError(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-black transition-colors">Tutup Notis Ini</button>
          </div>
        </div>
      )}

      {/* Mobile Header (Hanya nampak di skrin kecil) */}
      <div className="md:hidden flex justify-between items-center bg-slate-900 text-white p-4 z-30 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          {selectedBranch === 'tamtam' ? (
             <img src="/tamtam-logo.jpg" alt="TamTam Logo" className="w-10 h-10 rounded-lg object-contain shadow-lg bg-black p-0.5 border border-slate-700" onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=T&background=000&color=fff&rounded=true'; }} />
          ) : (
             <img src="/brosmart-logo.jpg" alt="Ayam Gunting Logo" className="w-10 h-10 rounded-lg object-cover shadow-lg border border-red-700/50" onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=A&background=dc2626&color=fff&rounded=true'; }} />
          )}
          <div>
            <h1 className="text-lg font-black leading-none tracking-tight font-sans uppercase">{selectedBranch === 'tamtam' ? 'TamTam Burger' : 'Ayam Gunting'}</h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5 font-bold">TamTam ERP System</p>
          </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -mr-2 text-slate-300 hover:text-white">
          <Menu size={24} />
        </button>
      </div>

      {/* Modal Pengesahan Padam Jualan / Perbelanjaan */}
      {saleToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
            <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 tracking-tight">Padam Rekod Jualan?</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Tindakan ini tidak boleh dipulihkan. Ia akan mengubah jumlah keuntungan semasa anda.</p>
            <div className="flex gap-3">
              <button onClick={() => setSaleToDelete(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={confirmDeleteSale} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors">Ya, Padam</button>
            </div>
          </div>
        </div>
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
            <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 tracking-tight">Padam Rekod Belanja?</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Tindakan ini tidak boleh dipulihkan. Ia akan mengubah jumlah keuntungan semasa anda.</p>
            <div className="flex gap-3">
              <button onClick={() => setExpenseToDelete(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={confirmDeleteExpense} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors">Ya, Padam</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengesahan Padam Stok */}
      {inventoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
            <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 tracking-tight">Padam Item Stok?</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Rekod item ini akan dipadam sepenuhnya daripada sistem.</p>
            <div className="flex gap-3">
              <button onClick={() => setInventoryToDelete(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={confirmDeleteInventory} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors">Ya, Padam</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Pengesahan Padam Modal/Aset */}
      {capitalToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
            <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 tracking-tight">Padam Log Aset/Modal?</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Tindakan ini tidak boleh dipulihkan. Ia akan mengubah rekod pengiraan ekuiti.</p>
            <div className="flex gap-3">
              <button onClick={() => setCapitalToDelete(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={confirmDeleteCapitalExpense} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors">Ya, Padam</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Log Modal/Aset */}
      {editingCapital && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 text-left animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black tracking-tight text-slate-800">Edit Log Aset / Modal</h3>
              <button onClick={() => setEditingCapital(null)} className="text-slate-400 hover:text-slate-900"><XCircle size={24} /></button>
            </div>
            <div className="space-y-4">
              <InputField label="Nama Aset / Belanja" prefix="" value={editCapitalForm.description} onChange={(v) => setEditCapitalForm({...editCapitalForm, description: v})} />
              <InputField label="Kos Modal" prefix="RM" value={editCapitalForm.cost} onChange={(v) => setEditCapitalForm({...editCapitalForm, cost: v})} />
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">Tarikh</label>
                <input type="date" value={editCapitalForm.date} onChange={(e) => setEditCapitalForm({...editCapitalForm, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-black text-slate-800 outline-none focus:border-blue-500 shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">Dibayar Oleh</label>
                <select value={editCapitalForm.paidBy} onChange={(e) => setEditCapitalForm({...editCapitalForm, paidBy: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-black text-slate-800 outline-none focus:border-blue-500 shadow-inner appearance-none">
                   {(stats.computedPartners || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">Nota Tambahan</label>
                <textarea 
                  value={editCapitalForm.details} 
                  onChange={(e) => setEditCapitalForm({...editCapitalForm, details: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-sm resize-none h-24 shadow-inner custom-scrollbar"
                ></textarea>
              </div>
              <button onClick={handleUpdateCapitalExpense} className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-black shadow-xl hover:bg-blue-700 transition-all text-sm">Kemaskini Rekod</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Kapital */}
      {isEditingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-6 md:mb-8">
              <h3 className="text-xl md:text-2xl font-black tracking-tight">Edit Modal Awal</h3>
              <button onClick={() => setIsEditingModal(false)} className="text-slate-400 hover:text-slate-900"><XCircle size={24} /></button>
            </div>
            <div className="space-y-4 md:space-y-6">
              {(stats.computedPartners || []).map((p, idx) => (
                <div key={p.id}>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama Partner {idx + 1}</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={p.name}
                      onChange={(e) => {
                        const newConfig = [...partnersConfig];
                        newConfig[idx].name = e.target.value;
                        setPartnersConfig(newConfig);
                      }}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 md:py-4 px-5 font-black text-slate-800 outline-none focus:border-blue-500 shadow-inner text-sm"
                    />
                  </div>
                </div>
              ))}
              <button 
                onClick={async () => {
                  const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', 'settings', `partners_config_${selectedBranch}`);
                  const safePartners = partnersConfig && partnersConfig.length > 0 ? partnersConfig : [ { id: '1', name: 'Bros Mart', signed: false, signedAt: null }, { id: '2', name: 'HGV', signed: false, signedAt: null } ];
                  await setDoc(settingsDoc, { partners: safePartners }, { merge: true });
                  setIsEditingModal(false);
                }}
                className="w-full bg-slate-900 text-white py-4 md:py-5 rounded-2xl font-black hover:bg-black transition-all shadow-xl mt-4 text-sm"
              >
                Simpan & Sync Cloud
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Responsive */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col p-4 overflow-y-auto transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:shrink-0 border-r border-slate-800 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-start mb-8 px-2">
          <div className="flex items-center gap-4">
            {selectedBranch === 'tamtam' ? (
              <img 
                src="/tamtam-logo.jpg" 
                alt="TamTam ERP Logo" 
                className="w-14 h-14 rounded-xl object-contain shadow-lg bg-black p-1 border border-slate-700" 
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=T&background=000&color=fff&rounded=true'; }} 
              />
            ) : (
              <img 
                src="/brosmart-logo.jpg" 
                alt="Ayam Gunting ERP Logo" 
                className="w-14 h-14 rounded-xl object-cover shadow-lg border border-red-700/50" 
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=A&background=dc2626&color=fff&rounded=true'; }} 
              />
            )}
            <div>
              <h1 className="text-xl font-black leading-none tracking-tight text-white font-sans uppercase tracking-tighter">
                {selectedBranch === 'tamtam' ? 'TamTam Burger' : 'Ayam Gunting'}
              </h1>
              <div className="flex items-center gap-1.5 mt-2 bg-slate-800/50 p-1.5 rounded-md w-fit">
                <img 
                  src="/hgv-logo.jpg" 
                  alt="HGV" 
                  className="h-3.5 bg-white rounded-sm px-1 object-contain" 
                  title="HGV Print House"
                  onError={(e) => { e.target.style.display = 'none'; }} 
                />
                <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest leading-none">x</span>
                <img 
                  src="/brosmart-logo.jpg" 
                  alt="Bros Mart" 
                  className="h-3.5 w-3.5 bg-white rounded-sm object-cover" 
                  title="Bros Mart"
                  onError={(e) => { e.target.style.display = 'none'; }} 
                />
              </div>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1">
            <XCircle size={24} />
          </button>
        </div>
        
        {/* Butang Kembali Ke Cawangan (Home) */}
        <button onClick={handleLogoutBranch} className="mb-8 w-full flex items-center justify-center gap-2 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all text-xs font-black uppercase tracking-widest shadow-inner border border-slate-700/50">
           <ArrowLeft size={16} /> Tukar Bahagian
        </button>

        <nav className="flex-1 space-y-1">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Ringkasan" active={activeTab === 'overview'} onClick={() => switchTab('overview')} />
          <SidebarItem icon={<Upload size={20} />} label="Import Loyverse" active={activeTab === 'import'} onClick={() => switchTab('import')} />
          {selectedBranch === 'tamtam' && (
            <SidebarItem icon={<TrendingUp size={20} />} label="ROI & Modal" active={activeTab === 'roi'} onClick={() => switchTab('roi')} />
          )}
          <SidebarItem icon={<Wallet size={20} />} label="Jualan (Sales)" active={activeTab === 'sales'} onClick={() => switchTab('sales')} />
          <SidebarItem icon={<Receipt size={20} />} label="Perbelanjaan (Expenses)" active={activeTab === 'expenses'} onClick={() => switchTab('expenses')} />
          
          <SidebarItem icon={<Package size={20} />} label="Stok & Wastage" active={activeTab === 'inventory'} onClick={() => switchTab('inventory')} />
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-800">
               {activeTab === 'sales' ? 'JUALAN PENDAPATAN' : activeTab === 'expenses' ? 'PERBELANJAAN & BIL' : activeTab.replace('-', ' ')}
            </h2>
            <p className="text-slate-400 text-xs md:text-[13px] font-bold italic font-sans">
              "Laporan {selectedBranch === 'tamtam' ? 'Burger' : 'Ayam Gunting'} &bull; TamTam ERP"
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
            {activeTab === 'roi' && selectedBranch === 'tamtam' && (
              <div className={`px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black shadow-sm flex items-center gap-2 border uppercase tracking-widest flex-1 sm:flex-none justify-center ${stats.allSigned ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                {stats.allSigned ? <Lock size={14}/> : <Unlock size={14}/>}
                {stats.allSigned ? 'Disahkan' : 'Menunggu'}
              </div>
            )}
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 px-3 py-2 md:px-5 md:py-2.5 rounded-xl text-[10px] md:text-sm font-black shadow-sm hover:bg-slate-50 transition-all">
              <FileText size={16} /> Export
            </button>
          </div>
        </header>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedBranch === 'tamtam' ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4 md:gap-6`}>
              <StatCard title="Total Earning (Nett)" value={`RM ${stats.totalEarning.toFixed(2)}`} color="blue" />
              <StatCard title="Untung Bersih" value={`RM ${stats.netProfit.toFixed(2)}`} color="emerald" icon={<DollarSign size={20} />} />
              {selectedBranch === 'tamtam' && (
                <>
                  <StatCard title="ROI Semasa" value={`${stats.roiProgress.toFixed(1)}%`} color="orange" progress={stats.roiProgress} />
                  <StatCard title="Modal Keseluruhan" value={`RM ${stats.totalCapital.toLocaleString()}`} color="slate" />
                </>
              )}
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
               {/* Custom Native Bar Chart */}
               <div className="xl:col-span-2 bg-white p-4 md:p-8 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200 h-64 md:h-80 flex flex-col">
                 <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
                    <TrendingUp size={16} className="text-blue-600" /> Jualan 7 Hari Terakhir
                 </h3>
                 <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 pt-4 border-b border-slate-100 pb-2 h-full">
                   {(() => {
                     const last7Days = (salesData || []).slice(-7);
                     if (last7Days.length === 0) return <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-bold italic">Tiada rekod data jualan</div>;
                     
                     const maxEarning = Math.max(...last7Days.map(d => Number(d.walkin||0) + Number(d.panda||0) + Number(d.grab||0) + Number(d.misi||0)), 100);
                     
                     return last7Days.map((day, idx) => {
                       const walkin = Number(day.walkin || 0);
                       const panda = Number(day.panda || 0);
                       const grab = Number(day.grab || 0);
                       const misi = Number(day.misi || 0);
                       const total = walkin + panda + grab + misi;
                       
                       const hTotal = (total / maxEarning) * 100;
                       const hWalkin = total > 0 ? (walkin / total) * 100 : 0;
                       const hPanda = total > 0 ? (panda / total) * 100 : 0;
                       const hGrab = total > 0 ? (grab / total) * 100 : 0;
                       const hMisi = total > 0 ? (misi / total) * 100 : 0;

                       return (
                          <div key={day.id || idx} className="flex flex-col items-center justify-end h-full w-full gap-2 group relative">
                             <div className="absolute -top-10 bg-slate-800 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                               RM {total.toFixed(2)}
                             </div>
                             <div className="w-full max-w-[40px] bg-slate-50 rounded-t-md relative flex flex-col justify-end overflow-hidden border-b-2 border-transparent group-hover:border-blue-500 transition-all" style={{ height: `${Math.max(hTotal, 1)}%` }}>
                                {walkin > 0 && <div className="w-full bg-blue-500 transition-all" style={{ height: `${hWalkin}%` }}></div>}
                                {panda > 0 && <div className="w-full bg-pink-500 transition-all" style={{ height: `${hPanda}%` }}></div>}
                                {grab > 0 && <div className="w-full bg-green-500 transition-all" style={{ height: `${hGrab}%` }}></div>}
                                {misi > 0 && <div className="w-full bg-orange-500 transition-all" style={{ height: `${hMisi}%` }}></div>}
                             </div>
                             <span className="text-[8px] md:text-[10px] text-slate-400 font-bold truncate">{day.date ? day.date.substring(5) : ''}</span>
                          </div>
                       );
                     });
                   })()}
                 </div>
                 <div className="flex flex-wrap justify-center gap-3 md:gap-5 mt-4 text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>Walk-in</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-pink-500 rounded-full"></div>Panda</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>Grab</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>Misi</div>
                 </div>
               </div>

               {/* Ringkasan Perbelanjaan Simple */}
               <div className="bg-slate-900 p-6 md:p-8 rounded-2xl md:rounded-[2rem] text-white shadow-xl relative overflow-hidden flex flex-col border border-slate-800">
                 <div className="absolute bottom-0 right-0 p-8 opacity-5"><DollarSign size={100} className="md:w-[120px] md:h-[120px]"/></div>
                 <h3 className="text-lg font-black mb-2 md:mb-6 tracking-tight uppercase text-blue-400">Prestasi Keseluruhan</h3>
                 <div className="space-y-4 flex-1 mt-4">
                   <div className="flex justify-between items-end border-b border-white/10 pb-4">
                      <div>
                         <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Total Pendapatan</p>
                         <p className="text-xl font-black text-white">RM {stats.totalEarning.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                   </div>
                   <div className="flex justify-between items-end border-b border-white/10 pb-4">
                      <div>
                         <p className="text-[10px] text-rose-400 uppercase tracking-widest font-black mb-1">Total Perbelanjaan</p>
                         <p className="text-xl font-black text-rose-100">RM {stats.totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                   </div>
                   <div className="pt-2">
                      <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-1">Untung Bersih (P&L)</p>
                      <p className="text-3xl font-black text-emerald-400 tracking-tighter">RM {stats.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                   </div>
                 </div>
               </div>
            </div>

            {/* Jadual Bulanan Kini di Overview */}
            <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 md:p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-black text-sm md:text-xl text-slate-800 tracking-tight uppercase flex items-center gap-2">
                  <LayoutDashboard size={20} className="text-blue-600" /> Prestasi & P&L Bulanan
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 text-slate-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
                    <tr>
                      <th className="px-4 md:px-8 py-4 md:py-5">Bulan</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-right">Walk-in</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-right">Apps</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-right text-blue-600 bg-blue-50/30">Total Jualan</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-right text-rose-500 bg-rose-50/30">Perbelanjaan</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-right text-emerald-600 bg-emerald-50/30">Untung Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-xs md:text-sm">
                    {(monthlyStats || []).map(m => {
                      const dateObj = new Date(m.month + '-01');
                      const monthName = dateObj.toLocaleDateString('ms-MY', { month: 'short', year: 'numeric' });
                      return (
                        <tr key={m.month} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-4 md:px-8 py-4 md:py-6 font-black text-slate-800 uppercase tracking-widest">{monthName}</td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-right text-slate-500 whitespace-nowrap">RM {m.walkin.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-right text-slate-500 whitespace-nowrap">RM {m.apps.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-right font-black text-blue-600 bg-blue-50/30 whitespace-nowrap">RM {m.earning.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-right font-black text-rose-500 bg-rose-50/30 whitespace-nowrap">RM {m.expense.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-right font-black text-emerald-600 text-lg md:text-xl tracking-tighter bg-emerald-50/30 whitespace-nowrap">RM {m.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      );
                    })}
                    {(!monthlyStats || monthlyStats.length === 0) && <tr><td colSpan="6" className="text-center py-8 text-slate-400 italic text-[10px] uppercase tracking-widest font-black">Tiada rekod</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* IMPORT TAB */}
        {activeTab === 'import' && (
          <div className="max-w-4xl mx-auto py-4 md:py-8">
            {!pendingSyncData ? (
              <div className="bg-white p-6 md:p-12 rounded-3xl md:rounded-[2.5rem] border-4 border-dashed border-slate-100 flex flex-col items-center shadow-sm relative overflow-hidden text-center">
                {uploadSuccess && (
                  <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center animate-in fade-in duration-300 z-10 p-6">
                    <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                    <h4 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight tracking-tighter">Category {expectedCategory} Disync!</h4>
                    <p className="text-sm text-slate-500 mb-8 font-bold italic">Kategori lain telah diasingkan secara automatik.</p>
                    <button onClick={() => setUploadSuccess(false)} className="bg-blue-600 text-white px-6 md:px-8 py-3 rounded-xl font-black shadow-lg shadow-blue-200">Import Fail Baru</button>
                  </div>
                )}
                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 text-blue-500 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner rotate-3">
                   <Upload size={32} className="md:w-10 md:h-10" />
                </div>
                <h3 className="text-xl md:text-2xl font-black mb-4 tracking-tight text-slate-800 uppercase tracking-tighter">Sync Category {expectedCategory} Sahaja</h3>
                <p className="text-xs md:text-sm text-slate-500 mb-6 font-medium max-w-sm italic">Sila muat naik CSV 'Item Sales' Loyverse. Sistem menapis Category "{expectedCategory}" untuk bahagian ini secara automatik.</p>
                
                <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200 mb-6 md:mb-8 w-full max-w-md">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 gap-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Tarikh Rekod</label>
                    <button 
                      onClick={() => setImportDate(new Date().toISOString().split('T')[0])}
                      className="text-[9px] font-black text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors shadow-sm active:scale-95 self-start sm:self-auto"
                    >
                      Tarikh Terkini
                    </button>
                  </div>
                  <input 
                    type="date" 
                    value={importDate}
                    onChange={(e) => setImportDate(e.target.value)}
                    className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 font-black text-slate-800 outline-none focus:border-blue-500 shadow-sm transition-all mb-3 cursor-pointer text-sm"
                  />
                  <div className="bg-blue-50 p-3 rounded-xl flex items-start gap-2 border border-blue-100 text-left">
                    <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-blue-700 font-bold leading-relaxed">
                      <strong>BACKDATED:</strong> Jika fail bulan lepas (Cth: Feb), pilih tarikh dalam Februari. Jika ingin tindih, <span className="underline">padam rekod lama</span> di tab Jualan.
                    </p>
                  </div>
                </div>

                <button onClick={triggerFileInput} disabled={isUploading} className="w-full sm:w-auto bg-slate-900 text-white px-8 md:px-10 py-3 md:py-4 rounded-2xl font-black hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 text-sm">
                  {isUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Pilih CSV Loyverse'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <StatCard title="Target Earnings (Nett)" value={`RM ${pendingSyncData.summary.walkin.toFixed(2)}`} color="blue" />
                  <StatCard title="Target Items" value={pendingSyncData.branchItems.length} color="emerald" />
                  <StatCard title="Lain (Skipped)" value={pendingSyncData.excludedItems.length} color="orange" />
                  <div className="bg-slate-900 p-4 md:p-6 rounded-2xl text-white flex flex-col justify-center shadow-lg">
                    <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 mb-1">Tarikh Sync</p>
                    <p className="text-xs md:text-sm font-black tracking-tight uppercase tracking-widest text-emerald-400 italic">{pendingSyncData.summary.date}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                   <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[10px] md:text-xs tracking-widest">
                       <Filter size={16} className="text-blue-600" /> Semakan Loyverse ({expectedCategory})
                     </h4>
                     <button 
                       onClick={() => setPendingSyncData(null)} 
                       className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 md:p-2 rounded-full transition-all active:scale-90"
                     >
                       <X size={18} strokeWidth={3} />
                     </button>
                   </div>
                   <div className="overflow-x-auto max-h-[300px] md:max-h-[400px]">
                      <table className="w-full text-left min-w-[400px]">
                        <thead className="bg-slate-50 text-[9px] md:text-[10px] uppercase font-black tracking-widest text-slate-400 sticky top-0">
                          <tr>
                            <th className="px-4 md:px-6 py-3 md:py-4">Action</th>
                            <th className="px-4 md:px-6 py-3 md:py-4">Item</th>
                            <th className="px-4 md:px-6 py-3 md:py-4 text-center">Category</th>
                            <th className="px-4 md:px-6 py-3 md:py-4 text-right">Net Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-xs md:text-sm">
                          {(pendingSyncData.rawItems || []).map((item, idx) => {
                            const isIncluded = item.category && item.category.toUpperCase().includes(expectedCategory);
                            return (
                            <tr key={idx} className={!isIncluded ? 'opacity-30 grayscale italic bg-slate-50' : 'hover:bg-slate-50 transition-colors'}>
                              <td className="px-4 md:px-6 py-3 md:py-4">
                                {isIncluded ? (
                                  <div className="text-emerald-600 flex items-center gap-1 font-black text-[9px] uppercase tracking-tighter"><Check size={12} /> Included</div>
                                ) : (
                                  <div className="text-rose-400 flex items-center gap-1 font-black text-[9px] uppercase tracking-tighter"><Ban size={12} /> Skip</div>
                                )}
                              </td>
                              <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 tracking-tight">{item.item}</td>
                              <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                <span className={`px-2 py-1 rounded-md text-[9px] font-black ${isIncluded ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                  {item.category || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 md:px-6 py-3 md:py-4 text-right text-slate-800 font-black whitespace-nowrap">RM {Number(item.net_sales || 0).toFixed(2)}</td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                   </div>
                   <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                      <button onClick={() => setPendingSyncData(null)} className="w-full sm:w-auto px-6 py-3 rounded-xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-100 text-sm">Batal</button>
                      <button onClick={handleConfirmSync} className="w-full sm:w-auto px-6 md:px-8 py-3 rounded-xl bg-slate-900 text-white font-black shadow-xl hover:bg-black active:scale-95 flex items-center justify-center gap-2 text-sm">
                        <Check size={18} /> Sah & Sync Jualan
                      </button>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROI & MODAL TAB */}
        {activeTab === 'roi' && selectedBranch === 'tamtam' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 md:w-80 md:h-80 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32 md:-mr-40 md:-mt-40"></div>
               <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                  <h3 className="text-blue-400 font-black uppercase tracking-[0.2em] text-[9px] md:text-[10px] font-sans">Progress Pulangan Modal (ROI)</h3>
                </div>
                <div className="text-3xl md:text-5xl font-black mb-8 md:mb-10 tracking-tighter">RM {stats.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-base md:text-xl text-slate-500 font-normal">/ RM {stats.totalCapital.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="w-full bg-white/5 h-4 md:h-6 rounded-2xl overflow-hidden p-1 border border-white/10 shadow-inner">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-xl transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${Math.min(stats.roiProgress, 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Kiri - Form Tambah Modal */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200">
                   <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[11px] md:text-xs tracking-widest mb-5 md:mb-6 pb-4 border-b border-slate-100">
                     <PlusCircle size={16} className="text-blue-600" /> Log Aset / Modal Baru
                   </h4>
                   <div className="space-y-4">
                     <InputField label="Nama Aset / Belanja" prefix="" value={formCapital.description} onChange={(v) => setFormCapital({...formCapital, description: v})} placeholder="Cth: Dapur High Pressure" />
                     <InputField label="Kos Modal" prefix="RM" value={formCapital.cost} onChange={(v) => setFormCapital({...formCapital, cost: v})} />
                     <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">Tarikh</label>
                       <input type="date" value={formCapital.date} onChange={(e) => setFormCapital({...formCapital, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-black text-slate-800 outline-none focus:border-blue-500 shadow-inner" />
                     </div>
                     <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">Dibayar Oleh</label>
                       <select value={formCapital.paidBy} onChange={(e) => setFormCapital({...formCapital, paidBy: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-black text-slate-800 outline-none focus:border-blue-500 shadow-inner appearance-none">
                          {(stats.computedPartners || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                     </div>
                     
                     {/* TEXTAREA PANJANG UNTUK NOTA */}
                     <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">Nota Tambahan</label>
                       <textarea 
                         value={formCapital.details} 
                         onChange={(e) => setFormCapital({...formCapital, details: e.target.value})}
                         placeholder="Cth: Kedai Ali, Resit #123. Tekan Enter untuk perenggan baru."
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-sm resize-none h-24 shadow-inner custom-scrollbar"
                       ></textarea>
                     </div>
                     
                     <button onClick={handleAddCapitalExpense} className="w-full mt-4 bg-slate-900 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 text-sm">
                        Rekod Modal
                     </button>
                   </div>
                </div>

                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200">
                   <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[11px] md:text-xs tracking-widest mb-5 pb-4 border-b border-slate-100">
                     <FileText size={16} className="text-orange-500" /> Pengesahan Rakan Kongsi
                   </h4>
                   <div className="grid grid-cols-2 gap-3 md:gap-4">
                     {(stats.computedPartners || []).map(p => (
                       <div key={p.id} className="text-center group">
                          <div className={`h-24 md:h-32 border-2 border-dashed mb-2 md:mb-3 flex flex-col items-center justify-center transition-all duration-300 rounded-xl md:rounded-2xl ${p.signed ? 'bg-emerald-50 border-emerald-300 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                             {p.signed ? (
                               <div className="flex flex-col items-center animate-in zoom-in">
                                 <UserCheck className="text-emerald-600 w-6 h-6 md:w-10 md:h-10 mb-1 md:mb-2" />
                                 <span className="text-[7px] md:text-[8px] text-emerald-700 font-black uppercase tracking-widest bg-emerald-100 px-2 py-0.5 rounded-full mb-1">Disahkan</span>
                                 <span className="text-[6px] md:text-[7px] text-emerald-500 font-bold uppercase tracking-tighter">{p.signedAt}</span>
                               </div>
                             ) : (
                               <div className="flex flex-col items-center">
                                 <button onClick={() => handleToggleSignature(p.id)} className="text-[8px] md:text-[9px] text-orange-600 font-black uppercase border-2 border-orange-500 bg-white px-3 md:px-4 py-1.5 md:py-2 rounded-full hover:bg-orange-600 hover:text-white transition-all active:scale-95 shadow-md tracking-widest mb-1 md:mb-2">Sahkan</button>
                                 <span className="text-slate-300 italic text-[7px] md:text-[8px] uppercase font-black tracking-widest">Tandatangan</span>
                               </div>
                             )}
                          </div>
                          <p className="font-black text-slate-800 tracking-tight uppercase text-[10px] md:text-xs truncate px-1">{p.name}</p>
                       </div>
                     ))}
                   </div>
                   <div className="mt-4 bg-blue-50 p-3 rounded-xl flex gap-2 border border-blue-100 items-start">
                      <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest leading-relaxed">Pengesahan akan terbatal automatik jika rekod modal ditambah/dipadam.</p>
                   </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-xs md:text-sm text-slate-800 tracking-tight uppercase">Ketelusan Ekuiti</h3>
                    <span className="text-[8px] md:text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 uppercase tracking-widest hidden sm:block">Ekuiti Dinamik</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[500px]">
                        <thead className="bg-slate-50 text-slate-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
                          <tr><th className="px-4 md:px-6 py-3 md:py-4">Partner</th><th className="px-4 md:px-6 py-3 md:py-4 text-center">Modal</th><th className="px-4 md:px-6 py-3 md:py-4 text-center">Ekuiti</th><th className="px-4 md:px-6 py-3 md:py-4 text-right text-emerald-600">Dividen Semasa</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold">
                          {(stats.computedPartners || []).map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                              <td className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-800 flex items-center gap-2 md:gap-3">
                                <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-[10px] md:text-xs shadow-md">{p.name.charAt(0)}</div>
                                <span className="uppercase text-[10px] md:text-xs tracking-tight">{p.name}</span>
                              </td>
                              <td className="px-4 md:px-6 py-4 md:py-5 text-center text-slate-500 font-black text-xs md:text-sm whitespace-nowrap">RM {p.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td className="px-4 md:px-6 py-4 md:py-5 text-center"><span className="bg-orange-50 text-orange-700 px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg border border-orange-100 font-black shadow-sm text-[10px] md:text-xs">{p.equity.toFixed(1)}%</span></td>
                              <td className="px-4 md:px-6 py-4 md:py-5 text-right font-black text-emerald-600 text-lg md:text-xl tracking-tighter whitespace-nowrap">RM {(stats.netProfit * (p.equity / 100)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            </tr>
                          ))}
                        </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-black text-xs md:text-sm text-slate-800 tracking-tight uppercase flex items-center gap-2">
                      <History size={16} className="text-slate-400"/> Log Modal & Aset
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left min-w-[500px] relative">
                        <thead className="bg-white text-slate-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                          <tr><th className="px-4 md:px-6 py-3 md:py-4">Tarikh & Item</th><th className="px-4 md:px-6 py-3 md:py-4 text-center">Dibayar Oleh</th><th className="px-4 md:px-6 py-3 md:py-4 text-right">Kos Modal</th><th className="px-4 py-3 md:py-4 text-center">Aksi</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-bold text-[10px] md:text-xs">
                          {(!capitalExpenses || capitalExpenses.length === 0) ? (
                            <tr><td colSpan="4" className="py-10 text-center text-slate-300 italic uppercase tracking-widest text-[10px]">Tiada log aset ditemui</td></tr>
                          ) : (
                            (capitalExpenses || []).map(item => {
                              const partnerName = stats.computedPartners.find(p => p.id === String(item.paidBy))?.name || '---';
                              return (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 md:px-6 py-3 md:py-4 align-top">
                                    <p className="text-[8px] md:text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">{item.paymentDate}</p>
                                    <p className="text-slate-800 font-black uppercase tracking-tighter text-xs md:text-sm">{item.description}</p>
                                    
                                    {/* DROP-DOWN NOTA MODAL */}
                                    {item.details && (
                                      <div className="mt-2">
                                        <button 
                                          onClick={() => toggleCapitalNote(item.id)}
                                          className="flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                                        >
                                          {expandedCapitalNotes[item.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                          {expandedCapitalNotes[item.id] ? 'Tutup Nota' : 'Lihat Nota'}
                                        </button>
                                        
                                        {expandedCapitalNotes[item.id] && (
                                          <div className="mt-2 text-[10px] text-slate-600 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed shadow-sm font-medium">
                                            {item.details}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 md:px-6 py-3 md:py-4 text-center align-top pt-5">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] md:text-[10px] uppercase font-black tracking-widest">{partnerName}</span>
                                  </td>
                                  <td className="px-4 md:px-6 py-3 md:py-4 text-right font-black text-slate-800 text-xs md:text-sm tracking-tighter whitespace-nowrap align-top pt-5">
                                    RM {Number(item.cost).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  </td>
                                  <td className="px-4 py-3 md:py-4 text-center align-top pt-4">
                                    <div className="flex items-center justify-center gap-2">
                                      <button 
                                        onClick={() => {
                                          setEditingCapital(item.id);
                                          setEditCapitalForm({
                                            description: item.description || '',
                                            cost: item.cost || '',
                                            date: item.paymentDate || '',
                                            details: item.details || '',
                                            paidBy: item.paidBy || '1'
                                          });
                                        }} 
                                        className="text-slate-300 hover:text-blue-500 transition-colors active:scale-90 p-1.5 md:p-2 border border-slate-100 rounded-md shadow-sm bg-white"
                                      >
                                        <Edit3 size={14} />
                                      </button>
                                      <button 
                                        onClick={() => setCapitalToDelete(item.id)} 
                                        className="text-slate-300 hover:text-rose-500 transition-colors active:scale-90 p-1.5 md:p-2 border border-slate-100 rounded-md shadow-sm bg-white"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- FULL SALES TAB RESTORED --- */}
        {activeTab === 'sales' && (
          <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-300">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
              <div className="xl:col-span-1 bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6">
                <h3 className="text-xl font-black flex items-center gap-3 text-slate-800 tracking-tight"><PlusCircle size={24} className="text-blue-600" /> Rekod Pendapatan</h3>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tarikh Jualan</label>
                  <input type="date" value={formSales.date} onChange={(e) => setFormSales({...formSales, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-slate-800 outline-none focus:border-blue-500 shadow-inner text-sm" />
                </div>
                <div className="space-y-4">
                  <InputField label="Cash/QR (Walk-in)" prefix="RM" value={formSales.walkin} onChange={(v) => setFormSales({...formSales, walkin: v})} />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Foodpanda" prefix="RM" value={formSales.panda} onChange={(v) => setFormSales({...formSales, panda: v})} />
                    <InputField label="GrabFood" prefix="RM" value={formSales.grab} onChange={(v) => setFormSales({...formSales, grab: v})} />
                  </div>
                  <InputField label="Misi" prefix="RM" value={formSales.misi} onChange={(v) => setFormSales({...formSales, misi: v})} />
                </div>
                <button onClick={handleSaveSales} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"><Save size={18} /> Simpan Jualan</button>
              </div>

              {/* Jadual Jualan */}
              <div className="xl:col-span-2 bg-white rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-5 md:p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-black text-sm md:text-xl text-slate-800 tracking-tight uppercase">Sejarah Jualan Harian</h3>
                </div>
                <div className="overflow-x-auto max-h-[500px] flex-1">
                  <table className="w-full text-left relative min-w-[700px]">
                    <thead className="bg-white text-slate-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 md:px-6 py-4 md:py-5">Tarikh</th>
                        <th className="px-4 md:px-6 py-4 md:py-5">Sumber</th>
                        <th className="px-4 md:px-6 py-4 md:py-5 text-right">Walk-in</th>
                        <th className="px-4 md:px-6 py-4 md:py-5 text-right">Apps (PD/GR/MI)</th>
                        <th className="px-4 md:px-6 py-4 md:py-5 text-right text-blue-600">Total Jualan</th>
                        <th className="px-4 md:px-6 py-4 md:py-5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-[11px] md:text-xs">
                      {([...salesData] || []).reverse().map(day => {
                        const walkin = Number(day.walkin || 0);
                        const apps = Number(day.panda || 0) + Number(day.grab || 0) + Number(day.misi || 0);
                        const total = walkin + apps;
                        return (
                          <tr key={day.id} className="hover:bg-slate-50 transition-all group">
                            <td className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-800 whitespace-nowrap">{new Date(day.date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td className="px-4 md:px-6 py-4 md:py-5">
                              {day.source ? <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 text-[9px] uppercase tracking-widest">{day.source.substring(0,10)}...</span> : <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 text-[9px] uppercase tracking-widest">Manual</span>}
                            </td>
                            <td className="px-4 md:px-6 py-4 md:py-5 text-right text-slate-500 whitespace-nowrap tracking-tighter">RM {walkin.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-4 md:px-6 py-4 md:py-5 text-right text-slate-500 whitespace-nowrap tracking-tighter">RM {apps.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-4 md:px-6 py-4 md:py-5 text-right font-black text-blue-600 text-sm whitespace-nowrap tracking-tighter">RM {total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-4 md:px-6 py-4 md:py-5 text-center">
                              <button onClick={() => setSaleToDelete(day.id)} className="text-slate-400 hover:text-rose-500 transition-colors p-2 active:scale-90 bg-white border border-slate-200 rounded-md shadow-sm">
                                <Trash2 size={16}/>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {(!salesData || salesData.length === 0) && <tr><td colSpan="6" className="text-center py-10 text-slate-300 italic uppercase tracking-widest text-[10px]">Tiada rekod jualan</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- FULL EXPENSES TAB RESTORED --- */}
        {activeTab === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-xl font-black flex items-center gap-3 text-slate-800"><Minus size={24} className="text-rose-600 bg-rose-50 p-1 rounded-lg" /> Rekod Belanja</h3>
              
              {/* BUTANG PANGGIL POP-UP RESITSCAN PRO */}
              <button onClick={() => setIsScannerModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 px-4 py-3 rounded-xl font-black text-xs transition-all border border-indigo-200 shadow-sm active:scale-95 uppercase tracking-widest">
                <Camera size={16} />
                Imbas Resit / Invois (AI)
              </button>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tarikh Resit/Bil</label>
                <input type="date" value={formExpense.date} onChange={(e) => setFormExpense({...formExpense, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-slate-800 outline-none focus:border-rose-500 shadow-inner text-sm" />
              </div>
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">Kategori Belanja</label>
                 <select value={formExpense.category} onChange={(e) => setFormExpense({...formExpense, category: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 text-sm font-black text-slate-800 outline-none focus:border-rose-500 shadow-inner appearance-none">
                    <option value="Kos Mentah (COGS)">Kos Mentah / Stok (COGS)</option>
                    <option value="Gaji & Operasi (OPEX)">Gaji, Bil & Operasi (OPEX)</option>
                 </select>
              </div>

              <InputField label="Jumlah RM" prefix="RM" value={formExpense.amount} onChange={(v) => setFormExpense({...formExpense, amount: v})} />
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rujukan / Catatan</label><textarea value={formExpense.description} onChange={(e) => setFormExpense({...formExpense, description: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-sm font-bold shadow-inner h-24 custom-scrollbar" placeholder="Cth: NSK Beli Barang Basah"></textarea></div>
              <button onClick={handleSaveExpense} className="w-full bg-rose-600 text-white py-4 rounded-xl font-black shadow-xl hover:bg-rose-700 transition-all">Simpan Belanja</button>
            </div>
            
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm flex flex-col h-fit">
              <div className="p-6 md:p-8 bg-slate-50/50 border-b flex justify-between items-center"><h3 className="font-black text-xl uppercase tracking-tight">Log Perbelanjaan</h3></div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left"><thead className="bg-white text-slate-400 text-[9px] uppercase font-black sticky top-0"><tr><th className="px-6 py-4">Tarikh</th><th className="px-6 py-4">Kategori</th><th className="px-6 py-4">Catatan</th><th className="px-6 py-4 text-right">Jumlah</th><th className="px-6 py-4 text-center">Aksi</th></tr></thead>
                  <tbody className="divide-y divide-slate-50 font-bold text-xs">{([...expensesData] || []).reverse().map(exp => {
                    const isCogs = exp.category?.includes('COGS');
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">{new Date(exp.date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded border text-[9px] uppercase tracking-widest ${isCogs ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                              {isCogs ? 'Kos Mentah' : 'Operasi'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 italic max-w-[200px] truncate" title={exp.description}>{exp.description || '-'}</td>
                        <td className="px-6 py-4 text-right text-rose-500">RM {Number(exp.amount).toFixed(2)}</td>
                        <td className="px-6 py-4 text-center"><button onClick={() => setExpenseToDelete(exp.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></td>
                      </tr>
                  )})}
                  {(!expensesData || expensesData.length === 0) && <tr><td colSpan="5" className="text-center py-10 text-slate-300 italic uppercase tracking-widest text-[10px]">Tiada rekod perbelanjaan baru</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- FULL INVENTORY TAB RESTORED --- */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-300">
            
            {/* Form Tambah Item Baru */}
            <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl md:text-2xl font-black flex items-center gap-3 md:gap-4 text-slate-800 tracking-tight mb-6"><Package size={24} className="text-blue-600 md:w-7 md:h-7" /> Tambah Item Stok Baru</h3>
              
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={16} /> {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <InputField label="Nama Item" prefix="" value={newInventoryItem.name} onChange={(v) => setNewInventoryItem({...newInventoryItem, name: v})} placeholder="Cth: Mayonis" />
                <InputField label="Kuantiti Awal" prefix="" type="number" value={newInventoryItem.stock} onChange={(v) => setNewInventoryItem({...newInventoryItem, stock: v})} placeholder="Cth: 10" />
                <InputField label="Unit Ukuran" prefix="" value={newInventoryItem.unit} onChange={(v) => setNewInventoryItem({...newInventoryItem, unit: v})} placeholder="Cth: botol / pek" />
              </div>
              <button onClick={handleAddInventoryItem} className="mt-6 w-full sm:w-auto bg-slate-900 text-white px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95 text-sm md:text-base">
                <Plus size={18} /> Simpan Kategori Stok
              </button>
            </div>

            {(!inventory || inventory.length === 0) ? (
               <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                  <Package size={48} className="text-slate-300 mb-4" />
                  <h4 className="text-lg font-black text-slate-600 uppercase tracking-widest">Tiada Item Stok</h4>
                  <p className="text-sm text-slate-400 mt-2 font-medium">Sila tambah item stok baru menggunakan borang di atas.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                {(inventory || []).map(item => (
                  <div key={item.id} className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border-2 transition-all relative group ${item.stock < 10 ? 'bg-rose-50 border-rose-200 shadow-lg' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <button onClick={() => setInventoryToDelete(item.id)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2 bg-white border border-slate-100 rounded-lg text-slate-300 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all active:scale-90 z-10">
                       <Trash2 size={14}/>
                    </button>
                    <div className="flex justify-between items-start mb-4 md:mb-6 pr-8">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${item.stock < 10 ? 'text-rose-600' : 'text-slate-400'}`}>{item.item}</span>
                      {item.stock < 10 && <AlertTriangle size={18} className="text-rose-500 animate-pulse" />}
                    </div>
                    <div className="text-3xl md:text-4xl font-black text-slate-900 mb-6 md:mb-8 tracking-tighter">{item.stock} <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-tighter">{item.unit}</span></div>
                    <div className="space-y-3 md:space-y-4">
                      <input 
                        type="number" 
                        placeholder="Jumlah" 
                        value={manualStockInputs[item.id] || ''}
                        onChange={(e) => setManualStockInputs({...manualStockInputs, [item.id]: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 font-black text-xs md:text-sm text-slate-800 outline-none focus:border-blue-500 shadow-inner transition-all"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateStockManual(item.id, item.stock, 'restock')} className="flex-1 bg-slate-900 text-white py-2.5 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-black active:scale-95 transition-all shadow-md"><Plus size={12} /> Tambah</button>
                        <button onClick={() => handleUpdateStockManual(item.id, item.stock, 'waste')} className={`flex-1 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border-2 flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md ${item.stock < 10 ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}><Minus size={12} /> Waste</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white p-5 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-200">
               <h3 className="font-black text-slate-800 mb-6 md:mb-8 uppercase tracking-widest text-[10px] md:text-[11px] flex items-center gap-2">
                 <History size={16} className="text-blue-600" /> Log Pergerakan Stok
               </h3>
               <div className="space-y-3 md:space-y-4">
                 {(stockLogs || []).map(log => (
                   <div key={log.id} className="flex items-center justify-between p-3 md:p-5 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl">
                     <div className="flex items-center gap-3 md:gap-5">
                        <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center font-black text-sm md:text-base ${log.type === 'restock' ? 'bg-emerald-100 text-emerald-700 shadow-inner' : 'bg-rose-100 text-rose-700 shadow-inner'}`}>{log.type === 'restock' ? '+' : '-'}</div>
                        <div>
                          <p className="font-black text-slate-800 tracking-tight text-xs md:text-sm">{log.type === 'restock' ? 'Restock' : 'Wastage'}: {log.itemName}</p>
                          <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' }) : 'Memproses...'}</p>
                        </div>
                     </div>
                     <span className={`font-black text-lg md:text-2xl tracking-tighter ${log.type === 'restock' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.change > 0 ? `+${log.change}` : log.change}</span>
                   </div>
                 ))}
                 {(!stockLogs || stockLogs.length === 0) && <p className="text-center text-[10px] text-slate-400 uppercase font-black italic">Tiada log stok</p>}
               </div>
            </div>
          </div>
        )}

      </div>
      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }`}} />
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl transition-all duration-300 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
    <div className="shrink-0">{icon}</div><span className="font-black text-[10px] md:text-[11px] uppercase tracking-widest font-sans">{label}</span>
  </button>
);

const StatCard = ({ title, value, color, progress, icon }) => {
  const styles = { blue: 'border-l-blue-600 bg-blue-50/20 text-blue-700', emerald: 'border-l-emerald-600 bg-emerald-50/20 text-emerald-700', orange: 'border-l-orange-600 bg-orange-50/20 text-orange-700', slate: 'border-l-slate-800 bg-slate-50/20 text-slate-800' };
  return (
    <div className={`bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200 border-l-[6px] md:border-l-[10px] ${styles[color]} hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start mb-3 md:mb-4"><h4 className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] font-sans">{title}</h4>{icon && <div className="hidden sm:block">{icon}</div>}</div>
      <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter font-sans break-all">{value}</div>
      {progress !== undefined && <div className="mt-4 md:mt-6 w-full bg-slate-100 h-2 md:h-2.5 rounded-full overflow-hidden border border-slate-200 shadow-inner"><div className="bg-orange-500 h-full shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all duration-1000" style={{ width: `${Math.min(progress, 100)}%` }}></div></div>}
    </div>
  );
};

const InputField = ({ label, prefix, value, onChange, placeholder = "0", type }) => {
  const hasPrefix = prefix && prefix !== "";
  const inputType = type || (prefix === "RM" ? "number" : "text");
  return (
    <div>
      <label className="block text-[9px] md:text-[10px] font-black text-slate-500 mb-2 md:mb-3 uppercase tracking-widest font-sans">{label}</label>
      <div className="relative">
        {hasPrefix && <span className="absolute left-4 md:left-5 inset-y-0 flex items-center text-slate-400 text-xs md:text-sm font-black font-sans">{prefix}</span>}
        <input type={inputType} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl py-3 md:py-4 ${hasPrefix ? 'pl-10 md:pl-12' : 'px-4 md:px-5'} pr-4 md:pr-5 text-xs md:text-sm font-black text-slate-800 outline-none focus:border-blue-500 shadow-inner transition-all font-sans`} placeholder={placeholder} />
      </div>
    </div>
  );
};

export default App;