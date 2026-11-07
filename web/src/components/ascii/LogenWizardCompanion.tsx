"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Compass,
  Crosshair,
  MessageSquare,
  Moon,
  Send,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { castAsciiSpell } from "./AsciiSpellEngine";

type RobotMood =
  | "calm"
  | "happy"
  | "talking"
  | "scanning"
  | "lifted"
  | "flying"
  | "zapping"
  | "sleeping";

interface KnowledgeEntry {
  keywords: string[];
  title: string;
  answer: string;
  actionLabel?: string;
  actionRoute?: string;
}

/**
 * Comprehensive bilingual knowledge base so the robot pet can explain
 * every concept, contract mechanism, page, and attack vector in Logen.
 */
const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    keywords: ["logen", "apa itu", "what is", "tentang", "proyek", "project", "club", "klub"],
    title: "Apa itu Logen?",
    answer:
      "Logen adalah klub keanggotaan di NEAR di mana setiap kursi (Seat) adalah NFT NEP-171 sekaligus dompet sub-akun NEAR tanpa kunci (0 access keys). Saat kursi dijual, kepemilikan NFT, saldo NEAR di dalamnya, riwayat, dan akses Lounge berpindah bersamaan dalam 1 transaksi atomik!",
    actionLabel: "Lihat Seat Roll",
    actionRoute: "/seats",
  },
  {
    keywords: ["keyless", "0 key", "zero key", "kunci", "access key", "kenapa aman", "plant key", "seed phrase"],
    title: "Kenapa Tanpa Kunci (0 Access Keys)?",
    answer:
      "Pada dompet NFT biasa yang menukar access key, penjual nakal bisa menyimpan kunci cadangan (backdoor) karena smart contract NEAR tidak bisa mengecek daftar access key miliknya sendiri. Logen membuat sub-akun kursi tanpa AddKey sama sekali (keys = []) dan menyegel akun induknya (DeleteKey). Jadi mustahil ada kunci rahasia!",
    actionLabel: "Cek 5 Bukti On-Chain",
    actionRoute: "/verify",
  },
  {
    keywords: ["market", "jual", "beli", "buy", "sell", "escrow", "freeze", "frozen", "nonce", "pasar"],
    title: "Cara Kerja Safe Secondary Market",
    answer:
      "Saat kursi dijual (list_seat), brankas kursi otomatis dibekukan (Frozen) dan mendapat nomor urut listing_nonce. Penjual tidak bisa menarik saldo saat sedang dijual. Saat pembeli membeli (buy_seat), kontrak mengecek nonce dan saldo minimum (min_balance) di dalam 1 receipt atomik (v_settle_sale). Jika saldo kurang 1 yoctoNEAR saja, transaksi batal & uang pembeli kembali 100%!",
    actionLabel: "Buka Market",
    actionRoute: "/market",
  },
  {
    keywords: ["attack", "serangan", "lab", "villain", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11", "a12", "race", "interleaving"],
    title: "12 Skenario Serangan & 80.418 Interleavings",
    answer:
      "Di Attack Lab (/lab), Anda berperan sebagai penjahat yang mencoba mencuri dana dari pembeli (mulai dari menguras brankas saat transaksi berjalan, bait-and-switch relist, hingga memalsukan sesi lounge). Semua 12 serangan (A1–A12) gagal secara deterministik berkat Frozen state, listing_nonce, dan monotonic rotation_seq!",
    actionLabel: "Coba Attack Lab",
    actionRoute: "/lab",
  },
  {
    keywords: ["revenue", "bagi hasil", "pool", "earns", "tiket", "ticket", "event", "acara", "o(1)", "kas klub", "treasury", "royalti"],
    title: "Bagi Hasil Tiket O(1) & Kas Klub",
    answer:
      "Setiap tiket acara yang terjual dibagi otomatis: 40% ke Pool Anggota (dibagi rata ke semua kursi lewat akumulator O(1) tanpa loop), 50% ke Kas Klub, dan 10% ke Organizer. Saat diklaim, pendapatan selalu masuk langsung ke dalam brankas kursi—bukan ke dompet pribadi—sehingga ikut berpindah jika kursi dijual!",
    actionLabel: "Lihat Events & Pool",
    actionRoute: "/events",
  },
  {
    keywords: ["lounge", "pintu", "door", "gate", "nep-413", "cookie", "session", "masuk"],
    title: "Cara Kerja Pintu Holder Lounge (/lounge)",
    answer:
      "Pintu Lounge menggunakan tantangan tanda tangan NEP-413 bebas biaya gas dan melakukan Pair-Check (membaca Registry & Vault pada blok final yang sama) setiap 5 detik. Begitu kursi dijual ke orang lain, rotation_seq bertambah dan sesi pemilik lama otomatis terkunci saat itu juga!",
    actionLabel: "Buka Lounge",
    actionRoute: "/lounge",
  },
  {
    keywords: ["mint", "buat kursi", "upload", "portrait", "gambar", "handle", "nama"],
    title: "Cara Mint Kursi Baru (/mint)",
    answer:
      "Di Mint Studio (/mint), Anda bisa mengunggah gambar potret, memilih nama dan custom handle (mis. garuda.logen.testnet). Kontrak membuat sub-akun tanpa kunci, memasang kode WASM brankas yang telah di-pin, dan mencetak NFT kursi Anda dalam satu langkah!",
    actionLabel: "Ke Mint Studio",
    actionRoute: "/mint",
  },
  {
    keywords: ["delegate", "delegasi", "batas", "allowance", "bot", "agen"],
    title: "Epoch-Bound Spending Delegate",
    answer:
      "Pemilik kursi bisa menunjuk akun delegasi dengan batas pengeluaran NEAR tertentu. Uniknya, delegasi ini terikat pada rotation_seq saat ini—begitu kursi ditransfer atau dijual ke orang baru, delegasi lama otomatis hangus seketika!",
  },
  {
    keywords: ["kamu siapa", "who are you", "robot", "pet", "maskot", "mascot", "bisa apa"],
    title: "Aku Bit-07, Robot Familiar Logen!",
    answer:
      "Aku adalah robot kubus bersayap pendamping penyihir Logen! Kamu bisa mengangkatku (drag), menjatuhkanku di atas kartu/tombol mana saja untuk ku-scan dan kujelaskan, mengaktifkan mode Inspeksi Elemen, atau bertanya apa saja tentang proyek ini!",
  },
];

