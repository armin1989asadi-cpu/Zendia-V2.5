
import React, { useState, useRef, useEffect } from 'react';
import { generatePersianSpeech, generatePersianSpeechStream, analyzeNewsFromUrl, askQuestionAboutContent, analyzeNewsFromTopic, analyzeDailyNews, rewriteText, getDetailedSupplementaryNews } from '../services/geminiService';
import { generateElevenLabsSpeechStream, getTtsProvider, getElevenLabsApiKey } from '../services/elevenLabsService';
import { decode, createWavBlob, concatPcmChunks } from '../utils/audioUtils';
import { AppStatus, VoiceOption, ChatMessage, AnalysisStyle, SourceLink, CredibilityData, HistoryItem, RewriteStyle } from '../types';
import { AudioVisualizer } from './AudioVisualizer';

// --- CONSTANTS ---
const VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'سارا', gender: 'female', description: 'شفاف' },
  { id: 'Puck', name: 'علی', gender: 'male', description: 'انرژیک' },
  { id: 'Fenrir', name: 'رضا', gender: 'male', description: 'رسمی' },
  { id: 'Zephyr', name: 'مریم', gender: 'female', description: 'آرام' },
];

const STYLES: { id: AnalysisStyle; label: string; desc: string }[] = [
  { id: 'news', label: 'خبری (رسمی)', desc: 'جدی و استاندارد' },
  { id: 'podcast', label: 'پادکست (صمیمی)', desc: 'گرم و داستان‌گو' },
  { id: 'deep', label: 'تحلیل عمیق', desc: 'موشکافانه و بلند' },
  { id: 'quick', label: 'خلاصه (سریع)', desc: 'مینیمال و کوتاه' },
];

const REWRITE_STYLES: { id: RewriteStyle; label: string; }[] = [
    { id: 'normal', label: 'عادی' },
    { id: 'podcast', label: 'پادکست' },
    { id: 'simple', label: 'ساده' },
    { id: 'intimate', label: 'صمیمانه' },
    { id: 'romantic', label: 'عاشقانه' },
];

const SPEEDS = [1, 1.25, 1.5, 2];

interface Topic {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const TOPICS: Topic[] = [
  { 
    id: 'ai_ml', 
    label: 'هوش مصنوعی', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <style>{`
          .brain-outline { stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
          .zap { stroke-dasharray: 5; stroke-dashoffset: 10; animation: zapMove 0.8s infinite linear; }
          .glow { animation: pulseGlow 2s infinite alternate; }
          @keyframes zapMove { to { stroke-dashoffset: 0; } }
          @keyframes pulseGlow { 0% { filter: drop-shadow(0 0 1px currentColor); opacity: 0.7; } 100% { filter: drop-shadow(0 0 4px currentColor); opacity: 1; } }
        `}</style>
        <path className="brain-outline glow" d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        <path className="brain-outline glow" d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
        <path className="brain-outline glow" d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        <path className="brain-outline glow" d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
        <path className="brain-outline glow" d="M6.002 6.5A3 3 0 0 1 5.602 5.125" />
        <path className="brain-outline glow" d="M11.8 12a3 3 0 0 0-2-3" />
        <path className="brain-outline glow" d="M12.2 12a3 3 0 0 1 2-3" />
        <path className="brain-outline glow" d="M12 18v-2" />
        <path className="zap" strokeWidth="1.5" d="M4 10l2 2-2 3 3 1" strokeLinecap="round" strokeLinejoin="round"/>
        <path className="zap" strokeWidth="1.5" d="M20 10l-2 2 2 3-3 1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  { 
    id: 'software', 
    label: 'نوآوری نرم‌افزار', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <style>{`
          .code-type { stroke-dasharray: 12; stroke-dashoffset: 12; animation: codeTyping 2.5s infinite steps(12, end); }
          .code-cursor { animation: cursorBlink 0.8s infinite step-start; }
          .panel-glow { animation: panelPulse 3s infinite alternate ease-in-out; }
          @keyframes codeTyping { 0%, 20% { stroke-dashoffset: 12; } 80%, 100% { stroke-dashoffset: 0; } }
          @keyframes cursorBlink { 50% { opacity: 0; } }
          @keyframes panelPulse { 0% { filter: drop-shadow(0 0 1px currentColor); } 100% { filter: drop-shadow(0 0 3px currentColor); } }
        `}</style>
        <rect className="panel-glow" x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.5} />
        <path strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M3 9h18" />
        <circle cx="6" cy="7" r="1" fill="currentColor" className="opacity-60" />
        <circle cx="9" cy="7" r="1" fill="currentColor" className="opacity-60" />
        <path strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M7 13l2 2-2 2" className="opacity-80" />
        <path strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M11 17h4" className="code-type" />
        <path strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M16 15v4" className="code-cursor" />
      </svg>
    ) 
  },
  { 
    id: 'gadgets', 
    label: 'گجت و سخت‌افزار', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} />
        <path strokeWidth={1.5} d="M9 2v2m6-2v2m-6 16v2m6-2v2m-8-8H5m14 0h-2m-12 4H5m14 0h-2" strokeLinecap="round" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" className="opacity-30" />
        <circle cx="12" cy="12" r="1.5" className="animate-ping" fill="currentColor" />
      </svg>
    )
  },
  { 
    id: 'science', 
    label: 'علم و اکتشاف', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <style>{`
          .atom-orbit { transform-origin: center; animation: orbitSpin 8s infinite linear; }
          .atom-orbit-rev { transform-origin: center; animation: orbitSpinRev 8s infinite linear; }
          @keyframes orbitSpin { to { transform: rotate(360deg); } }
          @keyframes orbitSpinRev { to { transform: rotate(-360deg); } }
        `}</style>
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <g className="atom-orbit">
             <ellipse cx="12" cy="12" rx="9" ry="3" strokeWidth={1.5} />
             <circle cx="21" cy="12" r="1" fill="currentColor" />
        </g>
        <g className="atom-orbit-rev" style={{transform: 'rotate(60deg)'}}>
             <ellipse cx="12" cy="12" rx="9" ry="3" strokeWidth={1.5} />
        </g>
        <g className="atom-orbit" style={{transform: 'rotate(120deg)'}}>
             <ellipse cx="12" cy="12" rx="9" ry="3" strokeWidth={1.5} />
        </g>
      </svg>
    )
  },
  { 
    id: 'finance', 
    label: 'بازار مالی و کریپتو', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <style>{`
          .chart-line { stroke-dasharray: 30; stroke-dashoffset: 30; animation: chartDraw 3s infinite ease-out; }
          @keyframes chartDraw { 0% { stroke-dashoffset: 30; opacity: 0; } 30% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; } }
        `}</style>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 20h18" className="opacity-50" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16l6-6 4 4 8-10" className="chart-line" />
        <circle cx="21" cy="4" r="2" fill="currentColor" className="animate-pulse" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 4v16" strokeDasharray="2 2" className="opacity-30" />
      </svg>
    )
  },
  { 
    id: 'politics', 
    label: 'سیاست بین‌الملل', 
    icon: (
       <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <style>{`
            .crown-glow { animation: crownPulse 2.5s infinite alternate; }
            .gem-shine { animation: gemSparkle 1.5s infinite; transform-origin: center; }
            @keyframes crownPulse { 0% { opacity: 0.6; filter: drop-shadow(0 0 2px currentColor); } 100% { opacity: 1; filter: drop-shadow(0 0 8px currentColor); } }
            @keyframes gemSparkle { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.5); opacity: 1; } }
         `}</style>
         <path className="crown-glow" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
         <circle className="gem-shine" style={{transformOrigin: '12px 10px'}} cx="12" cy="10" r="1.5" fill="currentColor" />
         <circle className="gem-shine" style={{animationDelay: '0.4s', transformOrigin: '6px 12px'}} cx="6" cy="12" r="1" fill="currentColor" />
         <circle className="gem-shine" style={{animationDelay: '0.8s', transformOrigin: '18px 12px'}} cx="18" cy="12" r="1" fill="currentColor" />
       </svg>
    ) 
  },
  { 
    id: 'sports', 
    label: 'اخبار ورزشی', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <style>{`
          .ball-roll { transform-origin: center; animation: ballRollBounce 2s infinite ease-in-out alternate; }
          .shadow-pulse { transform-origin: center; animation: shadowScales 2s infinite ease-in-out alternate; }
          @keyframes ballRollBounce {
            0% { transform: translateY(0) rotate(0deg); }
            100% { transform: translateY(-4px) rotate(180deg); filter: drop-shadow(0 0 4px currentColor); }
          }
          @keyframes shadowScales {
            0% { transform: scale(1); opacity: 0.3; }
            100% { transform: scale(0.6); opacity: 0.1; }
          }
        `}</style>
        <g className="ball-roll" style={{transformOrigin: '12px 11px'}}>
          <circle cx="12" cy="11" r="7" strokeWidth={1.5} />
          {/* Soccer ball central pentagon */}
          <path strokeWidth={1.5} strokeLinejoin="round" d="M12 7.5L9 9.5l1 3.5h4l1-3.5z" />
          {/* Lines coming out of pentagon to the ball edge */}
          <path strokeWidth={1.5} strokeLinecap="round" d="M12 7.5V4M9 9.5l-3-2M15 9.5l3-2M10 13l-1.5 3.5M14 13l1.5 3.5" />
        </g>
        <ellipse cx="12" cy="21" rx="5" ry="1" fill="currentColor" className="shadow-pulse" />
      </svg>
    )
  },
  { 
    id: 'cinema_global', 
    label: 'سینمای جهان', 
    icon: (
       <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <style>{`
           .tape-reel { transform-origin: center; animation: reelSpin 1.5s infinite linear; }
           @keyframes reelSpin { to { transform: rotate(360deg); } }
         `}</style>
         <g>
           <rect x="2" y="7" width="20" height="10" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
           <rect x="5" y="9" width="14" height="6" rx="1" strokeWidth="1" strokeOpacity="0.5" />
           <g style={{transformOrigin: '8px 12px'}} className="tape-reel">
             <circle cx="8" cy="12" r="2.5" strokeWidth="1.5" />
             <path d="M8 9.5v5" strokeWidth="1.5" strokeLinecap="round" />
           </g>
           <g style={{transformOrigin: '16px 12px'}} className="tape-reel">
             <circle cx="16" cy="12" r="2.5" strokeWidth="1.5" />
             <path d="M16 9.5v5" strokeWidth="1.5" strokeLinecap="round" />
           </g>
         </g>
       </svg>
    )
  },
  { 
    id: 'cinema_iran', 
    label: 'سینمای ایران', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <style>{`
            .clapper-arm { transform-origin: 2px 11px; animation: clapAction 2s infinite; }
            @keyframes clapAction { 0%, 10% { transform: rotate(0deg); } 15% { transform: rotate(-20deg); } 20% { transform: rotate(0deg); } 100% { transform: rotate(0deg); } }
         `}</style>
         <rect x="2" y="11" width="20" height="10" rx="2" strokeWidth={1.5} />
         <path d="M2 11l20 0" strokeWidth={1} />
         <g className="clapper-arm">
            <rect x="2" y="4" width="20" height="6" rx="1" strokeWidth={1.5} fill="currentColor" fillOpacity="0.1" />
            <path d="M6 4l-2 6M11 4l-2 6M16 4l-2 6M21 4l-2 6" strokeWidth={1} strokeLinecap="round" />
         </g>
      </svg>
    )
  },
  { 
    id: 'music_iran', 
    label: 'موسیقی ایرانی', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <style>{`
          .eq-bar { animation: eqJump 1s infinite ease-in-out; transform-origin: bottom; }
          @keyframes eqJump { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
        `}</style>
        <rect x="3" y="10" width="4" height="10" rx="1" className="eq-bar" style={{animationDelay: '0s'}} fill="currentColor" opacity="0.6" />
        <rect x="9" y="6" width="4" height="14" rx="1" className="eq-bar" style={{animationDelay: '0.2s'}} fill="currentColor" opacity="0.8" />
        <rect x="15" y="12" width="4" height="8" rx="1" className="eq-bar" style={{animationDelay: '0.4s'}} fill="currentColor" opacity="0.6" />
      </svg>
    ) 
  },
];

