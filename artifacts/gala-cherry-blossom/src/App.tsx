import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import Lenis from "lenis";

const TOTAL_FRAMES = 192;
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const SCROLL_HEIGHT_VH = 2600;
const YT_VIDEO_ID = "mihXUwMb-FY";

function padFrame(index: number) {
  return index.toString().padStart(5, "0");
}
function getFrameUrl(index: number) {
  return `${BASE_URL}/frames/frame_${padFrame(index)}.webp`;
}

function spawnBurst(container: HTMLElement, x: number, y: number, isHeart = false) {
  const count = isHeart ? 14 : 10;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");

    if (isHeart) {
      el.innerHTML = ["♥", "♡", "❤"][Math.floor(Math.random() * 3)];
      const size = Math.random() * 18 + 12;
      const hue = Math.floor(Math.random() * 40 + 330);
      el.style.cssText = `position:absolute;font-size:${size}px;color:hsl(${hue},80%,65%);left:${x}px;top:${y}px;pointer-events:none;z-index:9999;text-shadow:0 0 8px rgba(255,100,150,0.6);`;
    } else {
      el.className = "petal burst-petal";
      const size = Math.random() * 8 + 6;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.opacity = "0.9";
    }

    container.appendChild(el);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = Math.random() * (isHeart ? 130 : 90) + (isHeart ? 80 : 60);
    const duration = Math.random() * 600 + (isHeart ? 1000 : 700);
    const rotateAmt = Math.random() * 480 - 240;
    const anim = el.animate(
      [
        { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: isHeart ? 1 : 0.9 },
        { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance - (isHeart ? 60 : 0)}px) rotate(${rotateAmt}deg) scale(${isHeart ? 0.4 : 1})`, opacity: 0 },
      ],
      { duration, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
    );
    anim.onfinish = () => el.remove();
  }
}

function spawnFloatingHeart(container: HTMLElement) {
  const el = document.createElement("div");
  el.innerHTML = ["♥", "♡", "❤", "💗"][Math.floor(Math.random() * 4)];
  const size = Math.random() * 16 + 10;
  const x = Math.random() * window.innerWidth;
  el.style.cssText = `position:absolute;font-size:${size}px;color:hsl(${Math.floor(Math.random() * 30 + 340)},75%,${Math.floor(Math.random() * 20 + 60)}%);left:${x}px;bottom:0;pointer-events:none;z-index:30;opacity:0.7;`;
  container.appendChild(el);
  const driftX = (Math.random() - 0.5) * 80;
  const dur = Math.random() * 3000 + 3000;
  const anim = el.animate(
    [
      { transform: "translateY(0) translateX(0) scale(1)", opacity: 0.7 },
      { transform: `translateY(-${window.innerHeight + 60}px) translateX(${driftX}px) scale(0.5)`, opacity: 0 },
    ],
    { duration: dur, easing: "ease-in-out" }
  );
  anim.onfinish = () => el.remove();
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [loadedPercent, setLoadedPercent] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>(new Array(TOTAL_FRAMES));
  const [isMuted, setIsMuted] = useState(true);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);

  const progress = useMotionValue(0);
  const smoothProgress = useSpring(progress, { stiffness: 120, damping: 24, mass: 0.5, restDelta: 0.0005 });

  // Lenis + progress tracker
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.3,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });
    const updateProgress = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalScrollable = el.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const p = totalScrollable > 0 ? scrolled / totalScrollable : 0;
      progress.set(Math.min(1, Math.max(0, p)));
    };
    function raf(time: number) { lenis.raf(time); updateProgress(); requestAnimationFrame(raf); }
    const rafId = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(rafId); lenis.destroy(); };
  }, [progress]);

  // Frame preloading
  useEffect(() => {
    let loaded = 0;
    const initialBatch = 30;
    const loadFrame = (i: number, isInitial: boolean) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.src = getFrameUrl(i);
        img.onload = () => {
          imagesRef.current[i] = img;
          loaded++;
          if (isInitial) setLoadedPercent(Math.floor((loaded / initialBatch) * 100));
          resolve();
        };
        img.onerror = () => resolve();
      });
    const preload = async () => {
      await Promise.all(Array.from({ length: initialBatch }, (_, i) => loadFrame(i, true)));
      setIsLoaded(true);
      for (let i = initialBatch; i < TOTAL_FRAMES; i++) loadFrame(i, false);
    };
    preload();
  }, []);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resizeCanvas = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    let animationFrameId: number;
    let currentDrawnIndex = -1;
    const render = () => {
      const p = smoothProgress.get();
      const images = imagesRef.current;
      const targetIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(p * (TOTAL_FRAMES - 1))));
      let drawIndex = targetIndex;
      if (!images[drawIndex]) {
        let found = -1;
        for (let d = 1; d < TOTAL_FRAMES; d++) {
          if (images[targetIndex - d]) { found = targetIndex - d; break; }
          if (images[targetIndex + d]) { found = targetIndex + d; break; }
        }
        drawIndex = found >= 0 ? found : drawIndex;
      }
      if (drawIndex !== currentDrawnIndex && images[drawIndex]) {
        const img = images[drawIndex];
        const canvasRatio = window.innerWidth / window.innerHeight;
        const imgRatio = img.width / img.height;
        let drawWidth, drawHeight, offsetX, offsetY;
        if (canvasRatio > imgRatio) {
          drawWidth = window.innerWidth; drawHeight = window.innerWidth / imgRatio;
          offsetX = 0; offsetY = (window.innerHeight - drawHeight) / 2;
        } else {
          drawHeight = window.innerHeight; drawWidth = window.innerHeight * imgRatio;
          offsetX = (window.innerWidth - drawWidth) / 2; offsetY = 0;
        }
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.fillStyle = "#0d0c0b";
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        const zoom = 1 + p * 0.05;
        ctx.save();
        ctx.translate(window.innerWidth / 2, window.innerHeight / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-window.innerWidth / 2, -window.innerHeight / 2);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        ctx.fillStyle = `rgba(255, 230, 220, ${0.05 + p * 0.1})`;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.restore();
        currentDrawnIndex = drawIndex;
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => { window.removeEventListener("resize", resizeCanvas); cancelAnimationFrame(animationFrameId); };
  }, [isLoaded, smoothProgress]);

  // Ambient petals + click burst
  useEffect(() => {
    if (!isLoaded) return;
    const container = document.getElementById("petal-container");
    if (!container) return;
    const petalCount = window.innerWidth < 768 ? 15 : 40;
    const petals: HTMLDivElement[] = [];
    const rafIds: number[] = [];
    for (let i = 0; i < petalCount; i++) {
      const petal = document.createElement("div");
      petal.className = "petal";
      petal.style.width = Math.random() * 8 + 6 + "px";
      petal.style.height = Math.random() * 8 + 6 + "px";
      petal.style.left = Math.random() * 100 + "vw";
      petal.style.top = Math.random() * 100 + "vh";
      petal.style.opacity = (Math.random() * 0.5 + 0.3).toString();
      container.appendChild(petal);
      petals.push(petal);
      const speed = Math.random() * 1 + 0.5;
      const sway = Math.random() * 2 + 1;
      let angle = Math.random() * Math.PI * 2;
      let y = parseFloat(petal.style.top);
      let x = parseFloat(petal.style.left);
      const animatePetal = () => {
        angle += 0.02; y += speed; x += Math.sin(angle) * sway * 0.5;
        if (y > window.innerHeight + 20) { y = -20; x = Math.random() * window.innerWidth; }
        if (x > window.innerWidth + 20) x = -20;
        if (x < -20) x = window.innerWidth + 20;
        petal.style.top = y + "px"; petal.style.left = x + "px";
        petal.style.transform = `rotate(${angle * 20}deg)`;
        rafIds.push(requestAnimationFrame(animatePetal));
      };
      rafIds.push(requestAnimationFrame(animatePetal));
    }
    const handlePointer = (e: PointerEvent) => spawnBurst(container, e.clientX, e.clientY);
    window.addEventListener("pointerdown", handlePointer);
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      rafIds.forEach((id) => cancelAnimationFrame(id));
      petals.forEach((p) => p.remove());
    };
  }, [isLoaded]);

  // YouTube mute/unmute via postMessage
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (ytIframeRef.current?.contentWindow) {
      ytIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: newMuted ? "muteVideo" : "unMuteVideo", args: [] }),
        "*"
      );
    }
  }, [isMuted]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#fdfaf6] flex flex-col items-center justify-center z-50">
        <motion.h1
          className="text-4xl md:text-6xl font-serif text-[#4a3f3a] mb-8 opacity-80 tracking-widest"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          For Gala
        </motion.h1>
        <div className="w-64 h-1 bg-[#e0d6d0] rounded-full overflow-hidden">
          <div className="h-full bg-[#d28a95] transition-all duration-300 ease-out" style={{ width: `${loadedPercent}%` }} />
        </div>
        <p className="mt-4 text-sm text-[#8c7b74] italic">Unfolding a memory... {loadedPercent}%</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1817]">
      {/* Hidden YouTube iframe — muted by default, unmuted on user click */}
      <iframe
        ref={ytIframeRef}
        className="hidden"
        src={`https://www.youtube.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_VIDEO_ID}&enablejsapi=1&controls=0`}
        allow="autoplay; encrypted-media"
        title="67 music"
      />

      {/* Fixed HUD */}
      <div className="fixed inset-0 pointer-events-none z-40">
        {/* Progress bar */}
        <motion.div className="absolute top-0 left-0 right-0 h-1 bg-white/20 origin-left" style={{ scaleX: smoothProgress }} />

        {/* Music player widget */}
        <div className="absolute top-5 right-5 pointer-events-auto flex flex-col items-end gap-2">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5"
          >
            {/* Animated sound bars */}
            <div className="flex items-end gap-[2px] h-4 w-5">
              {[0.4, 1, 0.6, 0.9, 0.5].map((h, i) => (
                <motion.div
                  key={i}
                  className={`w-[3px] rounded-sm ${isMuted ? "bg-white/30" : "bg-[#f2a0b0]"}`}
                  animate={isMuted ? { scaleY: 0.3 } : { scaleY: [h, 1, h * 0.6, 0.9, h] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                  style={{ height: "100%", transformOrigin: "bottom" }}
                />
              ))}
            </div>
            <span className="text-[10px] text-white/60 font-sans tracking-widest uppercase">67</span>
            <button
              onClick={toggleMute}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label={isMuted ? "Play music" : "Mute music"}
            >
              {isMuted ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              )}
            </button>
          </motion.div>
          <AnimatePresence>
            {!isMuted && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="text-[10px] text-white/40 font-sans tracking-widest italic pr-1"
              >
                ♪ 67 — Six Seven Dance
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ScrollHint progress={smoothProgress} />
        </div>

        <div id="petal-container" className="absolute inset-0 overflow-hidden" />
        <div className="absolute inset-0 bg-radial-[circle_at_center] from-transparent to-black/40 pointer-events-none" />
      </div>

      {/* Main scroll container */}
      <div ref={containerRef} className="relative" style={{ height: `${SCROLL_HEIGHT_VH}vh` }}>
        <div className="sticky top-0 w-full h-screen overflow-hidden">
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
          <Messages progress={smoothProgress} />
        </div>
      </div>

      <Kid67Section />
      <EnvelopeSection />
      <MusicSection />
    </div>
  );
}

// ─── Scroll Hint ──────────────────────────────────────────────────────────────
function ScrollHint({ progress }: { progress: any }) {
  const opacity = useTransform(progress, [0, 0.03], [1, 0]);
  return (
    <motion.div style={{ opacity }} className="flex flex-col items-center gap-1 text-white/70">
      <span className="text-xs tracking-[0.3em] uppercase font-sans">Scroll</span>
      <motion.svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <polyline points="6 9 12 15 18 9" />
      </motion.svg>
    </motion.div>
  );
}

// ─── Notes data ───────────────────────────────────────────────────────────────
const NOTES: { start: number; end: number; text: string; position: string; rotate: number; tape: "left" | "right" }[] = [
  { start: 0.06, end: 0.11, text: "You always listen to me, even when I barely make sense.", position: "bottom-16 left-6 md:bottom-20 md:left-20", rotate: -4, tape: "left" },
  { start: 0.13, end: 0.18, text: "You understand me in a way most people never even try to.", position: "top-24 right-6 md:top-28 md:right-20", rotate: 3, tape: "right" },
  { start: 0.2, end: 0.25, text: "Thank you. For every single time you showed up for me, no questions asked.", position: "bottom-24 left-6 md:bottom-28 md:left-16", rotate: 2, tape: "left" },
  { start: 0.28, end: 0.33, text: "Don't you ever think you're 'less'. You're the most 'more' person I know.", position: "top-28 right-6 md:top-32 md:right-16", rotate: -3, tape: "right" },
  { start: 0.41, end: 0.46, text: "Every conversation with you feels like coming home.", position: "bottom-20 left-6 md:bottom-24 md:left-24", rotate: 4, tape: "left" },
  { start: 0.48, end: 0.53, text: "You make ordinary days feel like something worth remembering.", position: "top-24 right-6 md:top-28 md:right-24", rotate: -2, tape: "right" },
  { start: 0.55, end: 0.6, text: "Even on the days you feel invisible, I still see you. All of you.", position: "bottom-16 left-6 md:bottom-20 md:left-16", rotate: 3, tape: "left" },
  { start: 0.62, end: 0.67, text: "Your kindness isn't small. It's the loudest thing about you.", position: "top-28 right-6 md:top-32 md:right-16", rotate: -3, tape: "right" },
  { start: 0.75, end: 0.8, text: "I don't say this enough, but you are perfect exactly as you are.", position: "bottom-24 left-6 md:bottom-28 md:left-20", rotate: 3, tape: "left" },
  { start: 0.82, end: 0.87, text: "You're the best thing that ever walked into my life. I mean that.", position: "top-28 right-6 md:top-32 md:right-20", rotate: -4, tape: "right" },
];

const CHAPTERS: { at: number; roman: string; title: string }[] = [
  { at: 0.035, roman: "I", title: "Where It All Began" },
  { at: 0.365, roman: "II", title: "Little Moments" },
  { at: 0.7, roman: "III", title: "Through It All" },
  { at: 0.895, roman: "IV", title: "Just You" },
];

// ─── Messages overlay ─────────────────────────────────────────────────────────
function Messages({ progress }: { progress: any }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
      <Message progress={progress} start={0} end={0.04} className="text-center">
        <h1 className="text-4xl md:text-6xl font-serif text-white/90 drop-shadow-lg mb-4">For Gala,</h1>
        <p className="text-xl md:text-2xl font-serif italic text-white/80 drop-shadow-md">no reason needed. just you.</p>
      </Message>

      {NOTES.map((note, i) => (
        <StickyNote key={i} progress={progress} start={note.start} end={note.end} position={note.position} rotate={note.rotate} tape={note.tape}>
          {note.text}
        </StickyNote>
      ))}

      {CHAPTERS.map((chapter, i) => (
        <ChapterTitle key={i} progress={progress} start={chapter.at} end={chapter.at + 0.03} roman={chapter.roman} title={chapter.title} />
      ))}

      <Message progress={progress} start={0.9} end={1.0} className="absolute inset-0 flex items-center justify-center px-6">
        <div className="doodle-letter-card text-center max-w-xl">
          <svg className="absolute -top-5 -left-5 opacity-70" width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="4" fill="#d28a95" opacity="0.7"/>
            {[0,60,120,180,240,300].map((deg,i)=>(<ellipse key={i} cx="18" cy="10" rx="3.5" ry="5.5" fill="#f2b8c0" opacity="0.65" transform={`rotate(${deg} 18 18)`}/>))}
          </svg>
          <svg className="absolute -top-4 -right-4 opacity-60" width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path d="M6 24 Q18 6 24 6 M18 4 L24 6 L22 12" stroke="#c97b8c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg className="absolute -bottom-4 -left-4 opacity-65" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 3 L15.5 11 L23 8 L17 14 L23 20 L15.5 17 L14 25 L12.5 17 L5 20 L11 14 L5 8 L12.5 11 Z" stroke="#d28a95" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          <svg className="absolute -bottom-3 -right-3 opacity-70" width="26" height="24" viewBox="0 0 26 24" fill="none">
            <path d="M13 21C13 21 2 14 2 7C2 3.7 4.7 2 7.5 2C9.6 2 11.5 3.2 13 5.4C14.5 3.2 16.4 2 18.5 2C21.3 2 24 3.7 24 7C24 14 13 21 13 21Z" stroke="#c97b8c" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
          <svg className="absolute top-1/2 -right-6 -translate-y-1/2 opacity-50" width="14" height="50" viewBox="0 0 14 50" fill="none">
            {[6,18,30,42].map((cy,i)=>(<circle key={i} cx="7" cy={cy} r="2.5" fill="#d28a95" opacity="0.7"/>))}
          </svg>
          <p className="font-['Kalam'] text-2xl md:text-3xl text-[#3d3630] mb-3 leading-snug">Gala,</p>
          <p className="font-['Kalam'] text-lg md:text-xl text-[#3d3630] leading-relaxed mb-3">
            Thank you — for always showing up. For being someone I can just <em>be</em> around, no effort needed.
          </p>
          <p className="font-['Kalam'] text-lg md:text-xl text-[#3d3630] leading-relaxed mb-3">
            You're not just my best friend — you're my twin in the ways that actually count. We just <em>get it</em>, always, without needing the whole explanation.
          </p>
          <p className="font-['Kalam'] text-lg md:text-xl text-[#3d3630] leading-relaxed mb-6">
            So this is me saying it out loud: I'm endlessly lucky to know you. ♡
          </p>
          <p className="font-['Kalam'] italic text-xl text-[#8c7b74]">— Shourya</p>
          <svg className="doodle-corner-star" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
            <path d="M20 4 L22 17 L35 12 L24 21 L35 28 L22 23 L20 36 L18 23 L5 28 L16 21 L5 12 L18 17 Z" stroke="#d28a95" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
      </Message>
    </div>
  );
}

// ─── Chapter Title ────────────────────────────────────────────────────────────
function ChapterTitle({ progress, start, end, roman, title }: { progress: any; start: number; end: number; roman: string; title: string }) {
  const range = end - start;
  const fadePoint = range * 0.3;
  const opacity = useTransform(progress, [start, start + fadePoint, end - fadePoint, end], [0, 1, 1, 0]);
  const scale = useTransform(progress, [start, start + fadePoint, end - fadePoint, end], [1.08, 1, 1, 0.96]);
  return (
    <motion.div style={{ opacity, scale }} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
      <span className="font-serif text-sm md:text-base tracking-[0.5em] uppercase text-[#f2c9d1]/80 mb-3">Chapter {roman}</span>
      <span className="w-16 h-px bg-white/30 mb-4" />
      <h2 className="font-['Caveat'] text-5xl md:text-7xl text-white drop-shadow-lg">{title}</h2>
    </motion.div>
  );
}

// ─── Kid 67 Section ───────────────────────────────────────────────────────────
function Kid67Section() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 0.8", "start 0.1"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 20, mass: 0.5 });
  const figureOpacity = useTransform(smooth, [0, 0.3], [0, 1]);
  const figureScale = useTransform(smooth, [0, 0.3], [0.6, 1]);
  return (
    <div ref={sectionRef} className="relative bg-black flex items-center justify-center overflow-hidden" style={{ height: "100vh" }}>
      <motion.div style={{ opacity: figureOpacity, scale: figureScale }} className="relative flex flex-col items-center justify-center">
        <motion.img
          src={`${BASE_URL}/67-kid.png`} alt="67" className="w-64 md:w-80 select-none"
          style={{ filter: "drop-shadow(0 0 40px rgba(255,0,0,0.25))" }}
          animate={{ rotate: [-2, -12, 12, 0, -2], y: [0, -18, -18, 8, 0] }}
          transition={{ duration: 2.4, times: [0, 0.28, 0.56, 0.8, 1], repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
        />
        <motion.p
          className="mt-4 font-['Caveat'] text-5xl md:text-6xl text-white tracking-widest drop-shadow-lg"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          6 7
        </motion.p>
      </motion.div>
    </div>
  );
}

// ─── Envelope Section ─────────────────────────────────────────────────────────
function EnvelopeSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const heartContainerRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [letterVisible, setLetterVisible] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 0.9", "start 0.2"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  const sectionOpacity = useTransform(smooth, [0, 0.3], [0, 1]);
  const sectionY = useTransform(smooth, [0, 0.3], [60, 0]);

  const handleOpen = () => {
    if (opened) return;
    setOpened(true);

    // Multi-wave heart burst from envelope center
    const container = heartContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      for (let wave = 0; wave < 3; wave++) {
        setTimeout(() => {
          spawnBurst(document.body, cx, cy, true);
          // Also release ambient floating hearts
          const petalContainer = document.getElementById("petal-container");
          if (petalContainer) {
            for (let h = 0; h < 6; h++) {
              setTimeout(() => spawnFloatingHeart(petalContainer), h * 150);
            }
          }
        }, wave * 350);
      }
    }

    setTimeout(() => setLetterVisible(true), 700);

    setSparkles(Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 300 - 150,
      y: Math.random() * 300 - 150,
    })));
  };

  return (
    <motion.div
      ref={sectionRef}
      style={{ opacity: sectionOpacity, y: sectionY }}
      className="relative bg-gradient-to-b from-black via-[#100810] to-[#120d14] flex flex-col items-center justify-center overflow-hidden px-6 py-24"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(210,120,155,0.12) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="text-xs tracking-[0.4em] uppercase text-white/40 font-sans mb-12"
      >
        a letter for you
      </motion.p>

      {/* Envelope + letter */}
      <div ref={heartContainerRef} className="relative flex flex-col items-center">
        {/* Envelope shell */}
        <motion.div
          className="relative cursor-pointer select-none"
          style={{ width: 280, height: 200, perspective: "1200px" }}
          whileHover={!opened ? { scale: 1.04, filter: "drop-shadow(0 0 30px rgba(210,138,149,0.5))" } : {}}
          onClick={handleOpen}
        >
          {/* Body */}
          <div
            className="absolute inset-0 rounded-sm overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #f5e8ea 0%, #eedee0 50%, #e8d0d3 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,140,150,0.3)",
            }}
          >
            {/* Bottom fold triangles */}
            <div className="absolute bottom-0 left-0" style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "100px 0 0 140px", borderColor: "transparent transparent transparent #dcc4c8" }} />
            <div className="absolute bottom-0 right-0" style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "100px 140px 0 0", borderColor: "transparent #dcc4c8 transparent transparent" }} />
            <div className="absolute bottom-0 left-0 right-0" style={{ height: "50%", background: "linear-gradient(to bottom, #e0c8cb, #d4b8bc)" }} />

            {/* Wax seal */}
            {!opened && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10">
                <motion.div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ background: "radial-gradient(circle, #c04060 0%, #8b1a2e 100%)", boxShadow: "0 4px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)" }}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ♡
                </motion.div>
              </div>
            )}
          </div>

          {/* Animated top flap */}
          <motion.div
            className="absolute top-0 left-0 right-0 z-20"
            animate={opened ? { rotateX: -175 } : { rotateX: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
            style={{
              height: "50%",
              background: "linear-gradient(to bottom, #f0dde0, #e8d0d3)",
              clipPath: "polygon(0 0, 50% 85%, 100% 0)",
              boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
              transformOrigin: "top center",
              transformStyle: "preserve-3d",
            }}
          />
        </motion.div>

        {/* Sparkle burst */}
        <AnimatePresence>
          {opened && sparkles.map((s) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
              animate={{ opacity: 0, x: s.x, y: s.y, scale: 1.5 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute top-1/2 left-1/2 pointer-events-none text-lg"
              style={{ color: `hsl(${330 + (s.id * 13) % 40}, 80%, 70%)` }}
            >
              {["✦", "✧", "⋆", "★", "✩", "·"][s.id % 6]}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Click hint */}
        {!opened && (
          <motion.p
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="mt-6 text-sm text-[#d28a95] font-['Kalam'] tracking-wide"
          >
            tap to open ♡
          </motion.p>
        )}

        {/* Letter slides out */}
        <AnimatePresence>
          {letterVisible && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
              className="mt-8 max-w-sm w-full"
            >
              <div
                className="relative p-8 rounded-sm"
                style={{
                  background: "repeating-linear-gradient(rgba(0,0,0,0) 0px, rgba(0,0,0,0) 27px, rgba(60,45,35,0.06) 28px), linear-gradient(150deg, #fffef9 0%, #fdf8ee 100%)",
                  boxShadow: "0 24px 60px -12px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(180,150,100,0.18)",
                }}
              >
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }}>
                  <p className="font-['Great_Vibes'] text-3xl text-[#c97b8c] mb-4">Gala,</p>
                  <p className="font-['Kalam'] text-base text-[#3d3630] leading-relaxed mb-3">
                    You are one of the rarest people I've ever met. The kind who makes you feel seen without even trying.
                  </p>
                  <p className="font-['Kalam'] text-base text-[#3d3630] leading-relaxed mb-3">
                    Every day is a little brighter because you're in it. Every memory is a little warmer. Every laugh is a little louder.
                  </p>
                  <p className="font-['Kalam'] text-base text-[#3d3630] leading-relaxed mb-5">
                    This whole thing — every petal, every frame, every word — is just me trying to say what I forget to say out loud:{" "}
                    <strong>you matter, endlessly.</strong>
                  </p>
                  <p className="font-['Great_Vibes'] text-2xl text-[#c97b8c]">— always, Shourya ♡</p>
                </motion.div>
                {/* Corner doodles */}
                <svg className="absolute top-2 right-3 opacity-50" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2 L11 8 L17 6 L12 10 L17 14 L11 12 L10 18 L9 12 L3 14 L8 10 L3 6 L9 8 Z" stroke="#d28a95" strokeWidth="1" strokeLinejoin="round"/>
                </svg>
                <svg className="absolute bottom-2 left-3 opacity-50" width="18" height="16" viewBox="0 0 18 16" fill="none">
                  <path d="M9 14C9 14 1 9 1 4.5C1 2.4 2.9 1 5 1C6.8 1 8.1 2 9 3.5C9.9 2 11.2 1 13 1C15.1 1 17 2.4 17 4.5C17 9 9 14 9 14Z" stroke="#c97b8c" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Music Section ─────────────────────────────────────────────────────────────
const SONG_TITLE = "Six Seven Dance";
const SONG_ARTIST = "67";

const LYRICS: { t: number; text: string }[] = [
  { t: 0.04, text: "Still pulling up on them man" },
  { t: 0.18, text: "Still skengdo, still lurking" },
  { t: 0.30, text: "Man just do it and done it" },
  { t: 0.42, text: "We don't do all that talking" },
  { t: 0.55, text: "Anytime that they pop up" },
  { t: 0.67, text: "We ain't stopping, we're working" },
  { t: 0.78, text: "I don't care about nothing" },
  { t: 0.90, text: "67 still lurking" },
];

function MusicSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 100, damping: 30, mass: 0.4 });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    return smooth.on("change", (v) => {
      let idx = 0;
      for (let i = 0; i < LYRICS.length; i++) { if (v >= LYRICS[i].t) idx = i; }
      setActiveIndex(idx);
    });
  }, [smooth]);

  const discRotate = useTransform(smooth, [0, 1], [0, 900]);
  const discOpacity = useTransform(smooth, [0, 0.05], [0, 1]);
  const discScale = useTransform(smooth, [0, 0.05], [0.7, 1]);
  const introOpacity = useTransform(smooth, [0, 0.04], [0, 1]);
  const glowOpacity = useTransform(smooth, [0, 0.3, 0.7, 1], [0, 0.5, 0.5, 0]);

  return (
    <div ref={sectionRef} className="relative bg-black" style={{ height: "420vh" }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black">
        {/* Ambient glow under disc */}
        <motion.div
          style={{ opacity: glowOpacity, background: "radial-gradient(circle, rgba(210,138,149,0.35) 0%, transparent 70%)" }}
          className="absolute w-80 h-80 rounded-full pointer-events-none"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.p style={{ opacity: introOpacity }} className="absolute top-16 text-xs md:text-sm tracking-[0.35em] uppercase text-white/40 font-sans">
          for you, always
        </motion.p>

        <motion.div
          style={{ opacity: discOpacity, scale: discScale, rotate: discRotate }}
          className="relative w-56 h-56 md:w-72 md:h-72 rounded-full mb-14 shrink-0"
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#1c1c1c_0%,#0a0a0a_60%,#000_100%)] shadow-[0_0_70px_rgba(255,255,255,0.08)]" />
          {[0,1,2,3,4,5].map((i) => (
            <div key={i} className="absolute rounded-full border border-white/5" style={{ inset: `${8 + i * 7}%` }} />
          ))}
          {/* Vinyl shimmer */}
          <div className="absolute inset-0 rounded-full opacity-20" style={{ background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.15) 10%, transparent 20%)" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#d28a95] to-[#8c5560] flex items-center justify-center shadow-inner">
              <span className="font-['Caveat'] text-white text-sm md:text-base">For Gala</span>
            </div>
          </div>
        </motion.div>

        <div className="relative text-center px-6 max-w-xl h-28 flex items-center justify-center">
          {LYRICS.map((line, i) => (
            <motion.p
              key={i}
              className="absolute font-serif font-bold text-xl md:text-3xl text-white/90"
              animate={{ opacity: i === activeIndex ? 1 : 0, y: i === activeIndex ? 0 : 14 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {line.text}
            </motion.p>
          ))}
        </div>

        <motion.p style={{ opacity: discOpacity }} className="absolute bottom-10 text-xs tracking-[0.3em] uppercase text-white/40 font-sans">
          "{SONG_TITLE}" — {SONG_ARTIST}
        </motion.p>
      </div>
    </div>
  );
}

// ─── Message ──────────────────────────────────────────────────────────────────
function Message({ children, progress, start, end, className }: { children: React.ReactNode; progress: any; start: number; end: number; className?: string }) {
  const range = end - start;
  const fadePoint = range * 0.2;
  const opacity = useTransform(progress, [start, start + fadePoint, end - fadePoint, end], [0, 1, 1, 0]);
  const y = useTransform(progress, [start, start + fadePoint, end - fadePoint, end], [20, 0, 0, -20]);
  return <motion.div style={{ opacity, y }} className={className}>{children}</motion.div>;
}

// ─── StickyNote ───────────────────────────────────────────────────────────────
function StickyNote({ children, progress, start, end, position, rotate, tape }: { children: React.ReactNode; progress: any; start: number; end: number; position: string; rotate: number; tape: "left" | "right" }) {
  const range = end - start;
  const fadePoint = range * 0.2;
  const opacity = useTransform(progress, [start, start + fadePoint, end - fadePoint, end], [0, 1, 1, 0]);
  const scale = useTransform(progress, [start, start + fadePoint, end - fadePoint, end], [0.85, 1, 1, 0.9]);
  const y = useTransform(progress, [start, start + fadePoint, end - fadePoint, end], [30, 0, 0, -20]);
  return (
    <motion.div style={{ opacity, scale, y, rotate: `${rotate}deg` }} className={`absolute ${position} max-w-[260px] md:max-w-xs`}>
      <div className="sticky-note">
        <span className={`washi-tape washi-tape-${tape}`} />
        <p className="font-['Kalam'] text-xl md:text-2xl leading-snug text-[#3d3630]">{children}</p>
        <svg className="doodle-heart" width="22" height="20" viewBox="0 0 22 20" fill="none">
          <path d="M11 18C11 18 1 12 1 5.8C1 2.6 3.4 1 5.8 1C7.8 1 9.6 2.2 11 4.4C12.4 2.2 14.2 1 16.2 1C18.6 1 21 2.6 21 5.8C21 12 11 18 11 18Z" stroke="#c97b8c" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      </div>
    </motion.div>
  );
}