const QUICK_TOPICS = [
  { label: "Apa itu Logen?", query: "apa itu logen" },
  { label: "Kenapa 0 Keys?", query: "kenapa 0 key" },
  { label: "Cara Kerja Market", query: "cara kerja market" },
  { label: "12 Serangan Lab", query: "12 serangan lab" },
  { label: "Bagi Hasil O(1)", query: "bagi hasil tiket" },
  { label: "Pintu Lounge", query: "cara kerja lounge" },
];

const PAGE_BRAIN: Record<
  string,
  {
    greeting: string;
    detail: string;
    actionLabel: string;
  }
> = {
  "/": {
    greeting:
      "Halo! Aku Bit-07, robot pendamping Logen. Angkat dan jatuhkan aku di atas elemen mana saja untuk kujelaskan!",
    detail:
      "Di halaman utama ini, kamu bisa melihat kartu 3D Seat Pass (klik 'Inside vault' untuk melihat brankas tanpa kuncinya) serta memutar proyeksi 3D ASCII Vault di bawah.",
    actionLabel: "Cek 5 Bukti Vault",
  },
  "/lounge": {
    greeting:
      "Kita berada di Holder Lounge! Pintu ini mengecek kepemilikan kursi di blockchain setiap 5 detik.",
    detail:
      "Jika pemilik kursi menjual kursinya di Market, nomor urut rotasi (rotation_seq) naik dan sesi pemilik lama langsung terkunci otomatis!",
    actionLabel: "Masuk / Tes Pintu",
  },
  "/market": {
    greeting:
      "Ini Safe Secondary Market! Setiap kursi yang dijual membekukan brankasnya agar penjual tidak bisa menguras NEAR di dalamnya.",
    detail:
      "Jatuhkan aku di atas kartu listing mana saja untuk mengaudit perbandingan harga beli vs saldo NEAR di dalam kursi!",
    actionLabel: "Sorot Kursi Terbaik",
  },
  "/mint": {
    greeting:
      "Selamat datang di Mint Studio! Di sini kamu bisa mencetak kursi NFT baru beserta brankas sub-akun tanpa kunci.",
    detail:
      "Klik tombol aksi cepatku jika ingin aku mengisikan nama kursi penyihir secara otomatis!",
    actionLabel: "Isi Nama Otomatis",
  },
  "/lab": {
    greeting:
      "Kita di Attack Lab (A1–A12)! Angkat dan jatuhkan aku tepat di atas baris serangan mana saja untuk langsung menyambarnya!",
    detail:
      "Semua 12 skenario pencurian gagal karena brankas kursi terkunci saat dijual (E_FROZEN) dan memvalidasi nonce serta rotation_seq.",
    actionLabel: "Sambar Semua 12!",
  },
  "/verify": {
    greeting:
      "Halaman Verify memeriksa 5 bukti kriptografis kursi langsung dari RPC NEAR.",
    detail:
      "5 bukti tersebut: 0 Access Keys di kursi, kode WASM brankas yang ter-pin, Pair-Check blok yang sama, pemilik sah, dan segel akun induk (0 keys).",
    actionLabel: "Re-check Semua 5",
  },
  "/seats": {
    greeting:
      "Ini direktori seluruh kursi klub Logen beserta saldo NEAR yang tersimpan di dalam tiap kursi.",
    detail:
      "Klik salah satu kursi untuk membuka riwayat lengkap pemilik, pendapatan tiket, dan pengeluarannya.",
    actionLabel: "Buat Kursi Baru",
  },
  "/events": {
    greeting:
      "Halaman Events & Pool! Setiap pembelian tiket membagi 40% langsung ke Pool Anggota secara O(1).",
    detail:
      "Pemegang kursi juga otomatis mendapat diskon member saat membeli tiket acara klub.",
    actionLabel: "Lihat Kas Klub",
  },
  "/treasury": {
    greeting:
      "Ini buku besar Kas Klub (Treasury) dan Pull Ledger yang transparan di blockchain.",
    detail:
      "Semua pembagian dana menggunakan pola Pull Ledger agar kegagalan transfer tidak pernah mengunci state kontrak.",
    actionLabel: "Kembali ke Wallet",
  },
};

/**
 * Pixel-accurate SVG sprite of the exact floating winged cube robot from `logen-mascot.png`:
 * - Beveled white/ice-blue cube body with dark pixel outline
 * - Two pointed ears on top with glowing cyan inner cores
 * - Dark navy CRT screen face with dynamic cursor-tracking cyan pixel eyes & expressive mouth
 * - Flapping glowing cyan pixel energy wings on left and right
 * - Two cute dark pixel feet underneath
 * - Glowing cyan orbital energy ring underneath
 */
