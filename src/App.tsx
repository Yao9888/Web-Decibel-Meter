/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Activity, Maximize2, RotateCcw, Settings2 } from 'lucide-react';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [db, setDb] = useState(0);
  const [peakDb, setPeakDb] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(80);
  const [autoInterrupt, setAutoInterrupt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const interruptAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastInterruptTime = useRef<number>(0);

  // Initialize a silent audio element to grab focus
  useEffect(() => {
    const audio = new Audio();
    // A tiny silent base64 mp3
    audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    interruptAudioRef.current = audio;
  }, []);

  const startMonitoring = async () => {
    try {
      // Prime the interrupt audio (required for iOS/Mobile to allow later playback)
      if (interruptAudioRef.current) {
        interruptAudioRef.current.play().catch(() => {});
        interruptAudioRef.current.pause();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      setIsRecording(true);
      setError(null);
      updateLevel();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('无法访问麦克风。请确保已授予权限。');
    }
  };

  const stopMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsRecording(false);
    setDb(0);
  };

  const triggerInterrupt = () => {
    const now = Date.now();
    // Prevent spamming (max once every 3 seconds)
    if (now - lastInterruptTime.current < 3000) return;
    
    if (interruptAudioRef.current) {
      interruptAudioRef.current.play().then(() => {
        lastInterruptTime.current = now;
      }).catch(e => console.error("Interrupt failed:", e));
    }
  };

  const updateLevel = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    const currentDb = Math.round((average / 255) * 100);
    setDb(currentDb);
    setPeakDb(prev => Math.max(prev, currentDb));

    // Check threshold for interruption
    if (autoInterrupt && currentDb >= threshold) {
      triggerInterrupt();
    }
    
    animationFrameRef.current = requestAnimationFrame(updateLevel);
  };

  const resetPeak = () => setPeakDb(0);

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, []);

  // Color based on decibel level
  const getLevelColor = (val: number) => {
    if (val < 40) return 'text-emerald-400';
    if (val < 70) return 'text-yellow-400';
    if (val < 90) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBgGlow = (val: number) => {
    if (val < 40) return 'rgba(52, 211, 153, 0.1)';
    if (val < 70) return 'rgba(250, 204, 21, 0.1)';
    if (val < 90) return 'rgba(249, 115, 22, 0.1)';
    return 'rgba(239, 68, 68, 0.15)';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans selection:bg-emerald-500/30 flex items-center justify-center p-4">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full transition-colors duration-500"
          style={{ 
            background: `radial-gradient(circle, ${getBgGlow(db)} 0%, transparent 70%)`,
            filter: 'blur(80px)'
          }}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#151619] border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Hardware Header */}
        <div className="p-6 border-bottom border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <h1 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">环境音量监测仪 v1.0</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-emerald-500/20 text-emerald-500' : 'hover:bg-white/5 text-zinc-500'}`}
            >
              <Settings2 size={14} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 pb-6 overflow-hidden border-b border-white/5"
            >
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">自动打断后台音频</span>
                  <button 
                    onClick={() => setAutoInterrupt(!autoInterrupt)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${autoInterrupt ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  >
                    <motion.div 
                      animate={{ x: autoInterrupt ? 22 : 2 }}
                      className="absolute top-1 w-3 h-3 bg-white rounded-full"
                    />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">打断阈值</span>
                    <span className="text-[10px] font-mono text-emerald-500">{threshold} dB</span>
                  </div>
                  <input 
                    type="range" 
                    min="30" 
                    max="100" 
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <p className="text-[8px] text-zinc-500 font-mono leading-relaxed">
                    * 当音量超过此阈值时，应用将尝试通过播放静音音频来夺取系统音频焦点，从而暂停其他应用的播放。
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Display */}
        <div className="px-8 pt-4 pb-12 flex flex-col items-center">
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Radial Meter Background */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="110"
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="12"
                strokeDasharray="520 690"
              />
              <motion.circle
                cx="128"
                cy="128"
                r="110"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={`${(db / 100) * 520} 690`}
                className={`transition-colors duration-300 ${getLevelColor(db)}`}
                strokeLinecap="round"
              />
            </svg>

            {/* Center Value */}
            <div className="text-center z-10">
              <motion.div 
                key={db}
                initial={{ scale: 0.95, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-7xl font-mono font-light tracking-tighter ${getLevelColor(db)}`}
              >
                {db}
              </motion.div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mt-1">分贝 (dB)</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 w-full mt-8">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">峰值水平</span>
                <button onClick={resetPeak} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <RotateCcw size={10} />
                </button>
              </div>
              <div className="text-2xl font-mono text-zinc-200">{peakDb}<span className="text-[10px] ml-1 text-zinc-500">dB</span></div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">状态</span>
                <Activity size={10} className={isRecording ? 'text-emerald-500 animate-pulse' : 'text-zinc-600'} />
              </div>
              <div className="text-sm font-mono text-zinc-200 uppercase tracking-tight">
                {isRecording ? '监测中' : '待机'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-10 w-full flex flex-col gap-4">
            <button
              onClick={isRecording ? stopMonitoring : startMonitoring}
              className={`w-full py-4 rounded-2xl font-mono text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 ${
                isRecording 
                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' 
                : 'bg-emerald-500 text-black font-bold hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              }`}
            >
              {isRecording ? (
                <><MicOff size={16} /> 停止监测</>
              ) : (
                <><Mic size={16} /> 开始监测</>
              )}
            </button>
            
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-400 text-[10px] text-center font-mono uppercase tracking-wider bg-red-500/5 py-2 rounded-lg border border-red-500/10"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-6 bg-black/20 border-t border-white/5">
          <div className="flex justify-between items-center opacity-40">
            <div className="text-[8px] font-mono uppercase tracking-widest">采样: 48kHz / 24bit</div>
            <div className="text-[8px] font-mono uppercase tracking-widest">延迟: ~20ms</div>
          </div>
        </div>
      </motion.div>

      {/* Visualizer Bar (Bottom) */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8"
          >
            {[...Array(24)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ 
                  height: isRecording ? `${Math.max(4, Math.random() * (db / 2) + 4)}px` : '4px',
                  backgroundColor: db > 80 ? '#ef4444' : db > 50 ? '#facc15' : '#10b981'
                }}
                transition={{ duration: 0.1, repeat: Infinity, repeatType: 'reverse' }}
                className="w-1 rounded-full opacity-50"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