interface TextToSpeechProps {
  onStatusChange?: (status: AppStatus) => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  onViewModeChange?: (viewMode: 'INPUT' | 'CHAT') => void;
  onShowQuotaError: (reason: string, resetTime: string) => void;
}

const SquigglyLine = () => (
    <div className="absolute -bottom-1 left-0 w-full h-2 text-cyan-400 overflow-hidden opacity-80">
        <svg viewBox="0 0 40 4" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0 2 Q 5 0, 10 2 T 20 2 T 30 2 T 40 2" stroke="currentColor" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
    </div>
);

const formatTime = (time: number) => {
    if (!isFinite(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const TextToSpeech: React.FC<TextToSpeechProps> = ({ onStatusChange, showHistory, setShowHistory, onViewModeChange, onShowQuotaError }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'INPUT' | 'CHAT'>('INPUT');
  const [inputType, setInputType] = useState<'TOPIC' | 'URL' | 'TEXT' | 'DAILY_TOPIC'>('DAILY_TOPIC'); 
  
  const [text, setText] = useState<string>('');
  const [newsUrl, setNewsUrl] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('ai_ml');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [sources, setSources] = useState<SourceLink[]>([]);
  const [credibility, setCredibility] = useState<CredibilityData | null>(null);
  
  const [analysisStyle, setAnalysisStyle] = useState<AnalysisStyle>('podcast');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [rewriteStyle, setRewriteStyle] = useState<RewriteStyle>('normal');
  const [openDropdown, setOpenDropdown] = useState<'VOICE' | 'STYLE' | 'TIMEFRAME' | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showLongWaitMessage, setShowLongWaitMessage] = useState<boolean>(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Draggable player state
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [isDraggingPlayer, setIsDraggingPlayer] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const playerRef = useRef<HTMLDivElement>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [usingSpeechSynthesis, setUsingSpeechSynthesis] = useState<boolean>(false);
  const textToPlayActive = useRef<string>('');
  const originalSpeechUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimer = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  
  const audioCache = useRef<Map<string, string>>(new Map());
  const activeRequests = useRef<Map<string, Promise<string>>>(new Map());

  // Stable refs for prop callbacks to completely avoid infinite re-render loops
  const onStatusChangeRef = useRef(onStatusChange);
  const onViewModeChangeRef = useRef(onViewModeChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onViewModeChangeRef.current = onViewModeChange;
  }, [onViewModeChange]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingPlayer(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartPos.current = {
      x: clientX - playerPos.x,
      y: clientY - playerPos.y
    };
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingPlayer) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const newX = clientX - dragStartPos.current.x;
      const newY = clientY - dragStartPos.current.y;
      
      setPlayerPos({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDraggingPlayer(false);
    };

    if (isDraggingPlayer) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDraggingPlayer]);

  // --- SUPPLEMENTARY DETAIL STATE & CACHING ---
  const [selectedSentenceForDetail, setSelectedSentenceForDetail] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailResult, setDetailResult] = useState<{ summary: string; sources: SourceLink[] } | null>(null);
  
  const sentenceDetailCache = useRef<Map<string, { summary: string; sources: SourceLink[] }>>(new Map());

  // --- API QUOTA LIMIT RECOVERY STATE ---
  // LIFTED TO APP LEVEL

  const checkAndShowQuotaError = (error: any, fallbackContext: string): boolean => {
    if (!error) return false;
    const errStr = error.message || error.toString() || "";
    const status = error.status || error.statusCode || "";

    // اگر خطا مربوط به ElevenLabs است، به checkAndShowQuotaError مربوط نمی‌شود — آن‌ها جداگانه handle می‌شوند.
    const isElevenLabsError =
      errStr.includes('ELEVENLABS_API_KEY_MISSING') ||
      errStr.toLowerCase().includes('elevenlabs') ||
      errStr.toLowerCase().includes('eleven labs');
    if (isElevenLabsError) return false;

    const isInvalidOrMissingKey =
      errStr.includes("API_KEY_MISSING") ||
      errStr.toLowerCase().includes("api key") ||
      errStr.toLowerCase().includes("api_key_invalid") ||
      errStr.toLowerCase().includes("invalid api key") ||
      status === 401 || status === 403 ||
      errStr.includes("401") || errStr.includes("403") ||
      errStr.toLowerCase().includes("invalid_api_key") ||
      errStr.toLowerCase().includes("permission_denied") ||
      errStr.toLowerCase().includes("unauthenticated");

    if (isInvalidOrMissingKey) {
      const reason = `کلید API جیمینی (GEMINI_API_KEY) تنظیم نشده یا نامعتبر است. لطفاً از بخش «کلید هوش مصنوعی اختصاصی» در همین صفحه، یک کلید API معتبر Gemini وارد کنید.`;
      onShowQuotaError(reason, "");
      return true;
    }

    const isQuota =
      status === 429 ||
      status === "429" ||
      errStr.includes("429") ||
      errStr.toLowerCase().includes("quota") ||
      errStr.toLowerCase().includes("limit") ||
      errStr.toLowerCase().includes("exhausted") ||
      errStr.toLowerCase().includes("resource_exhausted") ||
      errStr.toLowerCase().includes("rate limit") ||
      errStr.toLowerCase().includes("capacity") ||
      errStr.toLowerCase().includes("credits");

    if (isQuota) {
      const reason = `درگاه ارتباطی مدل هوش مصنوعی گوگل جیمینی در حین پردازش "${fallbackContext}" با محدودیت استفاده روبرو شد. دلیل: تعداد کل فرکانس‌های ارسالی شما در این دقیقه یا شبانه‌روز از آستانه ظرفیت مجاز طرح رایگان (Free Plan @ 15 RPM / 1500 RPD) فراتر رفته است.`;
      const resetTime = "به طور متوسط ۶۰ ثانیه دیگر (برای محدودیت دقیقه) | ساعت ۰۳:۳۰ بامداد فردا به وقت ایران (۰۰:۰۰ UTC برای محدودیت روزانه)";
      onShowQuotaError(reason, resetTime);
      return true;
    }
    return false;
  };

  const parseNewsItems = (rawText: string) => {
    if (!rawText) return [];
    // Split by lines or paragraphs. This maps perfectly to chronological daily entries or distinct paragraphs.
    return rawText
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Keep content-rich blocks to exclude short system headings
  };

  const handleOpenSupplementaryDetail = async (sentence: string) => {
    setSelectedSentenceForDetail(sentence);
    setIsDetailModalOpen(true);
    
    // Check Cache first - ensures absolutely no repeated analysis on subsequent clicks
    if (sentenceDetailCache.current.has(sentence)) {
      setDetailResult(sentenceDetailCache.current.get(sentence) || null);
      setDetailLoading(false);
      return;
    }
    
    setDetailLoading(true);
    setDetailResult(null);
    try {
      const result = await getDetailedSupplementaryNews(sentence);
      sentenceDetailCache.current.set(sentence, result);
      setDetailResult(result);
    } catch (err) {
      console.error("Error loading supplementary news:", err);
      const wasQuota = checkAndShowQuotaError(err, "تحقیق و دریافت اطلاعات تکمیلی خبر");
      const fallbackResult = {
        summary: wasQuota 
          ? "متأسفانه به دلیل اتمام سهمیه موقت مدل هوش مصنوعی امکان دریافت اطلاعات تکمیلی مقدور نیست. می‌توانید از بخش زیر جستجوی دستی انجام دهید."
          : "متأسفانه خطایی در دریافت اطلاعات تکمیلی رخ داد. لطفاً مجدداً تلاش کنید.",
        sources: [
          { title: "دیجیاتو", url: "https://digiato.com" },
          { title: "زومیت", url: "https://www.zoomit.ir" },
          { title: "ایسنا", url: "https://www.isna.ir" }
        ]
      };
      sentenceDetailCache.current.set(sentence, fallbackResult);
      setDetailResult(fallbackResult);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  useEffect(() => {
    onViewModeChangeRef.current?.(viewMode);
  }, [viewMode]);

  useEffect(() => {
      const saved = localStorage.getItem('zendia_history');
      if (saved) {
          try {
              setHistory(JSON.parse(saved));
          } catch (e) {
              console.error("Failed to load history", e);
          }
      }
  }, []);

  useEffect(() => {
      localStorage.setItem('zendia_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => { if (isFinite(audio.duration)) setDuration(audio.duration); };
    const onPlay = () => setStatus(AppStatus.PLAYING);
    const onPause = () => setStatus(prev => (prev === AppStatus.PLAYING ? AppStatus.IDLE : prev));
    const onEnded = () => { setStatus(AppStatus.IDLE); };
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (viewMode === 'CHAT' && scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'CHAT' && chatMessages.length > 0) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, viewMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpenDropdown(null);
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) setShowHistory(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getVoiceLabel = (id: string) => VOICES.find(v => v.id === id)?.name || id;
  const getStyleLabel = (style: AnalysisStyle) => STYLES.find(s => s.id === style)?.label || style;

  const getCredibilityVisuals = (data: CredibilityData | null | undefined) => {
    if (!data) return { color: 'text-slate-500', bg: 'bg-slate-800/60', border: 'border-slate-800/60', icon: '?', shadow: '' };
    switch(data.level) {
        case 'low': return { color: 'text-rose-500', bg: 'bg-rose-950/20', border: 'border-rose-500/40', icon: '!', shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.1)]' };
        case 'doubtful': return { color: 'text-amber-500', bg: 'bg-amber-950/20', border: 'border-amber-500/40', icon: '?', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.1)]' };
        case 'trustworthy': 
        case 'verified': return { color: 'text-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-400/40', icon: '✓', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)]' };
        default: return { color: 'text-slate-400', bg: 'bg-slate-950/20', border: 'border-slate-600', icon: '-', shadow: '' };
    }
  };

  const mainCredVis = getCredibilityVisuals(credibility);

  const saveToHistory = (resultText: string, resultSources: SourceLink[], resultCred: CredibilityData | undefined, resultQs: string[]) => {
      const newItem: HistoryItem = {
          id: Date.now().toString(),
          text: resultText,
          timestamp: Date.now(),
          sourceType: (inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') ? 'topic' : (inputType === 'URL' ? 'url' : 'text'),
          meta: { url: newsUrl, topicId: selectedTopic, topicLabel: customTopic || TOPICS.find(t => t.id === selectedTopic)?.label, analysisStyle: analysisStyle, sources: resultSources, credibility: resultCred, questions: resultQs, chatMessages: [] }
      };
      setHistory(prev => [newItem, ...prev].slice(0, 50));
  };

  const updateHistoryChat = (newMessages: ChatMessage[]) => {
      setHistory(prev => {
          if (prev.length === 0) return prev;
          const head = prev[0];
          if (head.text === text) return [{ ...head, meta: { ...head.meta, chatMessages: newMessages } }, ...prev.slice(1)];
          return prev;
      });
  };

  const restoreHistoryItem = (item: HistoryItem) => {
      setText(item.text);
      if (item.meta) {
          setSources(item.meta.sources || []);
          setCredibility(item.meta.credibility || null);
          setSuggestedQuestions(item.meta.questions || []);
          setChatMessages(item.meta.chatMessages || []);
          setAnalysisStyle(item.meta.analysisStyle || 'podcast');
          if (item.sourceType === 'url' && item.meta.url) { setInputType('URL'); setNewsUrl(item.meta.url); }
          else if (item.sourceType === 'topic') { setInputType('TOPIC'); if (item.meta.topicId) setSelectedTopic(item.meta.topicId); if (item.meta.topicLabel && !TOPICS.find(t => t.id === item.meta.topicId)) setCustomTopic(item.meta.topicLabel); }
          else setInputType('TEXT');
      }
      setViewMode('CHAT');
      setShowHistory(false);
      setAudioUrl(null);
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setHistory(prev => prev.filter(i => i.id !== id)); };
  const clearAllHistory = () => { if (history.length === 0) return; if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام تاریخچه تحلیل‌ها را پاک کنید؟')) setHistory([]); };

  const prefetchAudio = async (textToFetch: string, voiceId: string) => {
      if (!textToFetch) return;
      const key = `${textToFetch.substring(0, 30)}_${textToFetch.length}_${voiceId}`;
      if (audioCache.current.has(key) || activeRequests.current.has(key)) return;
      const promise = generatePersianSpeech(textToFetch, voiceId).then(base64 => {
             const audioBytes = decode(base64);
             const wavBlob = createWavBlob(audioBytes, 24000);
             const url = URL.createObjectURL(wavBlob);
             audioCache.current.set(key, url);
             return url;
      }).catch(err => { console.warn("Prefetch background error:", err); return ""; }).finally(() => { activeRequests.current.delete(key); });
      activeRequests.current.set(key, promise);
  };

  const handleMainAction = async () => {
    if (status === AppStatus.GENERATING || status === AppStatus.ANALYZING) return;
    if (status === AppStatus.PLAYING) { audioRef.current?.pause(); return; }
    try {
      setStatus((inputType === 'URL' || inputType === 'TOPIC' || inputType === 'DAILY_TOPIC' || (inputType === 'TEXT' && rewriteStyle !== 'normal')) ? AppStatus.ANALYZING : AppStatus.GENERATING);
      setAudioUrl(null); setSources([]); setCredibility(null); setChatMessages([]); setIsPlayerMinimized(false);
      let resultText = text; let resultQs: string[] = []; let resultSources: SourceLink[] = []; let resultCred: CredibilityData | undefined = undefined;
      if (inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') {
          let result;
          if (inputType === 'DAILY_TOPIC') {
              if (customTopic && customTopic.trim().length > 0) result = await analyzeDailyNews('custom_search', customTopic, analysisStyle);
              else { const topic = TOPICS.find(t => t.id === selectedTopic); if (!topic) return; result = await analyzeDailyNews(topic.id, topic.label, analysisStyle); }
          } else {
              if (customTopic && customTopic.trim().length > 0) result = await analyzeNewsFromTopic('custom_search', customTopic, analysisStyle);
              else { const topic = TOPICS.find(t => t.id === selectedTopic); if (!topic) return; result = await analyzeNewsFromTopic(topic.id, topic.label, analysisStyle); }
          }
          setText(result.text); setSuggestedQuestions(result.questions); setSources(result.sources); if (result.credibility) setCredibility(result.credibility);
          resultText = result.text; resultQs = result.questions; resultSources = result.sources; resultCred = result.credibility;
      } else if (inputType === 'URL') {
        if (!newsUrl) return;
        const result = await analyzeNewsFromUrl(newsUrl, analysisStyle);
        setText(result.text); setSuggestedQuestions(result.questions); setSources(result.sources); if (result.credibility) setCredibility(result.credibility);
        resultText = result.text; resultQs = result.questions; resultSources = result.sources; resultCred = result.credibility;
      } else if (inputType === 'TEXT' && rewriteStyle !== 'normal') {
          if (!text.trim()) return;
          const rewritten = await rewriteText(text, rewriteStyle);
          setText(rewritten); resultText = rewritten;
      }
      if (!resultText) return;
      saveToHistory(resultText, resultSources, resultCred, resultQs);
      setNewsUrl(''); setCustomTopic(''); setViewMode('CHAT'); setStatus(AppStatus.IDLE);
    } catch (err) { 
      console.error(err); 
      const handled = checkAndShowQuotaError(err, "تحلیل خبر جدید / جستجوی هوشمند موضوع");
      if (!handled) {
        setStatus(AppStatus.ERROR); 
        setTimeout(() => setStatus(AppStatus.IDLE), 3000); 
      } else {
        setStatus(AppStatus.IDLE);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.currentTarget.blur(); handleMainAction(); } };
  const handleBackToInput = () => { setViewMode('INPUT'); setNewsUrl(''); setCustomTopic(''); setSelectedTopic('ai_ml'); setChatMessages([]); setSources([]); setCredibility(null); setSuggestedQuestions([]); };

  const speakFallback = (textToSpeak: string) => {
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        throw new Error("Web Speech API matches no engine on this browser.");
      }
      
      // Cancel any ongoing speaking
      window.speechSynthesis.cancel();
      if (speechTimer.current) { clearInterval(speechTimer.current); speechTimer.current = null; }
      
      setUsingSpeechSynthesis(true);
      textToPlayActive.current = textToSpeak;
      
      // Clean up text format so it's read beautifully
      const cleanText = textToSpeak
        .replace(/[*_#`~>\[\]()-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      originalSpeechUtterance.current = utterance;
      
      // Use Persian / Arabic locale voices if available
      const voices = window.speechSynthesis.getVoices();
      const faVoice = voices.find(v => v.lang.toLowerCase().includes('fa') || v.lang.toLowerCase().includes('ar'));
      if (faVoice) {
        utterance.voice = faVoice;
      }
      
      utterance.rate = playbackRate;
      
      // Word count calculation to estimate speech duration smoothly (about 2 words / second)
      const wordCount = cleanText.split(/\s+/).length || 1;
      const estimatedDuration = Math.max(5, Math.ceil(wordCount / (2.0 * playbackRate)));
      setDuration(estimatedDuration);
      setCurrentTime(0);
      setAudioUrl("speech-synthesis-fallback");
      setStatus(AppStatus.PLAYING);
      
      let simulatedTime = 0;
      speechTimer.current = setInterval(() => {
        if (window.speechSynthesis.paused) return;
        simulatedTime += 0.2;
        const currentSimTime = parseFloat(simulatedTime.toFixed(1));
        setCurrentTime(Math.min(estimatedDuration, currentSimTime));
        if (currentSimTime >= estimatedDuration) {
          if (speechTimer.current) { clearInterval(speechTimer.current); speechTimer.current = null; }
          setStatus(AppStatus.IDLE);
          setUsingSpeechSynthesis(false);
          setCurrentTime(0);
        }
      }, 200);
      
      utterance.onend = () => {
        if (speechTimer.current) { clearInterval(speechTimer.current); speechTimer.current = null; }
        setStatus(AppStatus.IDLE);
        setUsingSpeechSynthesis(false);
        setCurrentTime(0);
      };
      
      utterance.onerror = (err) => {
        console.warn("SpeechSynthesis utterance error:", err);
        if (speechTimer.current) { clearInterval(speechTimer.current); speechTimer.current = null; }
        setStatus(AppStatus.IDLE);
        setUsingSpeechSynthesis(false);
      };
      
      window.speechSynthesis.speak(utterance);
      
    } catch (fallbackErr) {
      console.error("Web Speech API Fallback failed:", fallbackErr);
      setStatus(AppStatus.ERROR);
      setTimeout(() => setStatus(AppStatus.IDLE), 2000);
    }
  };

  const handlePlayText = async (textToPlay: string, id: string) => {
      if (generatingId) return;

      // بررسی سریع: اگر موتور ElevenLabs انتخاب شده ولی کلید API ثبت نشده، بلافاصله پیام نشان بده
      if (getTtsProvider() === 'elevenlabs' && !getElevenLabsApiKey()) {
        onShowQuotaError(
          `کلید API الون‌لبز (ElevenLabs) تنظیم نشده است. لطفاً از بخش «تنظیمات تبدیل صوت» یک کلید API معتبر ElevenLabs وارد کنید، یا به موتور جیمینی سوئیچ کنید.`,
          ""
        );
        return;
      }
      
      // Reset any active SpeechSynthesis before playing
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        if (speechTimer.current) { clearInterval(speechTimer.current); speechTimer.current = null; }
        setUsingSpeechSynthesis(false);
      }
      
      const key = `${textToPlay.substring(0, 30)}_${textToPlay.length}_${selectedVoice}`;
      setShowLongWaitMessage(false); setIsPlayerMinimized(false);
      const waitTimer = setTimeout(() => setShowLongWaitMessage(true), 5000);
      try {
          setGeneratingId(id);
          let url = audioCache.current.get(key);
          let handledByStream = false;
          if (!url) {
              const pending = activeRequests.current.get(key);
              if (pending) { setStatus(AppStatus.GENERATING); url = await pending; }
              else {
                setStatus(AppStatus.GENERATING);
                handledByStream = true;
                const BYTES_PER_SECOND = 24000 * 2; // 24kHz, 16-bit mono PCM
                const REBUFFER_MARGIN_SECONDS = 1.2;
                const chunks: Uint8Array[] = [];
                let bytesSoFar = 0;
                let started = false;

                const onPcmChunk = (pcmBytes: Uint8Array) => {
                  chunks.push(pcmBytes);
                  bytesSoFar += pcmBytes.length;
                  const audio = audioRef.current;
                  if (!started) {
                    started = true;
                    clearTimeout(waitTimer); setShowLongWaitMessage(false);
                    const wavBlob = createWavBlob(concatPcmChunks(chunks), 24000);
                    const chunkUrl = URL.createObjectURL(wavBlob);
                    setAudioUrl(chunkUrl);
                    if (audio) {
                      audio.src = chunkUrl;
                      audio.playbackRate = playbackRate;
                      setStatus(AppStatus.PLAYING);
                      audio.play().catch((playErr) => { console.error("Autoplay prevented:", playErr); setStatus(AppStatus.IDLE); });
                    }
                  } else if (audio && !audio.paused) {
                    const availableSeconds = bytesSoFar / BYTES_PER_SECOND;
                    if ((availableSeconds - audio.currentTime) < REBUFFER_MARGIN_SECONDS) {
                      const wavBlob = createWavBlob(concatPcmChunks(chunks), 24000);
                      const chunkUrl = URL.createObjectURL(wavBlob);
                      const prevTime = audio.currentTime;
                      audio.src = chunkUrl;
                      audio.currentTime = prevTime;
                      audio.playbackRate = playbackRate;
                      audio.play().catch(() => {});
                    }
                  }
                };

                if (getTtsProvider() === 'elevenlabs') {
                  await generateElevenLabsSpeechStream(textToPlay, onPcmChunk);
                } else {
                  await generatePersianSpeechStream(textToPlay, selectedVoice, onPcmChunk);
                }

                const finalWavBlob = createWavBlob(concatPcmChunks(chunks), 24000);
                if (!started) {
                  throw new Error("No audio data received from the model.");
                }
                url = URL.createObjectURL(finalWavBlob);
                audioCache.current.set(key, url);
                const audio = audioRef.current;
                if (audio) {
                  const prevTime = audio.currentTime;
                  const wasPaused = audio.paused;
                  audio.src = url;
                  audio.currentTime = prevTime;
                  audio.playbackRate = playbackRate;
                  if (!wasPaused) audio.play().catch(() => {});
                }
                setAudioUrl(url);
              }
          }
          clearTimeout(waitTimer); setShowLongWaitMessage(false);
          if (url && !handledByStream) {
            setAudioUrl(url);
            if (audioRef.current) { audioRef.current.src = url; audioRef.current.playbackRate = playbackRate; setStatus(AppStatus.PLAYING); try { await audioRef.current.play(); } catch (playErr) { console.error("Autoplay prevented:", playErr); setStatus(AppStatus.IDLE); } }
          } else if (!url) throw new Error("Could not generate audio URL");
      } catch (e: any) {
          console.warn("Server TTS connection failed or timed out. Instantly falling back to Web Speech API Browser engine.", e);
          clearTimeout(waitTimer); setShowLongWaitMessage(false);
          const errStr = e?.message || e?.toString() || "";
          if (getTtsProvider() === 'elevenlabs' && (errStr.includes('ELEVENLABS_API_KEY_MISSING') || e?.status === 401 || errStr.toLowerCase().includes('elevenlabs'))) {
            onShowQuotaError(`کلید API الون‌لبز (ElevenLabs) تنظیم نشده یا نامعتبر است. لطفاً از بخش «تنظیمات تبدیل صوت» یک کلید API معتبر ElevenLabs وارد کنید، یا موقتاً به موتور جیمینی سوئیچ کنید.`, "");
          } else {
            checkAndShowQuotaError(e, "تبدیل صوتی متن به گفتار (Text-to-Speech)");
          }
          speakFallback(textToPlay);
      }
      finally { clearTimeout(waitTimer); setShowLongWaitMessage(false); setGeneratingId(null); }
  };

  const togglePlayPause = () => {
    if (usingSpeechSynthesis && typeof window !== 'undefined' && window.speechSynthesis) {
      if (status === AppStatus.PLAYING) {
        window.speechSynthesis.pause();
        setStatus(AppStatus.IDLE);
      } else {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setStatus(AppStatus.PLAYING);
        } else {
          speakFallback(textToPlayActive.current);
        }
      }
      return;
    }
    if (audioRef.current && audioUrl) {
      if (status === AppStatus.PLAYING) audioRef.current.pause();
      else audioRef.current.play();
    }
  };

  const handleClosePlayer = () => {
    if (usingSpeechSynthesis && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      if (speechTimer.current) { clearInterval(speechTimer.current); speechTimer.current = null; }
      setUsingSpeechSynthesis(false);
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setAudioUrl(null);
    setStatus(AppStatus.IDLE);
    setGeneratingId(null);
    setIsPlayerMinimized(false);
  };
  const toggleMinimize = () => setIsPlayerMinimized(!isPlayerMinimized);
  const cycleSpeed = () => { const idx = SPEEDS.indexOf(playbackRate); const nextIdx = (idx + 1) % SPEEDS.length; setPlaybackRate(SPEEDS[nextIdx]); };
  const handleDownload = () => { if (audioUrl) { const a = document.createElement('a'); a.href = audioUrl; a.download = `zendia-audio-${Date.now()}.wav`; document.body.appendChild(a); a.click(); document.body.removeChild(a); } };
  const handleShare = async () => { if (!text) return; let shareContent = text; if (sources.length > 0) shareContent += "\n\nمنابع:\n" + sources.map(s => `• ${s.title}: ${s.url}`).join('\n'); shareContent += "\n\nShared via Zendia"; try { await navigator.clipboard.writeText(shareContent); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); } catch (err) { console.error("Failed to copy", err); } };

  const handleSendMessage = async (msgText: string = chatInput) => {
    if (!msgText.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: msgText, timestamp: Date.now() };
    const newChatState = [...chatMessages, userMsg];
    setChatMessages(newChatState); setChatInput(''); setStatus(AppStatus.ANALYZING);
    updateHistoryChat(newChatState);
    try {
      const result = await askQuestionAboutContent(text, msgText, newChatState);
      const modelMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: result.answer, timestamp: Date.now(), sources: result.sources, credibility: result.credibility };
      const updatedChatWithModel = [...newChatState, modelMsg];
      setChatMessages(updatedChatWithModel); setSuggestedQuestions(result.nextQuestions);
      updateHistoryChat(updatedChatWithModel);
    } catch (e) { 
      console.error(e); 
      checkAndShowQuotaError(e, "پرسش و پاسخ چت زنده");
    } finally { setStatus(AppStatus.IDLE); }
  };

  const isProcessing = status === AppStatus.GENERATING || status === AppStatus.ANALYZING || generatingId !== null;

  return (
    <div className="h-full w-full flex flex-col relative" ref={dropdownRef}>
        
        {/* TOP SETTINGS BAR - COMPACT FOR MOBILE */}
        <div className="flex-none w-full pt-2 pb-1 bg-transparent z-30 flex flex-col items-center gap-2 max-w-lg mx-auto">
            
            {/* ROW 1: MODE SWITCHER */}
            <div className="flex items-center justify-center gap-4 md:gap-8 flex-wrap w-full px-2">
                <button 
                    onClick={() => setInputType('URL')} 
                    className={`relative pb-2 text-xs md:text-base font-extrabold transition-all tracking-wide whitespace-nowrap ${inputType === 'URL' ? 'text-primary-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    تحلیل لینک
                    {inputType === 'URL' && <SquigglyLine />}
                </button>

                <button 
                    onClick={() => { if(inputType !== 'TOPIC' && inputType !== 'DAILY_TOPIC') setInputType('DAILY_TOPIC'); }} 
                    className={`relative pb-2 text-xs md:text-base font-extrabold transition-all tracking-wide whitespace-nowrap ${(inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') ? 'text-primary-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    مرور اخبار
                    {(inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') && <SquigglyLine />}
                </button>

                <button 
                    onClick={() => setInputType('TEXT')} 
                    className={`relative pb-2 text-xs md:text-base font-extrabold transition-all tracking-wide whitespace-nowrap ${inputType === 'TEXT' ? 'text-primary-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    تحریر متن
                    {inputType === 'TEXT' && <SquigglyLine />}
                </button>


            </div>

            {/* ROW 2: SELECTORS + CENTER TITLE */}
            <div className="w-full px-4 flex items-center justify-between gap-2">
                {/* Visual LEFT (Voice Selector) */}
                <div className="flex-1 flex justify-end">
                    <div className="relative group cursor-pointer">
                        <button onClick={() => setOpenDropdown(openDropdown === 'VOICE' ? null : 'VOICE')} className="flex items-center gap-1 outline-none px-2.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 hover:border-primary-500/30 text-slate-300 hover:text-white transition-all hover:scale-[1.03]">
                            <span className="text-[10px] md:text-sm font-bold text-slate-400">گوینده:</span>
                            <span className="text-[10px] md:text-sm font-extrabold text-primary-400">{getVoiceLabel(selectedVoice)}</span>
                            <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 ${openDropdown === 'VOICE' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {openDropdown === 'VOICE' && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[140px] bg-slate-900/95 border border-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                {VOICES.map(v => (
                                    <div key={v.id} onClick={() => { setSelectedVoice(v.id); setOpenDropdown(null); }} className={`px-4 py-2.5 text-xs cursor-pointer flex items-center justify-between border-b border-slate-800/40 last:border-0 transition-colors ${selectedVoice === v.id ? 'bg-primary-500/25 text-primary-300 font-extrabold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-primary-400'}`}><span className="font-bold">{v.name}</span><span className="text-[9px] opacity-70">{v.description}</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* CENTER TITLE */}
                <div className="flex-[2] flex flex-col items-center justify-center relative">
                    {(inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') && (
                        <div className="relative group cursor-pointer inline-flex items-center justify-center">
                            <button onClick={() => setOpenDropdown(openDropdown === 'TIMEFRAME' ? null : 'TIMEFRAME')} className="flex items-center gap-1.5 outline-none px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 hover:border-cyan-400/50 text-white transition-all hover:scale-[1.03]">
                                <span className="text-xs md:text-lg font-black text-white tracking-wide whitespace-nowrap drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]">
                                    {inputType === 'DAILY_TOPIC' ? 'مرور اخبار روز' : 'مرور اخبار هفتگی'}
                                </span>
                                <svg className={`w-3 h-3 md:w-4 md:h-4 text-slate-300 transition-transform duration-200 ${openDropdown === 'TIMEFRAME' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'TIMEFRAME' && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[160px] md:w-[180px] bg-slate-900/95 border border-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                    <div onClick={() => { setInputType('DAILY_TOPIC'); setOpenDropdown(null); }} className={`px-4 py-3.5 text-xs md:text-sm cursor-pointer flex items-center justify-between border-b border-slate-800/40 transition-colors ${inputType === 'DAILY_TOPIC' ? 'bg-primary-500/25 text-primary-400 font-black' : 'text-slate-400 hover:bg-slate-800/80 hover:text-primary-400'}`}>
                                        مرور اخبار روز
                                        {inputType === 'DAILY_TOPIC' && <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>}
                                    </div>
                                    <div onClick={() => { setInputType('TOPIC'); setOpenDropdown(null); }} className={`px-4 py-3.5 text-xs md:text-sm cursor-pointer flex items-center justify-between transition-colors ${inputType === 'TOPIC' ? 'bg-primary-500/25 text-primary-400 font-black' : 'text-slate-400 hover:bg-slate-800/80 hover:text-primary-400'}`}>
                                        مرور اخبار هفتگی
                                        {inputType === 'TOPIC' && <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Visual RIGHT (Style Selector) */}
                <div className="flex-1 flex justify-start">
                    <div className="relative group cursor-pointer transition-opacity duration-300" style={{ opacity: (inputType === 'URL' || inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') ? 1 : 0, pointerEvents: (inputType === 'URL' || inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') ? 'auto' : 'none' }}>
                        <button onClick={() => setOpenDropdown(openDropdown === 'STYLE' ? null : 'STYLE')} className="flex items-center gap-1.5 outline-none px-2.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 hover:border-primary-500/30 text-slate-300 hover:text-white transition-all hover:scale-[1.03]">
                            <span className="text-[10px] md:text-sm font-bold text-slate-400">سبک:</span>
                            <span className="text-[10px] md:text-sm font-extrabold text-primary-400">{getStyleLabel(analysisStyle)}</span>
                            <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 ${openDropdown === 'STYLE' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {openDropdown === 'STYLE' && (
                            <div className="absolute top-full right-1/3 mt-2 w-[150px] bg-slate-900/95 border border-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                {STYLES.map((style) => (
                                    <div key={style.id} onClick={() => { setAnalysisStyle(style.id); setOpenDropdown(null); }} className={`px-4 py-2.5 text-xs cursor-pointer flex flex-col gap-0.5 border-b border-slate-800/40 last:border-0 transition-colors ${analysisStyle === style.id ? 'bg-primary-500/25 text-primary-300 font-extrabold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-primary-400'}`}><span className="font-bold">{style.label}</span><span className="text-[8px] opacity-70">{style.desc}</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ROW 3: DESCRIPTION (Topic Specific) */}
            {(inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') && viewMode === 'INPUT' && (
                <p className="text-slate-400 text-xs md:text-sm leading-5 max-w-[90%] mx-auto text-center font-bold opacity-80 -mt-1 bg-slate-900/20 px-3 py-1 rounded-full border border-slate-800/10 backdrop-blur-xs">
                    {inputType === 'DAILY_TOPIC' ? 'موضوع مورد علاقه خود را انتخاب کنید تا تمامی اخبار مهم امروز را با سبک دلخواه شما روایت کنیم.' : 'موضوع مورد علاقه خود را انتخاب کنید تا اخبار مهم ۷ روز گذشته را با سبک دلخواه شما روایت کنیم.'}
                </p>
            )}
        </div>

        {/* HISTORY DRAWER */}
        <div className={`absolute inset-y-0 right-0 w-64 bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 z-50 transition-transform duration-300 ease-out shadow-2xl ${showHistory ? 'translate-x-0' : 'translate-x-full'}`} ref={historyRef}>
             <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                 <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>تاریخچه تحلیل‌ها</h3>
                 <div className="flex items-center gap-2">
                     {history.length > 0 && (
                         <button onClick={clearAllHistory} className="text-slate-500 hover:text-rose-500 transition-colors p-1" title="پاک کردن همه"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                     )}
                     <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                 </div>
             </div>
             <div className="overflow-y-auto h-[calc(100%-57px)] p-2 space-y-2 no-scrollbar">
                 {history.length === 0 ? <div className="text-center py-10 text-slate-600 text-xs">هنوز تحلیلی انجام نشده است.</div> : history.map(item => (
                         <div key={item.id} onClick={() => restoreHistoryItem(item)} className="group p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-primary-500/30 cursor-pointer transition-all relative overflow-hidden">
                             <div className="flex justify-between items-start mb-1"><span className="text-[10px] text-primary-400 font-bold uppercase tracking-wider">{item.sourceType === 'topic' ? 'موضوع' : (item.sourceType === 'url' ? 'خبر' : 'متن')}</span><span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleDateString('fa-IR')}</span></div>
                             <h4 className="text-xs font-bold text-slate-300 leading-tight mb-1 line-clamp-2">{item.meta?.topicLabel || item.meta?.title || item.text.substring(0, 40) + "..."}</h4>
                             <div className="flex justify-between items-end mt-2"><span className="text-[9px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded">{getStyleLabel(item.meta?.analysisStyle || 'podcast')}</span><button onClick={(e) => deleteHistoryItem(e, item.id)} className="text-slate-600 hover:text-rose-500 p-1 rounded hover:bg-rose-950/30 transition-colors opacity-0 group-hover:opacity-100" title="حذف"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div>
                         </div>
                     ))}
             </div>
        </div>

        {/* CENTER CONTENT AREA */}
        <div className="flex-1 relative overflow-hidden flex flex-col w-full">
            <div className={`absolute inset-0 px-6 pt-2 pb-14 transition-all duration-500 ease-out transform ${viewMode === 'INPUT' ? 'opacity-100 translate-x-0 z-20' : 'opacity-0 translate-x-10 -z-10 pointer-events-none'}`}>
                 <div className="h-full flex flex-col pt-0 gap-1 items-center overflow-hidden pb-2">
                     {(inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') && (
                         <div className="w-full flex-1 min-h-0 flex flex-col items-center gap-2 pb-0">
                             <div className="w-full flex-none relative group mb-0">
                                 <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-purple-500/10 rounded-xl blur-sm group-hover:blur-md transition-all"></div>
                                 <input type="text" value={customTopic} onChange={(e) => { setCustomTopic(e.target.value); if (e.target.value) setSelectedTopic(''); }} onKeyDown={handleInputKeyDown} placeholder="یک موضوع خبری یا یک خبر خاص را بنویسید" className={`w-full h-10 md:h-12 bg-slate-900/80 border ${customTopic ? 'border-primary-500 shadow-[0_0_12px_rgba(34,211,238,0.2)]' : 'border-slate-700'} rounded-xl px-4 text-xs font-medium text-center text-white placeholder-slate-500 focus:outline-none focus:border-primary-400 transition-all z-10 relative`} />
                                 {!customTopic && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none z-20"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>}
                             </div>
                             <div className="w-full flex-1 overflow-y-auto pr-1 select-none min-h-0 no-scrollbar">
                                 <div className="grid grid-cols-2 gap-2 mt-1 pb-4">
                                {TOPICS.map((topic) => (
                                    <button 
                                        key={topic.id} 
                                        onClick={() => { setSelectedTopic(topic.id); setCustomTopic(''); }} 
                                        className={`relative group w-full min-h-[64px] sm:min-h-[76px] py-1.5 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${
                                            selectedTopic === topic.id 
                                                ? 'scale-[1.01] bg-slate-800/90 border-primary-500 shadow-[0_0_15px_rgba(34,211,238,0.25)] ring-1 ring-primary-500/30' 
                                                : 'bg-slate-900/50 border-slate-800 hover:border-slate-705 hover:border-slate-700 hover:bg-slate-900/70 active:scale-95'
                                        }`}
                                    >
                                        <div className={`p-1 rounded-full transition-colors ${selectedTopic === topic.id ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-800 text-slate-550 text-slate-500 group-hover:text-slate-300'}`}>{topic.icon}</div>
                                        <span className={`text-[11px] sm:text-xs md:text-sm font-bold leading-tight ${selectedTopic === topic.id ? 'text-white' : 'text-slate-350'}`}>{topic.label}</span>
                                        {(topic.id === 'cinema_iran' || topic.id === 'music_iran') ? <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" title="منابع داخلی"></span> : <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" title="منابع جهانی"></span>}
                                    </button>
                                ))}
                                 </div>
                             </div>
                         </div>
                     )}
                     {inputType === 'TEXT' && (
                         <>
                            <div className="w-full flex items-center justify-between px-1 mb-1">
                                <span className="text-[10px] font-bold text-slate-400">تغییر سبک متن:</span>
                                <div className="flex items-center bg-slate-900/50 rounded-lg p-0.5 border border-slate-800">
                                    {REWRITE_STYLES.map((style) => (
                                        <button key={style.id} onClick={() => setRewriteStyle(style.id)} className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${rewriteStyle === style.id ? 'bg-primary-500 text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>{style.label}</button>
                                    ))}
                                </div>
                            </div>
                            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="متن خود را اینجا بنویسید..." className="w-full h-[180px] sm:h-[240px] bg-slate-900/50 rounded-2xl border border-slate-800 text-sm leading-relaxed text-slate-200 placeholder-slate-700 focus:ring-0 focus:border-primary-500/50 resize-none p-3 transition-all" />
                         </>
                     )}
                     {inputType === 'URL' && (
                         <div className="w-full flex flex-col items-center gap-4 mt-4">
                             <div className="text-center space-y-2">
                                 <h2 className="text-xl font-bold text-white tracking-tight">تحلیل خبر</h2>
                                 <p className="text-slate-400 text-[11px] leading-5 max-w-[80%] mx-auto">لینک خبر را وارد کنید تا هوش مصنوعی آن را بررسی، صحت‌سنجی و طبق سبک انتخابی شما تحلیل کند.</p>
                             </div>
                             <input value={newsUrl} onChange={(e) => setNewsUrl(e.target.value)} onKeyDown={handleInputKeyDown} type="url" dir="ltr" placeholder="https://website.com/news/..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-xs text-primary-400 placeholder-slate-700 focus:border-primary-500 focus:shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all outline-none" />
                         </div>
                     )}
                     {/* Circular Main Action Button (Textless Z-button) */}
                     <button 
                       onClick={handleMainAction} 
                       disabled={isProcessing || (inputType === 'TEXT' && !text) || (inputType === 'URL' && !newsUrl) || ((inputType === 'TOPIC' || inputType === 'DAILY_TOPIC') && !selectedTopic && !customTopic)} 
                       className={`relative flex-none w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-full flex items-center justify-center transition-all duration-500 ${isProcessing ? 'scale-[1.05] shadow-[0_0_40px_rgba(34,211,238,0.4)] ring-2 ring-cyan-400' : 'shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:scale-105 active:scale-95 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]'} bg-slate-900 border border-primary-500/40 group disabled:opacity-50 disabled:scale-100 disabled:shadow-none -mt-4 mb-2.5 mx-auto`}
                       title={isProcessing ? 'در حال پردازش...' : 'اجرا (Z)'}
                     >
                        <div className="flex items-center justify-center">
                           <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 md:w-10 md:h-10 transition-all duration-300 ${isProcessing ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>
                               <defs>
                                   <linearGradient id="btnSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f8fafc" /><stop offset="100%" stopColor="#475569" /></linearGradient>
                                   <mask id="z-mask"><path d="M8 8H32L8 32H32" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></mask>
                               </defs>
                               <path d="M8 8H32L8 32H32" stroke="url(#btnSilver)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                               {isProcessing ? (
                                   <rect x="0" y="0" width="40" height="40" fill="#22d3ee" mask="url(#z-mask)" className="opacity-50"><animate attributeName="x" from="-40" to="40" dur="1s" repeatCount="indefinite" /></rect>
                               ) : null}
                               <path d="M4 20H10L14 12L20 28L26 16L30 20H36" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-opacity duration-300 ${isProcessing ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
                           </svg>
                        </div>
                        {isProcessing && (
                            <div className="absolute inset-0 rounded-full border border-primary-400 opacity-0 animate-ping"></div>
                        )}
                        {!isProcessing && (
                            <div className="absolute inset-0 bg-primary-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        )}
                     </button>
                 </div>
            </div>

            <div className={`absolute inset-0 px-4 flex flex-col transition-all duration-500 ease-out transform ${viewMode === 'CHAT' ? 'opacity-100 translate-x-0 z-20' : 'opacity-0 -translate-x-10 -z-10 pointer-events-none'}`}>
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar space-y-4 py-2 pb-4">
                    <div className={`bg-slate-900/40 border rounded-2xl p-4 pb-12 relative group transition-colors duration-500 ${mainCredVis.border} ${mainCredVis.shadow}`}>
                        <button onClick={handleBackToInput} className="absolute -top-2 left-4 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-950 text-slate-400 hover:text-white hover:border-primary-500/50 hover:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all flex items-center gap-1 text-[9px] font-bold shadow-lg z-10"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg><span>بازگشت</span></button>
                        {credibility && <div className={`absolute -top-2 right-4 px-2 py-0.5 rounded-full border bg-slate-950 ${mainCredVis.color} ${mainCredVis.border} flex items-center gap-1.5 text-[9px] font-bold shadow-lg`}><span className="text-xs leading-none">{mainCredVis.icon}</span><span>{credibility.label}</span></div>}
                        {(() => {
                          const paragraphs = parseNewsItems(text);
                          if (paragraphs.length === 0) {
                            return <p className={`text-[11px] leading-5 text-slate-300 text-right whitespace-pre-line pb-2 ${credibility ? 'pt-1' : ''}`}>{text}</p>;
                          }
                          return (
                            <div className={`text-[11.5px] leading-6 text-slate-300 text-right space-y-3 pb-2 break-words ${credibility ? 'pt-1' : ''}`}>
                              {paragraphs.map((paragraph, idx) => (
                                <div key={idx} className="relative group select-text pb-2.5 transition-colors duration-200">
                                  <span className="hover:text-white transition-colors duration-200 whitespace-pre-line">{paragraph}</span>
                                  <button
                                    onClick={() => handleOpenSupplementaryDetail(paragraph)}
                                    className="inline-flex items-center justify-center mr-1.5 ml-1.5 p-0.5 w-4.5 h-4.5 rounded-full bg-primary-500/10 hover:bg-primary-500 text-primary-400 hover:text-slate-950 border border-primary-500/20 hover:border-transparent transition-all hover:scale-110 align-middle group/icon focus:outline-none"
                                    title="اطلاعات تکمیلی و منابع معتبر"
                                  >
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        {sources.length > 0 && <div className="mt-2 pt-2 border-t border-slate-700/30"><span className="text-[9px] text-slate-400 font-bold mb-1 block opacity-70">منابع خبری</span><div className="flex flex-wrap gap-1.5">{sources.map((src, idx) => <a key={idx} href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800/50 hover:bg-slate-700 rounded-md text-[9px] text-slate-300 hover:text-primary-300 transition-colors border border-transparent hover:border-slate-600"><span className="w-1 h-1 rounded-full bg-primary-500/50"></span><span className="max-w-[100px] truncate">{src.title || new URL(src.url).hostname}</span></a>)}</div></div>}
                        <div className="absolute bottom-2 left-3 flex items-center gap-2">
                             <button onClick={handleShare} className="w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-700 shadow-sm" title="کپی متن و منابع">{isCopied ? <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}</button>
                             <button onClick={() => handlePlayText(text, 'main')} disabled={generatingId !== null} className="w-7 h-7 rounded-full bg-primary-500/20 hover:bg-primary-500 text-primary-400 hover:text-white flex items-center justify-center transition-all shadow-[0_0_8px_rgba(34,211,238,0.1)]">{generatingId === 'main' ? <span className="block w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span> : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}</button>
                        </div>
                    </div>
                    {chatMessages.map(msg => { const msgCredVis = getCredibilityVisuals(msg.credibility); return (
                             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                 <div className={`relative max-w-[90%] rounded-2xl px-3 py-2 text-xs shadow-sm ${msg.role === 'user' ? 'bg-primary-900/30 text-white border border-primary-500/20' : `bg-slate-900/60 text-slate-300 border ${msgCredVis.border || 'border-slate-700'}`}`}>
                                     {msg.role === 'model' && msg.credibility && <div className={`absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-full border bg-slate-950/80 ${msgCredVis.color} ${msgCredVis.border} flex items-center gap-1 text-[8px] font-bold`}><span>{msgCredVis.icon}</span></div>}
                                     <p className={msg.role === 'model' ? 'pb-1.5 leading-5' : ''}>{msg.text}</p>
                                     {msg.role === 'model' && msg.sources && msg.sources.length > 0 && <div className="mt-1 pt-1 border-t border-white/5 flex flex-wrap gap-1 pb-3">{msg.sources.map((src, idx) => <a key={idx} href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-1 py-0.5 bg-black/20 hover:bg-black/40 rounded text-[8px] text-slate-400 hover:text-primary-300 transition-colors"><span className="w-1 h-1 rounded-full bg-slate-500"></span><span className="max-w-[70px] truncate">{src.title || new URL(src.url).hostname}</span></a>)}</div>}
                                     {msg.role === 'model' && <div className="absolute bottom-1.5 left-2"><button onClick={() => handlePlayText(msg.text, msg.id)} disabled={generatingId !== null} className="w-5 h-5 rounded-full bg-slate-700/50 hover:bg-primary-500 text-slate-400 hover:text-white flex items-center justify-center transition-all">{generatingId === msg.id ? <span className="block w-1 h-1 bg-current rounded-full animate-bounce"></span> : <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}</button></div>}
                                 </div>
                             </div>
                         ); })}
                    <div ref={chatEndRef} />
                </div>
                <div className="flex-none pt-1 pb-2">
                     {suggestedQuestions.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1.5 mb-1 no-scrollbar">{suggestedQuestions.map((q,i) => <button key={i} onClick={() => handleSendMessage(q)} className="whitespace-nowrap px-2.5 py-0.5 bg-slate-800/50 border border-slate-700 rounded-full text-[9px] text-slate-400 hover:text-primary-400 hover:border-primary-500 transition-colors backdrop-blur-sm">{q}</button>)}</div>}
                     <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5 shadow-lg">
                         <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={status === AppStatus.ANALYZING ? "در حال تحقیق و بررسی..." : "سوال تکمیلی بپرسید..."} disabled={status === AppStatus.ANALYZING} className="flex-1 bg-transparent border-none text-xs px-2 py-2 focus:ring-0 text-slate-200 disabled:opacity-50" onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                         <button onClick={() => handleSendMessage()} disabled={status === AppStatus.ANALYZING} className={`bg-primary-500 rounded-full p-1.5 text-slate-950 transition-colors ${status === AppStatus.ANALYZING ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-400'}`}>{status === AppStatus.ANALYZING ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>}</button>
                     </div>
                </div>
            </div>
        </div>

        {audioUrl && (
            <div className={`absolute left-0 right-0 z-[70] px-4 flex justify-center ${isPlayerMinimized ? 'bottom-6 md:bottom-10 pointer-events-none' : 'bottom-4 md:bottom-8 pointer-events-none animate-in slide-in-from-bottom-5'}`}>
                <div 
                    ref={playerRef}
                    style={{ transform: `translate(${playerPos.x}px, ${playerPos.y}px)`, touchAction: 'none' }}
                    className={`pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${isDraggingPlayer ? 'ring-2 ring-primary-500/50 cursor-grabbing' : 'transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]'} overflow-hidden ${isPlayerMinimized ? 'w-[320px] sm:w-[360px] h-12 rounded-full' : 'w-full max-w-md rounded-[24px] pb-1'}`}
                >
                    {isPlayerMinimized ? (
                        <div className="w-full h-full flex items-center justify-between px-3 select-none">
                            <div 
                                onMouseDown={handleDragStart}
                                onTouchStart={handleDragStart}
                                className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-primary-400 p-1 flex-none flex items-center"
                                title="جابجایی (برای جابجایی بکشید)"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0 mr-1.5">
                                <button onClick={handleClosePlayer} className="text-slate-500 hover:text-rose-500 transition-colors p-1" title="بستن"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                <button onClick={togglePlayPause} className="w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all">{status === AppStatus.PLAYING ? <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg> : <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}</button>
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <div className="h-0.5 bg-slate-800 rounded-full flex-1 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 h-full bg-primary-500" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
                                    </div>
                                    <span className="text-[8px] font-mono text-cyan-400 w-8 text-center flex-none">{formatTime(currentTime)}</span>
                                </div>
                            </div>
                            <button onClick={toggleMinimize} className="text-slate-400 hover:text-primary-400 p-2 flex-none" title="بزرگ کردن"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                        </div>
                    ) : (
                        <div className="relative w-full">
                            {/* Drag Handle Bar at top of Maximized player */}
                            <div 
                                onMouseDown={handleDragStart}
                                onTouchStart={handleDragStart}
                                className="w-full h-5 cursor-grab active:cursor-grabbing hover:bg-slate-800/40 select-none flex items-center justify-center border-b border-slate-800/30 transition-colors"
                                title="برای جابجایی بکشید"
                            >
                                <div className="w-12 h-1 bg-slate-700/80 hover:bg-primary-500 rounded-full transition-colors flex gap-0.5"></div>
                            </div>
                            <div className="absolute top-5 right-0 z-30 flex items-center p-1.5 gap-1 bg-gradient-to-l from-slate-900/90 to-transparent rounded-tr-[24px]">
                                <button onClick={toggleMinimize} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-slate-800 transition-all" title="کوچک کردن"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                                <button onClick={handleClosePlayer} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-950/30 transition-all" title="بستن"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="h-10 w-full relative group cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const pos = (e.clientX - rect.left) / rect.width; if (usingSpeechSynthesis) { setCurrentTime(pos * duration); } else if (audioRef.current && isFinite(duration)) { audioRef.current.currentTime = pos * duration; } }}><div className="absolute inset-0 opacity-20"><AudioVisualizer isPlaying={status === AppStatus.PLAYING} /></div><div className="absolute bottom-0 left-0 h-1 bg-primary-500 transition-all duration-200" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div><div className="absolute bottom-0 w-full h-1 bg-slate-800/50 -z-10"></div></div>
                            <div className="flex justify-between px-4 pt-1.5 -mt-1"><span className="text-[10px] font-mono font-bold text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]">{formatTime(currentTime)}</span><span className="text-[10px] font-mono font-bold text-slate-400">{formatTime(duration)}</span></div>
                            <div className="flex items-center justify-between px-6 py-2.5 pt-0.5"><div className="flex items-center gap-3"><button onClick={handleDownload} className="text-slate-500 hover:text-primary-400 transition-colors" title="دانلود"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button><button onClick={cycleSpeed} className="w-8 text-[10px] font-mono font-bold text-slate-500 hover:text-primary-400 transition-colors">{playbackRate}x</button></div><button onClick={togglePlayPause} className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-slate-900 shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:scale-105 transition-transform">{status === AppStatus.PLAYING ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" /></svg> : <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>}</button><button onClick={() => { if (viewMode === 'INPUT') setViewMode('CHAT'); else handleBackToInput(); }} className={`p-1.5 rounded-xl border transition-all ${viewMode === 'CHAT' ? 'bg-slate-900 border-primary-500 text-primary-400' : 'border-transparent text-slate-500 hover:text-white'}`} title={viewMode === 'INPUT' ? "نمایش تحلیل" : "بازگشت به ورودی"}>{viewMode === 'INPUT' ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>}</button></div>
                        </div>
                    )}
                </div>
            </div>
        )}
        {showLongWaitMessage && (status === AppStatus.GENERATING) && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-amber-500/90 text-slate-900 px-3 py-1.5 rounded-full shadow-lg z-[60] animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-2 backdrop-blur-sm"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="text-[10px] font-bold">در حال آماده‌سازی پادکست، صبور باشید...</span></div>}

        {/* Supplementary Detail Modal Popup */}
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-sm max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative flex flex-col gap-3 overflow-hidden animate-in scale-in duration-200" dir="rtl">
              
              {/* Decorative gradient blur */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl pointer-events-none"></div>

              {/* Modal Title */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 relative z-10 flex-none">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  تحلیل و جزئیات تکمیلی خبر
                </h3>
                <button 
                  onClick={() => { setIsDetailModalOpen(false); setSelectedSentenceForDetail(null); }} 
                  className="text-slate-500 hover:text-white hover:bg-slate-800 rounded-full p-1 transition-all focus:outline-none"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Selected Source Sentence Quote */}
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 relative z-10 flex-none">
                <span className="text-[8px] text-slate-500 font-bold block mb-0.5">خبر مرتبط:</span>
                <p className="text-[10.5px] text-slate-400 text-right leading-relaxed italic">«{selectedSentenceForDetail}»</p>
              </div>

              {/* Main Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto no-scrollbar py-1 relative z-10 pr-1 select-text">
                {detailLoading ? (
                  <div className="h-full min-h-[140px] flex flex-col items-center justify-center py-10 gap-3">
                    <div className="w-8 h-8 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"></div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-slate-200">در حال پژوهش و بررسی منابع خبری...</p>
                      <p className="text-[8.5px] text-slate-500 mt-1">منتظر بمانید، اطلاعات تکمیلی در حال گردآوری است</p>
                    </div>
                  </div>
                ) : detailResult ? (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="space-y-1">
                      <span className="text-[8.5px] text-slate-500 font-bold block">متن تکمیلی و تحلیل مفید:</span>
                      <p className="text-[11px] leading-5 text-slate-200 text-justify whitespace-pre-line">{detailResult.summary}</p>
                    </div>
                    
                    {/* Sources section inside the scrollable container */}
                    {detailResult.sources && detailResult.sources.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                        <span className="text-[8.5px] text-primary-400 font-extrabold flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                          لینکهای معتبر مربوط:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {detailResult.sources.map((src, index) => (
                            <a 
                              key={index} 
                              href={src.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-950/50 hover:bg-slate-850 border border-slate-800 rounded-md text-[8.5px] text-slate-300 hover:text-white transition-all duration-300 max-w-full"
                              title={src.title}
                            >
                              <span className="w-1 h-1 rounded-full bg-primary-500/60"></span>
                              <span className="truncate max-w-[125px]">{src.title}</span>
                              <span className="text-[7.5px] text-primary-400 font-mono">↗</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Close button in footer */}
              <div className="relative z-10 pt-1.5 border-t border-slate-800/60 flex justify-end flex-none">
                <button 
                  onClick={() => { setIsDetailModalOpen(false); setSelectedSentenceForDetail(null); }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all focus:outline-none"
                >
                  بستن
                </button>
              </div>

            </div>
          </div>
        )}


    </div>
  );
};