function LogenRobotSprite({
  mood,
  eyeOffset,
  wingFrame,
  blink,
}: {
  mood: RobotMood;
  eyeOffset: { x: number; y: number };
  wingFrame: number;
  blink: boolean;
}) {
  const ex = Math.max(-2, Math.min(2, eyeOffset.x));
  const ey = Math.max(-1.5, Math.min(1.5, eyeOffset.y));
  const wingUp = wingFrame % 2 === 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* Floating pixel sparkles around the robot (matching logen-mascot.png) */}
      <motion.span
        animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.15, 0.85] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="pointer-events-none absolute -left-2 -top-2 font-mono text-[10px] text-[#4de8ff]"
        aria-hidden="true"
      >
        ✦
      </motion.span>
      <motion.span
        animate={{ opacity: [0.9, 0.3, 0.9], scale: [1.1, 0.8, 1.1] }}
        transition={{ duration: 2.2, repeat: Infinity }}
        className="pointer-events-none absolute -right-2 -top-1 font-mono text-[9px] text-[#6ab7ff]"
        aria-hidden="true"
      >
        +
      </motion.span>

      <svg
        width="84"
        height="74"
        viewBox="0 0 42 37"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ shapeRendering: "crispEdges" }}
        className="drop-shadow-[0_6px_16px_rgba(77,232,255,0.28)]"
        aria-hidden="true"
      >
        {/* === LEFT CYAN PIXEL ENERGY WING === */}
        <g transform={wingUp ? "translate(0, -1)" : "translate(0, 1)"}>
          <rect x="1" y="13" width="3" height="2" fill="#4DE8FF" />
          <rect x="2" y="15" width="4" height="2" fill="#3B9BFF" />
          <rect x="4" y="14" width="4" height="3" fill="#4DE8FF" />
          <rect x="6" y="16" width="3" height="2" fill="#1D6FE8" />
          <rect x="0" y="12" width="2" height="1" fill="#A6F4FF" />
        </g>

        {/* === RIGHT CYAN PIXEL ENERGY WING === */}
        <g transform={wingUp ? "translate(0, -1)" : "translate(0, 1)"}>
          <rect x="38" y="13" width="3" height="2" fill="#4DE8FF" />
          <rect x="36" y="15" width="4" height="2" fill="#3B9BFF" />
          <rect x="34" y="14" width="4" height="3" fill="#4DE8FF" />
          <rect x="33" y="16" width="3" height="2" fill="#1D6FE8" />
          <rect x="40" y="12" width="2" height="1" fill="#A6F4FF" />
        </g>

        {/* === TOP POINTED ROBOT EARS (White/Blue with Glowing Cyan Core) === */}
        {/* Left Ear */}
        <rect x="11" y="3" width="4" height="1" fill="#14192B" />
        <rect x="10" y="4" width="6" height="4" fill="#14192B" />
        <rect x="11" y="4" width="4" height="3" fill="#DCE6F7" />
        <rect x="12" y="5" width="2" height="2" fill="#4DE8FF" />

        {/* Right Ear */}
        <rect x="27" y="3" width="4" height="1" fill="#14192B" />
        <rect x="26" y="4" width="6" height="4" fill="#14192B" />
        <rect x="27" y="4" width="4" height="3" fill="#DCE6F7" />
        <rect x="28" y="5" width="2" height="2" fill="#4DE8FF" />

        {/* === CUBE ROBOT CHASSIS (White/Silver with 3D Right Side Bevel) === */}
        {/* Outer Dark Pixel Border */}
        <rect x="9" y="7" width="24" height="19" fill="#14192B" />
        <rect x="8" y="8" width="26" height="17" fill="#14192B" />

        {/* Main Front White-Silver Faceplate */}
        <rect x="10" y="8" width="19" height="16" fill="#E6EEF9" />
        {/* Top Highlight Bevel */}
        <rect x="10" y="8" width="19" height="2" fill="#FFFFFF" />
        {/* Bottom & Right 3D Shadow Side (matching the 3/4 angle in logen-mascot.png) */}
        <rect x="29" y="8" width="4" height="16" fill="#8FA3C7" />
        <rect x="31" y="9" width="2" height="14" fill="#6378A0" />
        <rect x="10" y="22" width="21" height="2" fill="#9BB0D4" />

        {/* Corner Pixel Rivets */}
        <rect x="11" y="9" width="1" height="1" fill="#8FA3C7" />
        <rect x="27" y="9" width="1" height="1" fill="#6378A0" />

        {/* === DARK CRT SCREEN FACE === */}
        <rect x="12" y="10" width="16" height="11" fill="#0B1020" />
        <rect x="13" y="11" width="14" height="9" fill="#11182D" />

        {/* === EXPRESSIVE CYAN PIXEL EYES & MOUTH (Moves with Cursor!) === */}
        <g transform={`translate(${ex.toFixed(1)}, ${ey.toFixed(1)})`}>
          {mood === "sleeping" ? (
            <>
              <rect x="15" y="15" width="3" height="1" fill="#3B9BFF" />
              <rect x="22" y="15" width="3" height="1" fill="#3B9BFF" />
              <rect x="19" y="17" width="2" height="1" fill="#3B9BFF" />
            </>
          ) : mood === "lifted" ? (
            /* Surprised Wide Eyes + O Mouth when lifted! */
            <>
              <rect x="15" y="13" width="3" height="3" fill="#4DE8FF" />
              <rect x="16" y="14" width="1" height="1" fill="#0B1020" />
              <rect x="22" y="13" width="3" height="3" fill="#4DE8FF" />
              <rect x="23" y="14" width="1" height="1" fill="#0B1020" />
              <rect x="19" y="17" width="2" height="2" fill="#4DE8FF" />
            </>
          ) : mood === "happy" || mood === "zapping" ? (
            /* Happy / Proud ^ ᴗ ^ Eyes */
            <>
              <rect x="15" y="14" width="1" height="1" fill="#4DE8FF" />
              <rect x="16" y="13" width="1" height="1" fill="#A6F4FF" />
              <rect x="17" y="14" width="1" height="1" fill="#4DE8FF" />

              <rect x="22" y="14" width="1" height="1" fill="#4DE8FF" />
              <rect x="23" y="13" width="1" height="1" fill="#A6F4FF" />
              <rect x="24" y="14" width="1" height="1" fill="#4DE8FF" />

              {/* Cute Smile */}
              <rect x="18" y="17" width="1" height="1" fill="#4DE8FF" />
              <rect x="19" y="18" width="2" height="1" fill="#A6F4FF" />
              <rect x="21" y="17" width="1" height="1" fill="#4DE8FF" />
            </>
          ) : mood === "scanning" ? (
            /* Scanning Cyber Visor Mode */
            <>
              <rect x="14" y="14" width="12" height="2" fill="#4DE8FF" />
              <rect x="16" y="14" width="3" height="2" fill="#FFFFFF" />
              <rect x="18" y="18" width="4" height="1" fill="#3B9BFF" />
            </>
          ) : (
            /* Signature Cute Pixel Eyes & Smile from logen-mascot.png */
            <>
              {blink ? (
                <>
                  <rect x="15" y="14" width="2" height="1" fill="#4DE8FF" />
                  <rect x="23" y="14" width="2" height="1" fill="#4DE8FF" />
                </>
              ) : (
                <>
                  <rect x="15" y="13" width="2" height="3" fill="#4DE8FF" />
                  <rect x="15" y="13" width="1" height="1" fill="#FFFFFF" />
                  <rect x="23" y="13" width="2" height="3" fill="#4DE8FF" />
                  <rect x="23" y="13" width="1" height="1" fill="#FFFFFF" />
                </>
              )}
              {/* Blush cheeks */}
              <rect x="14" y="16" width="1" height="1" fill="#1D6FE8" />
              <rect x="25" y="16" width="1" height="1" fill="#1D6FE8" />
              {/* Talking or smiling mouth */}
              {mood === "talking" && wingFrame % 2 === 0 ? (
                <rect x="18" y="16" width="4" height="2" fill="#4DE8FF" />
              ) : (
                <>
                  <rect x="18" y="16" width="1" height="1" fill="#4DE8FF" />
                  <rect x="19" y="17" width="2" height="1" fill="#4DE8FF" />
                  <rect x="21" y="16" width="1" height="1" fill="#4DE8FF" />
                </>
              )}
            </>
          )}
        </g>

        {/* === CUTE PIXEL FEET (Kick when lifted!) === */}
        <g
          transform={
            mood === "lifted"
              ? wingUp
                ? "translate(-1, 1)"
                : "translate(1, -1)"
              : "translate(0, 0)"
          }
        >
          <rect x="13" y="25" width="4" height="3" fill="#14192B" />
          <rect x="14" y="25" width="2" height="2" fill="#6378A0" />
          <rect x="23" y="25" width="4" height="3" fill="#14192B" />
          <rect x="24" y="25" width="2" height="2" fill="#6378A0" />
        </g>

        {/* === GLOWING CYAN ORBITAL SWIRL UNDERNEATH (Exact match to logen-mascot.png) === */}
        <g transform={wingUp ? "translate(0, 0)" : "translate(0, 1)"}>
          <rect x="10" y="31" width="4" height="1" fill="#1D6FE8" />
          <rect x="8" y="32" width="5" height="2" fill="#4DE8FF" />
          <rect x="13" y="33" width="14" height="2" fill="#4DE8FF" />
          <rect x="15" y="34" width="10" height="1" fill="#FFFFFF" />
          <rect x="27" y="32" width="6" height="2" fill="#3B9BFF" />
          <rect x="31" y="30" width="3" height="2" fill="#4DE8FF" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Extracts a smart, human-friendly explanation for any DOM element
 * the user inspects or drops the robot pet onto.
 */
function explainElement(el: HTMLElement, pathname: string): string {
  const text = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  if (lower.includes("inside vault") || lower.includes("portrait") || lower.includes("locked inside")) {
    return "Kartu Seat Pass ini menampilkan brankas sub-akun kursi. Di dalamnya tersimpan saldo NEAR asli dengan 0 access keys—hanya pemilik NFT saat ini yang bisa menggerakkannya!";
  }
  if (lower.includes("ascii vault") || el.tagName === "CANVAS") {
    return "Ini adalah proyeksi 3D ASCII Vault! Terdiri dari 3 wujud: Seat (kursi NFT), Vault (kubus brankas tanpa kunci), dan Handoff (prisma perpindahan kepemilikan atomik).";
  }
  if (lower.includes("buy this seat") || lower.includes("asking")) {
    return "Kartu listing di Safe Market! Saat kamu membeli kursi ini, kontrak memverifikasi bahwa saldo NEAR di dalam kursi tidak berkurang sepeser pun sebelum uangmu dibayarkan ke penjual.";
  }
  if (lower.includes("try it") || lower.includes("blocked") || /^a\d+/i.test(lower)) {
    return `Skenario serangan di Attack Lab! Setiap percobaan pencurian oleh penjual atau pihak luar langsung ditolak oleh smart contract brankas dengan kode error deterministik.`;
  }
  if (lower.includes("simulate race") || lower.includes("payout mid-sale") || lower.includes("bait & switch")) {
    return "Simulator Receipt Interleaving! Menampilkan bagaimana transaksi lintas-kontrak (cross-contract receipts) di NEAR tetap aman meskipun datang bersamaan di tengah penjualan kursi.";
  }
  if (lower.includes("re-check") || lower.includes("access keys") || lower.includes("code hash")) {
    return "Baris verifikasi on-chain! Mengecek langsung ke RPC NEAR bahwa akun kursi memiliki 0 access keys dan menjalankan kode WASM brankas yang sudah dikunci (pinned).";
  }
  if (lower.includes("connect wallet")) {
    return "Tombol untuk menghubungkan dompet NEAR Testnet. Jika belum punya dompet, aktifkan saja saklar 'Demo' di atas atau klik 'Summon Demo' di menuku!";
  }
  if (lower.includes("demo")) {
    return "Saklar Mode Demo! Mengaktifkan simulasi penuh di dalam browser sehingga kamu bisa mencoba Mint, Market, Lounge, dan klaim pendapatan tanpa perlu saldo Testnet.";
  }
  if (lower.includes("mint")) {
    return "Fitur Mint Seat! Mencetak NFT kursi NEP-171 sekaligus men-deploy sub-akun brankas tanpa kunci dalam 1 transaksi batch atomik.";
  }
  if (lower.includes("door") || lower.includes("lounge")) {
    return "Gerbang Holder Lounge! Mengecek kepemilikan kursi lewat tanda tangan NEP-413 dan memverifikasi ulang pasangan Registry + Vault setiap 5 detik.";
  }
  if (text.length > 0) {
    const short = text.slice(0, 68);
    return `Hasil scan elemen "${short}${text.length > 68 ? "…" : ""}": Terhubung ke protokol kursi tanpa kunci Logen di halaman ${pathname}.`;
  }
  return PAGE_BRAIN[pathname]?.detail ?? PAGE_BRAIN["/"].detail;
}

export function LogenWizardCompanion() {
  const pathname = usePathname();
  const router = useRouter();
  const { accountId } = useNear();
  const { demo, setDemo } = useDemo();

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mood, setMood] = useState<RobotMood>("calm");
  const [panelOpen, setPanelOpen] = useState(true);
  const [inspectMode, setInspectMode] = useState(false);
  const [autoRoam, setAutoRoam] = useState(true);
  const [title, setTitle] = useState("Bit-07 · Robot Familiar Logen");
  const [fullSpeech, setFullSpeech] = useState(PAGE_BRAIN["/"].greeting);
  const [typedSpeech, setTypedSpeech] = useState(PAGE_BRAIN["/"].greeting);
  const [suggestedRoute, setSuggestedRoute] = useState<{
    label: string;
    route: string;
  } | null>(null);
  const [question, setQuestion] = useState("");
  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tiltAngle, setTiltAngle] = useState(0);
  const [wingFrame, setWingFrame] = useState(0);
  const [blink, setBlink] = useState(false);

  const robotRef = useRef<HTMLDivElement | null>(null);
  const pokeCountRef = useRef(0);
  const dragRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
  }>({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
  });

  const pageInfo =
    PAGE_BRAIN[pathname] ??
    (pathname.startsWith("/seat/")
      ? {
          greeting:
            "Aku sedang memindai riwayat lengkap kursi ini: mulai dari pemilik, pendapatan pool, hingga pengeluaran brankas!",
          detail:
            "Semua riwayat disimpan langsung di state kontrak dan event NEP-297.",
          actionLabel: "Verifikasi 5 Bukti",
        }
      : PAGE_BRAIN["/"]);

  const speak = useCallback(
    (
      newText: string,
      newTitle = "Bit-07 · Robot Familiar Logen",
      nextMood: RobotMood = "talking",
      routeSuggestion: { label: string; route: string } | null = null
    ) => {
      setTitle(newTitle);
      setFullSpeech(newText);
      setSuggestedRoute(routeSuggestion);
      setPanelOpen(true);
      setMood(nextMood);
    },
    []
  );

  // Typewriter speech animation so the robot feels alive when talking
  useEffect(() => {
    let idx = 0;
    setTypedSpeech("");
    const interval = window.setInterval(() => {
      idx += 3;
      if (idx >= fullSpeech.length) {
        setTypedSpeech(fullSpeech);
        window.clearInterval(interval);
        setMood((m) => (m === "talking" ? "calm" : m));
      } else {
        setTypedSpeech(fullSpeech.slice(0, idx));
      }
    }, 18);
    return () => window.clearInterval(interval);
  }, [fullSpeech]);

  // Wing flap & natural eye blink loop
  useEffect(() => {
    const wingTimer = window.setInterval(
      () => {
        setWingFrame((f) => (f + 1) % 8);
      },
      mood === "lifted" || mood === "flying" ? 95 : 190
    );

    const blinkTimer = window.setInterval(() => {
      if (Math.random() < 0.45) {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
      }
    }, 2600);

    return () => {
      window.clearInterval(wingTimer);
      window.clearInterval(blinkTimer);
    };
  }, [mood]);

  // Autonomous roaming / consciousness loop when idle
  useEffect(() => {
    if (!autoRoam || mood === "sleeping") return;
    const roamInterval = window.setInterval(() => {
      if (dragRef.current.dragging || inspectMode) return;
      // Gently patrol within a calm range near its corner or float up slightly
      const targetX = Math.round((Math.random() - 0.65) * 90);
      const targetY = Math.round(-Math.random() * 65);
      setMood("flying");
      setPos({ x: targetX, y: targetY });
      window.setTimeout(() => {
        setMood((m) => (m === "flying" ? "calm" : m));
      }, 900);
    }, 11000);
    return () => window.clearInterval(roamInterval);
  }, [autoRoam, mood, inspectMode]);

  // Route change awareness
  useEffect(() => {
    if (mood === "sleeping") return;
    const info =
      PAGE_BRAIN[pathname] ??
      (pathname.startsWith("/seat/")
        ? {
            greeting:
              "Aku sedang memindai riwayat lengkap kursi ini: mulai dari pemilik, pendapatan pool, hingga pengeluaran brankas!",
            detail:
              "Semua riwayat disimpan langsung di state kontrak dan event NEP-297.",
            actionLabel: "Verifikasi 5 Bukti",
          }
        : PAGE_BRAIN["/"]);
    speak(info.greeting, `Bit-07 · ${pathname === "/" ? "Home" : pathname}`, "happy", null);
  }, [pathname, speak]);

  // Global Inspect Mode click listener
  useEffect(() => {
    if (!inspectMode) return;
    const onInspectClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-robot-companion]")) return;

      e.preventDefault();
      e.stopPropagation();

      // Fly robot near the clicked element
      const targetX = Math.max(
        -(window.innerWidth - 130),
        Math.min(10, e.clientX - (window.innerWidth - 65))
      );
      const targetY = Math.max(
        -(window.innerHeight - 150),
        Math.min(10, e.clientY - (window.innerHeight - 65))
      );
      setPos({ x: targetX, y: targetY });

      castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 1.05, tone: "positive" });
      const explanation = explainElement(target, pathname);
      speak(explanation, "🔍 Hasil Scan Elemen", "scanning", null);
      setInspectMode(false);
    };

    window.addEventListener("click", onInspectClick, true);
    return () => window.removeEventListener("click", onInspectClick, true);
  }, [inspectMode, pathname, speak]);

  // Pointer tracking for eyes, drag physics, and drop-to-inspect
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const el = robotRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        setEyeOffset({
          x: (dx / dist) * 2.2,
          y: (dy / dist) * 1.6,
        });
      }

      const st = dragRef.current;
      if (!st.dragging) return;

      const dxTotal = e.clientX - st.startX;
      const dyTotal = e.clientY - st.startY;
      if (Math.hypot(dxTotal, dyTotal) > 5) {
        st.moved = true;
      }

      const vx = e.clientX - st.lastX;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      setTiltAngle(Math.max(-24, Math.min(24, vx * 1.4)));

      const maxLeft = -(window.innerWidth - 110);
      const maxTop = -(window.innerHeight - 120);
      setPos({
        x: Math.max(maxLeft, Math.min(20, st.originX + dxTotal)),
        y: Math.max(maxTop, Math.min(20, st.originY + dyTotal)),
      });

      if (Math.random() > 0.58) {
        castAsciiSpell({
          x: e.clientX,
          y: e.clientY + 20,
          intensity: 0.4,
          tone: "signal",
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = dragRef.current;
      if (!st.dragging) return;
      st.dragging = false;
      setTiltAngle(0);

      if (st.moved) {
        castAsciiSpell({
          x: e.clientX,
          y: e.clientY,
          intensity: 1.05,
          tone: "positive",
        });

        const robotEl = robotRef.current;
        if (robotEl) {
          robotEl.style.pointerEvents = "none";
          const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          robotEl.style.pointerEvents = "auto";

          if (under) {
            // If dropped on an Attack Lab row, automatically zap & run that attack!
            const tryBtn = under
              .closest("div")
              ?.querySelector("button[aria-label^='Try attack']") as HTMLButtonElement | null;
            if (tryBtn) {
              tryBtn.click();
              speak(
                "⚡ Bzzzt! Aku langsung menyambar skenario serangan itu dan memverifikasi bahwa brankas kursi memblokirnya!",
                "⚡ Serangan Disambar!",
                "zapping"
              );
              return;
            }
            const explanation = explainElement(under, pathname);
            speak(explanation, "🔍 Scan Lokasi Pendaratan", "happy");
            return;
          }
        }
        speak(
          "Mendarat dengan mulus! Kamu bisa menjatuhkanku di atas tombol atau kartu mana saja untuk ku-scan.",
          "Bit-07 · Mendarat",
          "happy"
        );
      } else {
        setMood("calm");
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [pathname, speak]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-robot-panel]")) return;
    e.stopPropagation();
    const st = dragRef.current;
    st.dragging = true;
    st.moved = false;
    st.startX = e.clientX;
    st.startY = e.clientY;
    st.originX = pos.x;
    st.originY = pos.y;
    st.lastX = e.clientX;
    st.lastY = e.clientY;

    if (mood !== "sleeping") {
      setMood("lifted");
      speak(
        "Waaah—aku diangkat! Jatuhkan aku tepat di atas kartu, tombol, atau baris serangan yang ingin kamu ketahui!",
        "Bit-07 · Melayang!",
        "lifted"
      );
    }
  };

  const handleRobotClick = (e: React.MouseEvent) => {
    if (dragRef.current.moved) return;
    if (mood === "sleeping") {
      castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.9, tone: "signal" });
      speak(
        "Sistem aktif kembali! Mau dijelaskan tentang apa hari ini?",
        "Bit-07 · Online!",
        "happy"
      );
      return;
    }

    pokeCountRef.current += 1;
    castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.75, tone: "signal" });

    if (pokeCountRef.current >= 3) {
      pokeCountRef.current = 0;
      speak(
        "Hehehe geli! Sayap pikselku bergetar kalau diklik terus! Tanyakan apa saja di kolom bawah ya.",
        "Bit-07 · Geli! ^ᴗ^",
        "happy"
      );
      return;
    }

    setPanelOpen((prev) => !prev);
  };

  const answerQuery = (rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return;

    // Match against knowledge base
    for (const entry of KNOWLEDGE_BASE) {
      if (entry.keywords.some((kw) => q.includes(kw))) {
        speak(
          entry.answer,
          `💡 ${entry.title}`,
          "talking",
          entry.actionRoute && entry.actionLabel
            ? { label: entry.actionLabel, route: entry.actionRoute }
            : null
        );
        return;
      }
    }

    // Fallback smart contextual explanation combining current page + core architecture
    speak(
      `Tentang "${rawQuery.trim()}": Di Logen, setiap kursi adalah NFT NEP-171 sekaligus sub-akun brankas NEAR dengan 0 access keys. Saat kursi berpindah tangan, seluruh saldo NEAR, pendapatan tiket (40% Pool Anggota), dan akses Lounge ikut berpindah dalam 1 receipt atomik. ${pageInfo.detail}`,
      `💡 Penjelasan Bit-07`,
      "talking"
    );
  };

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    answerQuery(question);
    setQuestion("");
  };

  const runSmartPageAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 1.2, tone: "positive" });

    if (!demo && !accountId && pathname !== "/lab") {
      setDemo(true);
      speak(
        "✨ Mode Demo berhasil diaktifkan! Kursi #01 dengan saldo 2.46 NEAR di dalamnya sekarang aktif dan siap kamu coba.",
        "⚡ Mode Demo Aktif!",
        "zapping"
      );
      return;
    }

    if (pathname === "/lab") {
      const runAllBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Run all 12")
      );
      runAllBtn?.click();
      speak(
        "⚡ Menyambar ke-12 skenario serangan sekaligus! Lihat semua barisan serangan berubah menjadi BLOCKED.",
        "⚡ 12 Serangan Diblokir!",
        "zapping"
      );
    } else if (pathname === "/verify") {
      const recheckBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Re-check all")
      );
      recheckBtn?.click();
      speak(
        "✦ Memeriksa ulang ke-5 bukti on-chain (0 access keys, WASM hash, pair-check, owner, dan segel induk)!",
        "✦ 5 Bukti Diverifikasi",
        "scanning"
      );
    } else if (pathname === "/mint") {
      const nameInput = document.querySelector("input[type='text']") as HTMLInputElement | null;
      if (nameInput) {
        const names = ["Cyber Archmage", "Keeper 07", "Garuda Prime", "Azure Oracle"];
        const pick = names[Math.floor(Math.random() * names.length)];
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(nameInput, pick);
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        nameInput.focus();
        speak(
          `✦ Aku sudah mengisikan nama "${pick}" di formulir Mint! Sekarang kamu tinggal unggah gambar atau klik Mint.`,
          "✦ Nama Kursi Diisi!",
          "happy"
        );
      }
    } else if (pathname === "/market") {
      const buyBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Buy this seat")
      );
      buyBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      speak(
        "✦ Ini kursi yang sedang dijual di Market! Perhatikan bar hijau yang menunjukkan berapa persen harga beli yang langsung tertutup oleh saldo NEAR di dalam kursi.",
        "✦ Audit Kursi Market",
        "happy"
      );
    } else if (pathname === "/lounge") {
      const enterBtn = Array.from(document.querySelectorAll("button")).find(
        (b) =>
          b.textContent?.includes("Enter with seat") || b.textContent?.includes("Sign to enter")
      );
      if (enterBtn) {
        enterBtn.click();
        speak("✦ Membuka pintu Holder Lounge menggunakan kredensial kursimu!", "✦ Pintu Terbuka!", "happy");
      } else {
        speak("✦ Kamu sudah berada di dalam Lounge! Kode pintumu aktif di kanan atas.", "✦ Di Dalam Lounge", "happy");
      }
    } else {
      router.push("/verify");
      speak("✦ Membawamu ke halaman 5 pemeriksaan bukti on-chain!", "✦ Teleportasi", "flying");
    }
  };

  if (mood === "sleeping") {
    return (
      <div data-robot-companion="true" className="fixed bottom-4 right-4 z-50 select-none">
        <button
          type="button"
          onClick={handleRobotClick}
          className="group flex items-center gap-2 rounded-full border border-[#4de8ff]/40 bg-[#070d19]/95 px-3.5 py-2 font-mono text-[11px] text-[#4de8ff] shadow-[0_0_24px_rgba(77,232,255,0.2)] backdrop-blur-md transition-all hover:border-[#4de8ff] hover:text-paper"
          title="Bangunkan Bit-07 Robot Companion"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-[#4de8ff] animate-pulse" />
          <span>Bit-07 · zZz</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      ref={robotRef}
      data-robot-companion="true"
      animate={{
        x: pos.x,
        y: pos.y,
        rotate: mood === "lifted" ? tiltAngle : mood === "flying" ? -6 : 0,
        scale: mood === "lifted" ? 1.1 : mood === "zapping" ? 1.06 : 1,
      }}
      transition={
        dragRef.current.dragging
          ? { type: "tween", duration: 0.02 }
          : { type: "spring", stiffness: 240, damping: 20 }
      }
      style={{ touchAction: "none" }}
      className="fixed bottom-4 right-4 z-50 select-none"
    >
      {/* Interactive Holo-Comms Brain Panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            data-robot-panel="true"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-[102px] right-0 w-[310px] sm:w-[336px] rounded-lg border border-[#4de8ff]/40 bg-[#080e1a]/95 p-3.5 shadow-[0_14px_44px_rgba(0,0,0,0.65),0_0_28px_rgba(77,232,255,0.14)] backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-[#4de8ff]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4de8ff] animate-pulse" />
                <span className="truncate">{title}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAutoRoam((r) => !r)}
                  title={autoRoam ? "Auto-roam ON (klik untuk diam di tempat)" : "Auto-roam OFF (klik untuk terbang mandiri)"}
                  className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-label transition-colors ${
                    autoRoam
                      ? "bg-[#4de8ff]/15 text-[#4de8ff]"
                      : "bg-surface text-paper-muted hover:text-paper"
                  }`}
                >
                  <Compass className="mr-0.5 inline h-2.5 w-2.5" />
                  {autoRoam ? "Roam" : "Stay"}
                </button>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="rounded p-0.5 text-paper-muted hover:text-paper"
                  aria-label="Minimize robot panel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Speech Output */}
            <div className="mt-2.5 min-h-[54px] text-12 leading-relaxed text-paper">
              {typedSpeech}
              {typedSpeech.length < fullSpeech.length ? (
                <span className="ml-0.5 inline-block h-3 w-1.5 bg-[#4de8ff] animate-pulse" />
              ) : null}
            </div>

            {suggestedRoute ? (
              <button
                type="button"
                onClick={() => router.push(suggestedRoute.route)}
                className="mt-2 inline-flex items-center gap-1.5 rounded border border-[#4de8ff]/40 bg-[#4de8ff]/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-[#4de8ff] transition-colors hover:bg-[#4de8ff]/20"
              >
                <Sparkles className="h-3 w-3" />
                {suggestedRoute.label} →
              </button>
            ) : null}

            {/* Quick Topic Chips ("Dapat menjelaskan semua hal") */}
            <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-2.5">
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  type="button"
                  onClick={() => answerQuery(topic.query)}
                  className="rounded border border-line bg-surface/80 px-2 py-0.5 font-mono text-[9px] text-paper-dim transition-colors hover:border-[#4de8ff]/60 hover:text-[#4de8ff]"
                >
                  {topic.label}
                </button>
              ))}
            </div>

            {/* Ask Anything Input Box */}
            <form onSubmit={handleAskSubmit} className="mt-2.5 flex items-center gap-1.5">
              <div className="relative flex-1">
                <MessageSquare className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-paper-muted" />
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Tanya apa saja ke Bit-07…"
                  aria-label="Ask Bit-07 Robot anything about Logen"
                  className="w-full rounded border border-line bg-ink-deep py-1.5 pl-7 pr-2 font-mono text-[11px] text-paper outline-none transition-colors placeholder:text-paper-muted focus:border-[#4de8ff]"
                />
              </div>
              <button
                type="submit"
                aria-label="Send question"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#4de8ff]/50 bg-[#4de8ff]/15 text-[#4de8ff] transition-colors hover:bg-[#4de8ff]/25"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>

            {/* Bottom Action Bar: Inspect Element, Smart Action, Rest */}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-line pt-2.5 font-mono text-[9px] uppercase tracking-label">
              <button
                type="button"
                onClick={() => {
                  const next = !inspectMode;
                  setInspectMode(next);
                  if (next) {
                    speak(
                      "🎯 Mode Inspeksi Aktif! Klik elemen, kartu, atau tombol mana saja di layar dan aku akan terbang ke sana untuk menjelaskannya!",
                      "🎯 Klik Elemen Mana Saja",
                      "scanning"
                    );
                  }
                }}
                className={`inline-flex items-center justify-center gap-1 rounded border px-2 py-1.5 transition-colors ${
                  inspectMode
                    ? "border-positive bg-positive-soft text-positive"
                    : "border-line bg-ink-deep text-paper-dim hover:border-[#4de8ff] hover:text-paper"
                }`}
              >
                <Crosshair className="h-2.5 w-2.5" />
                {inspectMode ? "Scanning…" : "Scan Elemen"}
              </button>

              <button
                type="button"
                onClick={runSmartPageAction}
                className="inline-flex items-center justify-center gap-1 rounded border border-[#4de8ff]/50 bg-[#4de8ff]/15 px-2 py-1.5 text-[#4de8ff] transition-colors hover:bg-[#4de8ff]/25"
              >
                <Zap className="h-2.5 w-2.5" />
                <span className="truncate">
                  {!demo && !accountId && pathname !== "/lab"
                    ? "Summon Demo"
                    : pageInfo.actionLabel}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInspectMode(false);
                  setPanelOpen(false);
                  setMood("sleeping");
                }}
                className="inline-flex items-center justify-center gap-1 rounded border border-line bg-ink-deep px-2 py-1.5 text-paper-muted transition-colors hover:border-line-strong hover:text-paper"
              >
                <Moon className="h-2.5 w-2.5" />
                Tidur
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable Floating Winged Cube Robot Body (Matching logen-mascot.png) */}
      <motion.div
        onPointerDown={handlePointerDown}
        onClick={handleRobotClick}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        role="button"
        tabIndex={0}
        aria-label="Bit-07 Logen Robot Pet. Drag to pick up and drop on any element to inspect, or click to ask anything."
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setPanelOpen((o) => !o);
          }
        }}
        className={`group relative flex flex-col items-center rounded-2xl p-1.5 transition-transform ${
          mood === "lifted" ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105"
        }`}
      >
        <LogenRobotSprite
          mood={mood}
          eyeOffset={eyeOffset}
          wingFrame={wingFrame}
          blink={blink}
        />

        <span className="mt-0.5 rounded-full border border-[#4de8ff]/35 bg-[#070d19]/90 px-2 py-0.5 font-mono text-[8px] uppercase tracking-label text-[#4de8ff] shadow-sm">
          {inspectMode
            ? "🎯 Klik Elemen"
            : mood === "lifted"
              ? "Jatuhkan untuk Scan"
              : "Bit-07 · Tanya Aku"}
        </span>
      </motion.div>
    </motion.div>
  );
}
