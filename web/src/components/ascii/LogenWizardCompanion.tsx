"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Compass,
  Crosshair,
  Globe,
  MessageSquare,
  Moon,
  Send,
  Sparkles,
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

export type PetLang = "id" | "en" | "ja" | "zh" | "ko" | "es";

const LANG_ORDER: PetLang[] = ["id", "en", "ja", "zh", "ko", "es"];

const LANG_META: Record<
  PetLang,
  {
    code: string;
    name: string;
    placeholder: string;
    scanBtn: string;
    scanningBtn: string;
    sleepBtn: string;
    summonDemo: string;
    askMeBadge: string;
    dropToScanBadge: string;
    clickElementBadge: string;
    liftedSpeech: string;
    liftedTitle: string;
    tickleSpeech: string;
    tickleTitle: string;
    wakeSpeech: string;
    inspectPrompt: string;
    inspectTitle: string;
    landedSpeech: string;
    zappedSpeech: string;
  }
> = {
  id: {
    code: "ID",
    name: "Indonesia",
    placeholder: "Tanya apa saja (ID/EN/JA/ZH/KO/ES)…",
    scanBtn: "Scan Elemen",
    scanningBtn: "Klik Target…",
    sleepBtn: "Tidur",
    summonDemo: "Aktifkan Demo",
    askMeBadge: "Bit-07 · Tanya Aku",
    dropToScanBadge: "Jatuhkan untuk Scan",
    clickElementBadge: "🎯 Klik Elemen",
    liftedSpeech:
      "Waaah—aku diangkat! Jatuhkan aku tepat di atas kartu, tombol, atau baris serangan yang ingin kamu ketahui!",
    liftedTitle: "Bit-07 · Melayang!",
    tickleSpeech:
      "Hehehe geli! Sayap pikselku bergetar kalau diklik terus! Tanyakan apa saja di kolom bawah ya.",
    tickleTitle: "Bit-07 · Geli! ^ᴗ^",
    wakeSpeech: "Sistem aktif kembali! Mau dijelaskan dalam bahasa apa hari ini?",
    inspectPrompt:
      "🎯 Mode Inspeksi Aktif! Klik elemen, kartu, atau tombol mana saja di layar dan aku akan terbang ke sana untuk menjelaskannya!",
    inspectTitle: "🎯 Klik Elemen Mana Saja",
    landedSpeech:
      "Mendarat dengan mulus! Kamu bisa menjatuhkanku di atas tombol atau kartu mana saja untuk ku-scan.",
    zappedSpeech:
      "⚡ Bzzzt! Aku langsung menyambar skenario serangan itu dan memverifikasi bahwa brankas kursi memblokirnya!",
  },
  en: {
    code: "EN",
    name: "English",
    placeholder: "Ask me anything (EN/ID/JA/ZH/KO/ES)…",
    scanBtn: "Scan Element",
    scanningBtn: "Click Target…",
    sleepBtn: "Rest",
    summonDemo: "Summon Demo",
    askMeBadge: "Bit-07 · Ask Me",
    dropToScanBadge: "Drop to Scan",
    clickElementBadge: "🎯 Click Element",
    liftedSpeech:
      "Whoa—I'm airborne! Drop me onto any seat card, button, or attack row and I'll scan and explain it!",
    liftedTitle: "Bit-07 · Airborne!",
    tickleSpeech:
      "Hehehe that tickles! My cyan pixel wings are fluttering! Ask me anything below.",
    tickleTitle: "Bit-07 · Ticklish! ^ᴗ^",
    wakeSpeech: "Systems online! What would you like me to explain today?",
    inspectPrompt:
      "🎯 Inspect Mode Active! Click any card, button, or section on the page and I'll fly over to explain how it works!",
    inspectTitle: "🎯 Click Any Element",
    landedSpeech:
      "Smooth landing! Drop me directly onto any card or control to inspect its on-chain logic.",
    zappedSpeech:
      "⚡ Bzzzt! Zapped that attack scenario and verified that the keyless seat vault blocks it!",
  },
  ja: {
    code: "JA",
    name: "日本語",
    placeholder: "何でも聞いてください (日本語/EN/ID)…",
    scanBtn: "要素スキャン",
    scanningBtn: "要素をクリック…",
    sleepBtn: "スリープ",
    summonDemo: "デモを起動",
    askMeBadge: "Bit-07 · 質問してね",
    dropToScanBadge: "ドロップで解析",
    clickElementBadge: "🎯 要素を選択",
    liftedSpeech:
      "わぁっ、持ち上げられた！気になるカードやボタン、攻撃行の上にドロップするとスキャンして解説するよ！",
    liftedTitle: "Bit-07 · 浮遊中！",
    tickleSpeech:
      "えへへ、くすぐったいよ！ピクセルの羽がパタパタしてる！下の欄から何でも質問してね。",
    tickleTitle: "Bit-07 · くすぐったい！^ᴗ^",
    wakeSpeech: "システム再起動完了！今日は何について解説しようか？",
    inspectPrompt:
      "🎯 スキャンモード起動！画面上の好きなカードやボタンをクリックすると、そこまで飛んで行って仕組みを説明するよ！",
    inspectTitle: "🎯 要素をクリック",
    landedSpeech:
      "着地成功！カードやボタンの上に直接ドロップしても中身をスキャンできるよ。",
    zappedSpeech:
      "⚡ ビビッ！その攻撃シナリオを実行して、キーレスVaultがブロックすることを確認したよ！",
  },
  zh: {
    code: "ZH",
    name: "中文",
    placeholder: "向 Bit-07 提问任何问题…",
    scanBtn: "扫描元素",
    scanningBtn: "点击任意元素…",
    sleepBtn: "休眠",
    summonDemo: "开启演示",
    askMeBadge: "Bit-07 · 问我吧",
    dropToScanBadge: "放下即可扫描",
    clickElementBadge: "🎯 点击元素",
    liftedSpeech:
      "哇——我飞起来啦！把我拖到任何席位卡片、按钮或攻击测试行上松手，我就会为你扫描并讲解！",
    liftedTitle: "Bit-07 · 悬浮中！",
    tickleSpeech:
      "哈哈哈好痒呀！我的像素翅膀都在抖动啦！在下方输入框问我任何问题吧。",
    tickleTitle: "Bit-07 · 好痒呀！^ᴗ^",
    wakeSpeech: "系统已唤醒！今天想了解 Logen 的哪个机制？",
    inspectPrompt:
      "🎯 扫描模式已开启！点击页面上的任意卡片或按钮，我会飞过去为你详细拆解它的原理！",
    inspectTitle: "🎯 点击任意元素",
    landedSpeech:
      "平稳着陆！你可以随时把我拖到任意卡片或按钮上进行扫描。",
    zappedSpeech:
      "⚡ 滋滋！已直接触发该攻击测试，并验证无密钥金库已将其彻底拦截！",
  },
  ko: {
    code: "KO",
    name: "한국어",
    placeholder: "무엇이든 물어보세요 (KO/EN/ID)…",
    scanBtn: "요소 스캔",
    scanningBtn: "요소 클릭…",
    sleepBtn: "휴식",
    summonDemo: "데모 켜기",
    askMeBadge: "Bit-07 · 질문하기",
    dropToScanBadge: "놓아서 스캔",
    clickElementBadge: "🎯 요소 클릭",
    liftedSpeech:
      "우와—들려 올라갔어요! 카드나 버튼, 공격 테스트 줄 위에 나를 내려놓으면 바로 스캔해서 설명해 줄게요!",
    liftedTitle: "Bit-07 · 비행 중!",
    tickleSpeech:
      "헤헤 간지러워요! 픽셀 날개가 파닥거려요! 아래 입력창에 무엇이든 물어보세요.",
    tickleTitle: "Bit-07 · 간지러워요! ^ᴗ^",
    wakeSpeech: "시스템 온라인! 오늘 어떤 기능을 설명해 드릴까요?",
    inspectPrompt:
      "🎯 스캔 모드 활성화! 화면의 아무 카드나 버튼을 클릭하면 날아가서 작동 원리를 설명해 드려요!",
    inspectTitle: "🎯 아무 요소나 클릭",
    landedSpeech:
      "착륙 완료! 언제든 카드나 버튼 위에 나를 끌어다 놓으면 스캔할 수 있어요.",
    zappedSpeech:
      "⚡ 찌릿! 해당 공격 시나리오를 즉시 실행하여 키리스 금고가 완벽히 차단하는 것을 확인했어요!",
  },
  es: {
    code: "ES",
    name: "Español",
    placeholder: "Pregúntame lo que quieras (ES/EN/ID)…",
    scanBtn: "Escanear",
    scanningBtn: "Haz clic…",
    sleepBtn: "Dormir",
    summonDemo: "Modo Demo",
    askMeBadge: "Bit-07 · Pregúntame",
    dropToScanBadge: "Suelta para escanear",
    clickElementBadge: "🎯 Clic en elemento",
    liftedSpeech:
      "¡Guau, estoy volando! ¡Suéltame sobre cualquier tarjeta, botón o fila de ataque y te explicaré cómo funciona!",
    liftedTitle: "Bit-07 · ¡En el aire!",
    tickleSpeech:
      "¡Jajaja, eso hace cosquillas! ¡Mis alas de píxeles están vibrando! Pregúntame lo que quieras abajo.",
    tickleTitle: "Bit-07 · ¡Cosquillas! ^ᴗ^",
    wakeSpeech: "¡Sistemas en línea! ¿Qué te gustaría que te explique hoy?",
    inspectPrompt:
      "🎯 ¡Modo Escaneo Activo! Haz clic en cualquier tarjeta o botón de la página y volaré hacia allí para explicártelo.",
    inspectTitle: "🎯 Haz clic en un elemento",
    landedSpeech:
      "¡Aterrizaje suave! Arrástrame sobre cualquier elemento para inspeccionar su lógica en NEAR.",
    zappedSpeech:
      "⚡ ¡Bzzzt! ¡Lancé ese escenario de ataque y verifiqué que la bóveda sin claves lo bloquea!",
  },
};

type TopicId =
  | "about"
  | "keyless"
  | "market"
  | "lab"
  | "revenue"
  | "lounge"
  | "mint"
  | "delegate"
  | "identity";

const TOPIC_KEYWORDS: Record<TopicId, string[]> = {
  about: [
    "logen",
    "apa itu",
    "what is",
    "tentang",
    "proyek",
    "project",
    "club",
    "klub",
    "とは",
    "何",
    "是什么",
    "介绍",
    "이란",
    "무엇",
    "qué es",
    "explica",
  ],
  keyless: [
    "keyless",
    "0 key",
    "zero key",
    "kunci",
    "access key",
    "aman",
    "plant key",
    "seed",
    "キー",
    "鍵",
    "密钥",
    "无密钥",
    "키",
    "열쇠",
    "clave",
    "llave",
  ],
  market: [
    "market",
    "jual",
    "beli",
    "buy",
    "sell",
    "escrow",
    "freeze",
    "frozen",
    "nonce",
    "pasar",
    "マーケット",
    "売買",
    "市场",
    "买卖",
    "마켓",
    "거래",
    "mercado",
    "venta",
  ],
  lab: [
    "attack",
    "serangan",
    "lab",
    "villain",
    "a1",
    "a2",
    "a3",
    "a4",
    "a5",
    "a6",
    "a7",
    "a8",
    "a9",
    "a10",
    "a11",
    "a12",
    "race",
    "interleaving",
    "攻撃",
    "攻击",
    "공격",
    "ataque",
  ],
  revenue: [
    "revenue",
    "bagi hasil",
    "pool",
    "earn",
    "tiket",
    "ticket",
    "event",
    "acara",
    "o(1)",
    "kas klub",
    "treasury",
    "royalti",
    "収益",
    "チケット",
    "分红",
    "门票",
    "수익",
    "티켓",
    "ingresos",
    "boleto",
  ],
  lounge: [
    "lounge",
    "pintu",
    "door",
    "gate",
    "nep-413",
    "cookie",
    "session",
    "masuk",
    "ラウンジ",
    "休息室",
    "라운지",
    "salón",
    "puerta",
  ],
  mint: [
    "mint",
    "buat kursi",
    "upload",
    "portrait",
    "gambar",
    "handle",
    "nama",
    "ミント",
    "铸造",
    "민팅",
    "acuñar",
  ],
  delegate: [
    "delegate",
    "delegasi",
    "batas",
    "allowance",
    "bot",
    "agen",
    "委任",
    "委托",
    "위임",
    "delegado",
  ],
  identity: [
    "kamu siapa",
    "who are you",
    "robot",
    "pet",
    "maskot",
    "mascot",
    "bisa apa",
    "bit-07",
    "誰",
    "你是谁",
    "누구",
    "quién eres",
  ],
};

interface LocalizedTopic {
  chipLabel?: string;
  title: string;
  answer: string;
  actionLabel?: string;
  actionRoute?: string;
}

const MULTILINGUAL_TOPICS: Record<PetLang, Record<TopicId, LocalizedTopic>> = {
  id: {
    about: {
      chipLabel: "Apa itu Logen?",
      title: "Apa itu Logen?",
      answer:
        "Logen adalah klub keanggotaan di NEAR di mana setiap kursi (Seat) adalah NFT NEP-171 sekaligus dompet sub-akun NEAR tanpa kunci (0 access keys). Saat kursi dijual, NFT, saldo NEAR di dalamnya, riwayat, dan akses Lounge berpindah bersamaan dalam 1 receipt atomik!",
      actionLabel: "Lihat Seat Roll",
      actionRoute: "/seats",
    },
    keyless: {
      chipLabel: "Kenapa 0 Keys?",
      title: "Kenapa Tanpa Kunci (0 Access Keys)?",
      answer:
        "Pada dompet NFT biasa yang menukar access key, penjual nakal bisa menyimpan kunci cadangan karena kontrak NEAR tidak bisa melihat daftar access key miliknya sendiri. Logen membuat sub-akun kursi tanpa AddKey (keys = []) dan menyegel akun induknya (DeleteKey). Jadi mustahil ada backdoor!",
      actionLabel: "Cek 5 Bukti On-Chain",
      actionRoute: "/verify",
    },
    market: {
      chipLabel: "Cara Kerja Market",
      title: "Safe Secondary Market & Escrow",
      answer:
        "Saat kursi dijual (list_seat), brankas kursi dibekukan (Frozen) dan diberi nomor urut listing_nonce. Saat pembeli membeli (buy_seat), kontrak memeriksa nonce dan saldo minimum (min_balance) dalam 1 receipt atomik (v_settle_sale). Jika saldo kurang 1 yoctoNEAR saja, penjualan batal & uang pembeli kembali 100%!",
      actionLabel: "Buka Market",
      actionRoute: "/market",
    },
    lab: {
      chipLabel: "12 Serangan Lab",
      title: "12 Skenario Serangan & 80.418 Interleavings",
      answer:
        "Di Attack Lab (/lab), kamu berperan sebagai penjahat yang mencoba mencuri dana dari pembeli (mulai dari menguras brankas di tengah transaksi hingga memalsukan sesi Lounge). Semua 12 serangan (A1–A12) gagal secara deterministik berkat Frozen state, listing_nonce, dan rotation_seq!",
      actionLabel: "Coba Attack Lab",
      actionRoute: "/lab",
    },
    revenue: {
      chipLabel: "Bagi Hasil O(1)",
      title: "Bagi Hasil Tiket O(1) & Kas Klub",
      answer:
        "Setiap tiket acara dibagi otomatis: 40% ke Pool Anggota (akumulator O(1) tanpa loop), 50% ke Kas Klub, dan 10% ke Organizer. Saat diklaim, pendapatan selalu masuk ke dalam brankas kursi—bukan ke dompet pribadi—sehingga ikut berpindah jika kursi dijual!",
      actionLabel: "Lihat Events & Pool",
      actionRoute: "/events",
    },
    lounge: {
      chipLabel: "Pintu Lounge",
      title: "Pintu Holder Lounge (/lounge)",
      answer:
        "Lounge menggunakan tanda tangan NEP-413 bebas gas dan melakukan Pair-Check (membaca Registry & Vault pada blok final yang sama) setiap 5 detik. Begitu kursi dijual ke orang lain, rotation_seq bertambah dan sesi pemilik lama langsung terkunci!",
      actionLabel: "Buka Lounge",
      actionRoute: "/lounge",
    },
    mint: {
      title: "Cara Mint Kursi Baru (/mint)",
      answer:
        "Di Mint Studio (/mint), unggah potret dan pilih custom handle (mis. garuda.logen.testnet). Kontrak membuat sub-akun tanpa kunci, memasang kode WASM brankas yang di-pin, dan mencetak NFT kursi dalam satu langkah!",
      actionLabel: "Ke Mint Studio",
      actionRoute: "/mint",
    },
    delegate: {
      title: "Epoch-Bound Spending Delegate",
      answer:
        "Pemilik kursi bisa menunjuk akun delegasi dengan batas pengeluaran NEAR tertentu. Delegasi ini terikat pada rotation_seq saat ini—begitu kursi berpindah tangan, delegasi lama otomatis hangus seketika!",
    },
    identity: {
      title: "Aku Bit-07, Robot Familiar Logen!",
      answer:
        "Aku adalah robot kubus bersayap pendamping penyihir Logen! Aku bisa berbicara dalam 6 bahasa (ID, EN, JA, ZH, KO, ES). Kamu bisa mengangkatku (drag), menjatuhkanku di atas elemen mana saja untuk ku-scan, atau bertanya apa saja!",
    },
  },
  en: {
    about: {
      chipLabel: "What is Logen?",
      title: "What is Logen?",
      answer:
        "Logen is a members club on NEAR where every seat is both an NEP-171 NFT and a real keyless NEAR sub-account wallet (0 access keys). When you sell the seat, the NFT, its NEAR balance, history, and Lounge access transfer together in one atomic receipt!",
      actionLabel: "Explore Seat Roll",
      actionRoute: "/seats",
    },
    keyless: {
      chipLabel: "Why 0 Keys?",
      title: "Why Zero Access Keys?",
      answer:
        "In traditional key-swapping NFT wallets, a seller can secretly keep a backup key because a NEAR contract cannot list its own access keys. Logen creates seat sub-accounts without AddKey (keys = []) and seals the parent registry with DeleteKey—making backdoor keys impossible!",
      actionLabel: "Verify 5 Proofs",
      actionRoute: "/verify",
    },
    market: {
      chipLabel: "Safe Market",
      title: "Safe Secondary Market & Escrow",
      answer:
        "Listing a seat (list_seat) freezes all vault outflows and increments listing_nonce. Buying (buy_seat) verifies both the nonce and min_balance inside the vault in a single atomic receipt (v_settle_sale). If even 1 yoctoNEAR is missing, the sale aborts and refunds the buyer 100%!",
      actionLabel: "Open Market",
      actionRoute: "/market",
    },
    lab: {
      chipLabel: "12 Lab Attacks",
      title: "12 Villain Attacks & 80,418 Interleavings",
      answer:
        "In the Attack Lab (/lab), you play the villain trying to rob a buyer across 12 scenarios (draining mid-sale, bait-and-switch relisting, stale delegates, forged lounge cookies). Every single attack is blocked deterministically by Frozen state, listing_nonce, and rotation_seq!",
      actionLabel: "Open Attack Lab",
      actionRoute: "/lab",
    },
    revenue: {
      chipLabel: "O(1) Revenue",
      title: "O(1) Ticket Revenue Sharing",
      answer:
        "Every event ticket splits automatically: 40% to the Member Pool (via an overflow-safe O(1) accumulator), 50% to the Club Treasury, and 10% to the Organizer. Claims always transfer NEAR directly into the seat vault—never to a personal wallet!",
      actionLabel: "View Events",
      actionRoute: "/events",
    },
    lounge: {
      chipLabel: "Lounge Gate",
      title: "Holder-Only Lounge Gate (/lounge)",
      answer:
        "The Lounge verifies holders via gasless NEP-413 signatures and runs a same-final-block T2 Pair-Check (Registry + Vault) every 5 seconds. The moment a seat is sold, rotation_seq increments and the former owner's session is locked out!",
      actionLabel: "Open Lounge",
      actionRoute: "/lounge",
    },
    mint: {
      title: "Minting a Keyless Seat (/mint)",
      answer:
        "In Mint Studio (/mint), upload a portrait and pick a handle. One atomic batch creates the keyless sub-account, deploys the pinned vault WASM, and mints your NEP-171 seat!",
      actionLabel: "Go to Mint",
      actionRoute: "/mint",
    },
    delegate: {
      title: "Epoch-Bound Spending Delegate",
      answer:
        "A holder can appoint a bounded spending delegate scoped to the current rotation_seq. When the seat transfers or sells, rotation_seq advances and the old delegate is wiped automatically!",
    },
    identity: {
      title: "I'm Bit-07, Logen's Winged Cube Robot!",
      answer:
        "I'm the sentient robot familiar from the Logen mascot artwork! I speak 6 languages (ID, EN, JA, ZH, KO, ES). Pick me up, drop me onto any element to scan it, or ask me anything!",
    },
  },
  ja: {
    about: {
      chipLabel: "Logenとは？",
      title: "Logen（ロゲン）とは？",
      answer:
        "LogenはNEAR上のメンバーズクラブで、各シート（座席）はNEP-171 NFTであり同時にアクセスキーを持たない（0 keys）NEARサブアカウント金庫です。シートを売却すると、NFT・内部のNEAR残高・履歴・ラウンジ権が1つのアトミックなレシートで同時に買い手へ移動します！",
      actionLabel: "シート一覧を見る",
      actionRoute: "/seats",
    },
    keyless: {
      chipLabel: "なぜ鍵が0個？",
      title: "なぜアクセスキーがゼロ（0 Keys）なのか？",
      answer:
        "鍵を交換する従来型NFTウォレットでは、NEARコントラクトが自身のアクセスキー一覧を取得できないため、売り手が予備の鍵（バックドア）を隠せました。LogenはAddKeyなしでサブアカウントを作成し、親アカウントもDeleteKeyで封印するため、秘密鍵の持ち出しが構造上不可能です！",
      actionLabel: "5つの証明を確認",
      actionRoute: "/verify",
    },
    market: {
      chipLabel: "安全なマーケット",
      title: "安全な二次流通マーケット（Safe Market）",
      answer:
        "出品（list_seat）するとVaultの出金が凍結（Frozen）され、listing_nonceが更新されます。購入（buy_seat）時は1つのアトミック実行（v_settle_sale）内でnonceと最低残高（min_balance）を検証し、1 yoctoNEARでも不足していれば即座に中断・全額返金されます！",
      actionLabel: "マーケットを開く",
      actionRoute: "/market",
    },
    lab: {
      chipLabel: "12の攻撃実験",
      title: "12の攻撃シナリオと80,418通りの検証",
      answer:
        "Attack Lab（/lab）では、悪役となって買い手から資金を奪う12の攻撃（売却中の引き出し、おとり再出品、古い委任キーの悪用など）を試せます。すべての攻撃がFrozen状態・nonce・rotation_seqによって確実にブロックされます！",
      actionLabel: "Attack Labへ",
      actionRoute: "/lab",
    },
    revenue: {
      chipLabel: "O(1) 収益分配",
      title: "O(1) チケット収益分配プール",
      answer:
        "イベントチケット売上の40%はメンバープール（ループ不要のO(1)アキュムレータ）、50%はクラブ金庫、10%は主催者に分配されます。請求（claim）された報酬は常にシートのVaultへ直接送金されます！",
      actionLabel: "イベントを見る",
      actionRoute: "/events",
    },
    lounge: {
      chipLabel: "ラウンジ認証",
      title: "ホルダー専用ラウンジ（/lounge）",
      answer:
        "ガス代不要のNEP-413署名と、5秒ごとの同一ファイナルブロックT2ペアチェック（Registry＋Vault）で認証します。シートを売却した瞬間にrotation_seqが進み、前の所有者は即座にロックアウトされます！",
      actionLabel: "ラウンジを開く",
      actionRoute: "/lounge",
    },
    mint: {
      title: "新しいシートのミント（/mint）",
      answer:
        "Mint Studio（/mint）でポートレート画像とハンドル名を設定すると、1回のバッチ処理でキーレスVaultのデプロイとNEP-171シートの発行が完了します！",
      actionLabel: "ミント画面へ",
      actionRoute: "/mint",
    },
    delegate: {
      title: "エポック限定支出デリゲート",
      answer:
        "所有者は上限付きの支出代理アカウントを設定できますが、現在のrotation_seqに紐づいているため、シートが譲渡・売却されると自動的に失効します！",
    },
    identity: {
      title: "ぼくはBit-07、Logenの相棒ロボット！",
      answer:
        "マスコット画像で魔法使いの隣を飛んでいる翼付きキューブロボットだよ！6言語（ID/EN/JA/ZH/KO/ES）に対応していて、ドラッグして要素の上に落とすと何でもスキャンして解説するよ！",
    },
  },
  zh: {
    about: {
      chipLabel: "什么是Logen？",
      title: "什么是 Logen？",
      answer:
        "Logen 是 NEAR 上的会员俱乐部，每个席位（Seat）既是 NEP-171 NFT，同时也是一个真正的零密钥（0 access keys）NEAR 子账户金库。当席位售出时，NFT、内部 NEAR 余额、历史记录和休息室权限会在同一个原子收据中一并移交给买家！",
      actionLabel: "查看全部席位",
      actionRoute: "/seats",
    },
    keyless: {
      chipLabel: "为何零密钥？",
      title: "为什么采用零访问密钥（0 Access Keys）？",
      answer:
        "传统的换绑密钥型 NFT 钱包中，由于 NEAR 合约无法枚举自身的访问密钥，卖家可以偷偷保留后门密钥。Logen 在创建席位子账户时不执行 AddKey（keys = []），并用 DeleteKey 永久封印父合约，从根源上杜绝了后门密钥！",
      actionLabel: "验证 5 项证明",
      actionRoute: "/verify",
    },
    market: {
      chipLabel: "安全二级市场",
      title: "安全二级市场与托管（Safe Market）",
      answer:
        "挂单（list_seat）会立即冻结金库转出并递增 listing_nonce。购买（buy_seat）在单个原子收据（v_settle_sale）内同时校验 nonce 与最低余额（min_balance）。如果金库内少哪怕 1 yoctoNEAR，交易立即回滚并 100% 退还买家资金！",
      actionLabel: "打开市场",
      actionRoute: "/market",
    },
    lab: {
      chipLabel: "12 项攻击测试",
      title: "12 种攻击场景与 80,418 种交错验证",
      answer:
        "在攻击实验室（/lab）中，你可以扮演反派尝试 12 种攻击（售中抽逃资金、诱饵重挂单、旧委托盗刷、伪造休息室会话等）。所有 12 种攻击均被冻结状态、listing_nonce 和单调递增的 rotation_seq 100% 拦截！",
      actionLabel: "进入攻击实验室",
      actionRoute: "/lab",
    },
    revenue: {
      chipLabel: "O(1) 门票分红",
      title: "O(1) 活动门票分红与金库",
      answer:
        "每张活动门票收入自动拆分：40% 进入会员池（通过防溢出的 O(1) 全局累加器均分给各席位）、50% 归俱乐部金库、10% 归主办方。领取的分红始终直接打入席位金库子账户！",
      actionLabel: "查看活动与分红",
      actionRoute: "/events",
    },
    lounge: {
      chipLabel: "休息室门禁",
      title: "持有者专属休息室（/lounge）",
      answer:
        "休息室通过免 Gas 的 NEP-413 签名认证，并每 5 秒在同一最终区块高度执行 T2 双重校验（Registry + Vault）。一旦席位易手，rotation_seq 增加，前任持有者会立即被锁在门外！",
      actionLabel: "进入休息室",
      actionRoute: "/lounge",
    },
    mint: {
      title: "铸造无密钥席位（/mint）",
      answer:
        "在铸造工坊（/mint）上传头像并选择专属标识，单笔原子批处理交易即可创建零密钥子账户、部署锁定哈希的金库代码并铸造 NFT！",
      actionLabel: "前往铸造",
      actionRoute: "/mint",
    },
    delegate: {
      title: "周期绑定的支出代理（Delegate）",
      answer:
        "持有者可设置带限额的支出代理账户，但该代理严格绑定当前 rotation_seq——席位一旦转让或售出，旧代理立即自动失效！",
    },
    identity: {
      title: "我是 Bit-07，Logen 的飞翼方块机器人！",
      answer:
        "我就是吉祥物插画里飞在巫师身旁的小机器人！我支持 6 种语言（ID/EN/JA/ZH/KO/ES），你可以抓起我拖到任何元素上扫描，或者随时向我提问！",
    },
  },
  ko: {
    about: {
      chipLabel: "Logen이란?",
      title: "Logen(로겐)이란 무엇인가요?",
      answer:
        "Logen은 모든 좌석(Seat)이 NEP-171 NFT이자 동시에 접근 키가 전혀 없는(0 access keys) NEAR 서브계정 금고인 멤버십 클럽입니다. 좌석을 판매하면 NFT, 내부 NEAR 잔액, 히스토리, 라운지 권한이 단 하나의 원자적 영수증으로 구매자에게 함께 이전됩니다!",
      actionLabel: "전체 좌석 보기",
      actionRoute: "/seats",
    },
    keyless: {
      chipLabel: "왜 키가 0개인가요?",
      title: "왜 접근 키가 0개(Zero Keys)인가요?",
      answer:
        "키를 교체하는 기존 NFT 지갑에서는 NEAR 컨트랙트가 자신의 접근 키 목록을 조회할 수 없어 판매자가 백도어 키를 숨길 수 있었습니다. Logen은 AddKey 없이 서브계정을 생성하고 부모 계정도 DeleteKey로 봉인하여 백도어를 원천 차단합니다!",
      actionLabel: "5가지 온체인 증명",
      actionRoute: "/verify",
    },
    market: {
      chipLabel: "안전한 마켓",
      title: "안전한 2차 마켓 & 에스크로",
      answer:
        "좌석을 판매 등록(list_seat)하면 금고 출금이 즉시 동결(Frozen)되고 listing_nonce가 증가합니다. 구매(buy_seat) 시 단일 원자적 실행(v_settle_sale)으로 nonce와 최소 잔액(min_balance)을 검증하며, 1 yoctoNEAR라도 부족하면 거래가 취소되고 100% 환불됩니다!",
      actionLabel: "마켓 열기",
      actionRoute: "/market",
    },
    lab: {
      chipLabel: "12가지 공격 실험",
      title: "12가지 빌런 공격 & 80,418개 교차 검증",
      answer:
        "Attack Lab(/lab)에서는 악당이 되어 12가지 공격(판매 중 출금, 미끼 재등록, 이전 위임자 악용 등)을 직접 시도해 볼 수 있습니다. 모든 공격은 동결 상태, listing_nonce, rotation_seq에 의해 완벽히 차단됩니다!",
      actionLabel: "Attack Lab 열기",
      actionRoute: "/lab",
    },
    revenue: {
      chipLabel: "O(1) 수익 분배",
      title: "O(1) 티켓 수익 분배 풀",
      answer:
        "이벤트 티켓 수익의 40%는 멤버 풀(O(1) 누적기), 50%는 클럽 금고, 10%는 주최자에게 분배됩니다. 청구(claim)된 수익은 개인 지갑이 아닌 좌석 금고로 직접 입금되어 좌석과 함께 이동합니다!",
      actionLabel: "이벤트 & 풀 보기",
      actionRoute: "/events",
    },
    lounge: {
      chipLabel: "라운지 게이트",
      title: "홀더 전용 라운지(/lounge)",
      answer:
        "NEP-413 서명과 5초마다 실행되는 동일 최종 블록 T2 페어 체크(Registry + Vault)로 홀더를 인증합니다. 좌석이 판매되는 순간 rotation_seq가 증가하여 이전 소유자의 세션은 즉시 잠깁니다!",
      actionLabel: "라운지 열기",
      actionRoute: "/lounge",
    },
    mint: {
      title: "새 좌석 민팅(/mint)",
      answer:
        "Mint Studio(/mint)에서 초상화를 올리고 핸들을 선택하면, 한 번의 원자적 배치로 키리스 서브계정 생성과 NEP-171 민팅이 완료됩니다!",
      actionLabel: "민팅하러 가기",
      actionRoute: "/mint",
    },
    delegate: {
      title: "에포크 바운드 지출 대리인(Delegate)",
      answer:
        "홀더는 지출 한도가 있는 대리 계정을 지정할 수 있으며, 좌석이 이전되거나 판매되면 rotation_seq가 증가해 기존 대리 권한은 즉시 소멸합니다!",
    },
    identity: {
      title: "나는 Bit-07, Logen의 날개 달린 큐브 로봇!",
      answer:
        "마스코트 일러스트에서 마법사 옆에 떠 있는 바로 그 로봇이에요! 6개 국어(ID, EN, JA, ZH, KO, ES)를 할 수 있고, 나를 끌어다 아무 요소 위에 놓으면 스캔해서 설명해 줄게요!",
    },
  },
  es: {
    about: {
      chipLabel: "¿Qué es Logen?",
      title: "¿Qué es Logen?",
      answer:
        "Logen es un club de miembros en NEAR donde cada asiento (Seat) es un NFT NEP-171 y al mismo tiempo una billetera de subcuenta NEAR sin claves (0 access keys). ¡Al vender el asiento, el NFT, el saldo NEAR interno, el historial y el acceso al Lounge pasan al comprador en un solo recibo atómico!",
      actionLabel: "Ver Asientos",
      actionRoute: "/seats",
    },
    keyless: {
      chipLabel: "¿Por qué 0 Claves?",
      title: "¿Por qué Cero Claves de Acceso (0 Keys)?",
      answer:
        "En billeteras NFT tradicionales que intercambian claves, el vendedor puede ocultar una clave de respaldo porque un contrato NEAR no puede listar sus propias claves. Logen crea subcuentas sin AddKey (keys = []) y sella el registro padre con DeleteKey: ¡es imposible dejar puertas traseras!",
      actionLabel: "Verificar 5 Pruebas",
      actionRoute: "/verify",
    },
    market: {
      chipLabel: "Mercado Seguro",
      title: "Mercado Secundario Seguro y Escrow",
      answer:
        "Listar un asiento (list_seat) congela los retiros de la bóveda e incrementa listing_nonce. Comprar (buy_seat) verifica el nonce y el saldo mínimo (min_balance) en un único recibo atómico (v_settle_sale). ¡Si falta 1 solo yoctoNEAR, la venta se cancela y reembolsa el 100%!",
      actionLabel: "Abrir Mercado",
      actionRoute: "/market",
    },
    lab: {
      chipLabel: "12 Ataques Lab",
      title: "12 Ataques y 80,418 Entrelazamientos",
      answer:
        "En el Attack Lab (/lab), juegas como el villano intentando robar al comprador en 12 escenarios. ¡Todos los ataques son bloqueados de forma determinista por el estado Frozen, listing_nonce y rotation_seq!",
      actionLabel: "Probar Attack Lab",
      actionRoute: "/lab",
    },
    revenue: {
      chipLabel: "Ingresos O(1)",
      title: "Reparto de Ingresos O(1) y Tesorería",
      answer:
        "Cada entrada vendida reparte el 40% al Pool de Miembros (acumulador O(1) sin bucles), 50% a la Tesorería del Club y 10% al Organizador. ¡Los reclamos se envían siempre dentro de la bóveda del asiento!",
      actionLabel: "Ver Eventos",
      actionRoute: "/events",
    },
    lounge: {
      chipLabel: "Puerta Lounge",
      title: "Salón Exclusivo para Titulares (/lounge)",
      answer:
        "El Lounge autentica con firmas NEP-413 sin gas y verifica el par Registry + Vault en el mismo bloque final cada 5 segundos. ¡En cuanto se vende el asiento, el antiguo dueño queda fuera al instante!",
      actionLabel: "Abrir Lounge",
      actionRoute: "/lounge",
    },
    mint: {
      title: "Acuñar un Asiento (/mint)",
      answer:
        "En Mint Studio (/mint), sube un retrato y elige un handle. ¡Un lote atómico despliega la bóveda sin claves y acuña tu NFT!",
      actionLabel: "Ir a Mint",
      actionRoute: "/mint",
    },
    delegate: {
      title: "Delegado de Gasto por Época",
      answer:
        "El titular puede autorizar un delegado con límite de gasto vinculado al rotation_seq actual; al transferir o vender el asiento, ¡el delegado se borra automáticamente!",
    },
    identity: {
      title: "¡Soy Bit-07, el Robot Familiar de Logen!",
      answer:
        "¡Soy el robot cubo con alas de la ilustración oficial de Logen! Hablo 6 idiomas (ID, EN, JA, ZH, KO, ES). ¡Arrástrame sobre cualquier elemento para escanearlo o pregúntame lo que quieras!",
    },
  },
};

const PAGE_GREETINGS: Record<
  PetLang,
  Record<string, { greeting: string; actionLabel: string }>
> = {
  id: {
    "/": {
      greeting:
        "Halo! Aku Bit-07, robot maskot Logen. Aku bisa 6 bahasa! Angkat & jatuhkan aku di atas elemen mana saja untuk kujelaskan!",
      actionLabel: "Cek 5 Bukti Vault",
    },
    "/lounge": {
      greeting:
        "Kita di Holder Lounge! Pintu ini mengecek kepemilikan kursi di blockchain setiap 5 detik.",
      actionLabel: "Masuk / Tes Pintu",
    },
    "/market": {
      greeting:
        "Ini Safe Secondary Market! Setiap kursi yang dijual membekukan brankasnya agar tetap aman.",
      actionLabel: "Sorot Kursi Terbaik",
    },
    "/mint": {
      greeting:
        "Selamat datang di Mint Studio! Cetak kursi NFT baru beserta brankas sub-akun tanpa kunci.",
      actionLabel: "Isi Nama Otomatis",
    },
    "/lab": {
      greeting:
        "Kita di Attack Lab (A1–A12)! Jatuhkan aku di atas baris serangan mana saja untuk langsung menyambarnya!",
      actionLabel: "Sambar Semua 12!",
    },
    "/verify": {
      greeting:
        "Halaman Verify memeriksa 5 bukti kriptografis kursi langsung dari RPC NEAR.",
      actionLabel: "Re-check Semua 5",
    },
    "/seats": {
      greeting:
        "Ini direktori seluruh kursi klub Logen beserta saldo NEAR yang tersimpan di dalamnya.",
      actionLabel: "Buat Kursi Baru",
    },
  },
  en: {
    "/": {
      greeting:
        "Hi! I'm Bit-07, Logen's mascot robot. I speak 6 languages! Pick me up & drop me onto any element to scan and explain it!",
      actionLabel: "Verify 5 Proofs",
    },
    "/lounge": {
      greeting:
        "Welcome to the Holder Lounge! The door re-verifies seat ownership on chain every 5 seconds.",
      actionLabel: "Test Door Check",
    },
    "/market": {
      greeting:
        "This is the Safe Secondary Market! Listed seats freeze their vault balance during escrow.",
      actionLabel: "Highlight Best Seat",
    },
    "/mint": {
      greeting:
        "Welcome to Mint Studio! Mint a custom portrait seat and deploy its keyless vault in one step.",
      actionLabel: "Auto-Fill Seat Name",
    },
    "/lab": {
      greeting:
        "We're in the Attack Lab (A1–A12)! Drop me onto any attack row to zap and test it immediately!",
      actionLabel: "Zap All 12 Attacks",
    },
    "/verify": {
      greeting:
        "The Verify page checks all 5 cryptographic proofs directly against NEAR RPC.",
      actionLabel: "Re-check All 5",
    },
    "/seats": {
      greeting:
        "Surveying the full club seat directory and the NEAR locked inside each vault.",
      actionLabel: "Mint a Seat",
    },
  },
  ja: {
    "/": {
      greeting:
        "こんにちは！Logenのマスコットロボ「Bit-07」だよ。6言語に対応！ぼくを持ち上げて好きな要素にドロップすると解説するよ！",
      actionLabel: "5つの証明を検証",
    },
    "/lounge": {
      greeting:
        "ここはホルダー専用ラウンジ！5秒ごとにオンチェーンでシート所有権を再確認しているよ。",
      actionLabel: "ドア認証テスト",
    },
    "/market": {
      greeting:
        "ここはSafe Market！出品中のシートはVaultが凍結され、中身が完全に保護されるよ。",
      actionLabel: "おすすめシート",
    },
    "/mint": {
      greeting:
        "Mint Studioへようこそ！ポートレート付きNFTとキーレス金庫を1ステップで作成できるよ。",
      actionLabel: "名前を自動入力",
    },
    "/lab": {
      greeting:
        "Attack Lab（A1〜A12）だよ！攻撃行の上にぼくをドロップすると電撃でテストを実行するよ！",
      actionLabel: "全12攻撃をブロック",
    },
    "/verify": {
      greeting:
        "Verifyページでは、NEAR RPCから直接5つの暗号学的証明を検証できるよ。",
      actionLabel: "全5項目を再検証",
    },
    "/seats": {
      greeting:
        "クラブの全シート一覧だよ。各シートが保持するNEAR残高と収益を確認できるよ。",
      actionLabel: "シートをミント",
    },
  },
  zh: {
    "/": {
      greeting:
        "你好！我是 Logen 吉祥物机器人 Bit-07，支持 6 种语言！抓起我拖到页面任意元素上松手，我就会为你扫描并讲解！",
      actionLabel: "验证 5 项证明",
    },
    "/lounge": {
      greeting:
        "这里是持有者专属休息室！门禁每 5 秒在链上重新校验一次席位归属。",
      actionLabel: "测试门禁校验",
    },
    "/market": {
      greeting:
        "这是安全二级市场！挂单出售的席位会自动冻结金库，确保内部 NEAR 分毫不少。",
      actionLabel: "高亮超值席位",
    },
    "/mint": {
      greeting:
        "欢迎来到铸造工坊！一步即可铸造自定义头像席位并部署零密钥金库。",
      actionLabel: "自动填入名称",
    },
    "/lab": {
      greeting:
        "这里是攻击实验室（A1–A12）！把我拖到任意攻击行上松手即可直接触发拦截测试！",
      actionLabel: "一键拦截全部 12 项",
    },
    "/verify": {
      greeting:
        "验证页面直接向 NEAR RPC 实时核对席位的 5 项链上安全证明。",
      actionLabel: "重新核验全部 5 项",
    },
    "/seats": {
      greeting:
        "这里展示了俱乐部所有席位及其金库内的 NEAR 余额与累计分红。",
      actionLabel: "铸造新席位",
    },
  },
  ko: {
    "/": {
      greeting:
        "안녕하세요! Logen 마스코트 로봇 Bit-07이에요. 6개 국어를 지원해요! 나를 끌어다 아무 요소 위에 놓으면 스캔해서 설명해 줄게요!",
      actionLabel: "5가지 증명 확인",
    },
    "/lounge": {
      greeting:
        "홀더 전용 라운지예요! 5초마다 온체인에서 좌석 소유권을 다시 확인합니다.",
      actionLabel: "도어 체크 테스트",
    },
    "/market": {
      greeting:
        "안전한 2차 마켓이에요! 판매 등록된 좌석은 금고가 동결되어 내부 NEAR가 안전하게 보호됩니다.",
      actionLabel: "추천 좌석 보기",
    },
    "/mint": {
      greeting:
        "민트 스튜디오에 오신 걸 환영해요! 초상화 NFT와 키리스 금고를 한 번에 생성해 보세요.",
      actionLabel: "이름 자동 입력",
    },
    "/lab": {
      greeting:
        "Attack Lab(A1–A12)이에요! 공격 줄 위에 나를 내려놓으면 즉시 전격 테스트를 실행해요!",
      actionLabel: "12개 공격 모두 차단",
    },
    "/verify": {
      greeting:
        "Verify 페이지는 NEAR RPC에서 직접 5가지 온체인 증명을 검증합니다.",
      actionLabel: "5개 모두 재검증",
    },
    "/seats": {
      greeting:
        "클럽의 전체 좌석 디렉토리와 각 금고에 보관된 NEAR 잔액을 볼 수 있어요.",
      actionLabel: "새 좌석 민팅",
    },
  },
  es: {
    "/": {
      greeting:
        "¡Hola! Soy Bit-07, el robot mascota de Logen. ¡Hablo 6 idiomas! ¡Arrástrame y suéltame sobre cualquier elemento para escanearlo y explicártelo!",
      actionLabel: "Verificar 5 Pruebas",
    },
    "/lounge": {
      greeting:
        "¡Estamos en el Salón de Titulares! La puerta verifica la propiedad del asiento cada 5 segundos.",
      actionLabel: "Probar Puerta",
    },
    "/market": {
      greeting:
        "¡Este es el Mercado Seguro! Los asientos en venta congelan su bóveda para proteger al comprador.",
      actionLabel: "Destacar Asiento",
    },
    "/mint": {
      greeting:
        "¡Bienvenido a Mint Studio! Acuña un asiento con retrato y despliega su bóveda sin claves en un paso.",
      actionLabel: "Autocompletar Nombre",
    },
    "/lab": {
      greeting:
        "¡Estamos en el Attack Lab (A1–A12)! ¡Suéltame sobre cualquier fila de ataque para probarla al instante!",
      actionLabel: "¡Bloquear los 12!",
    },
    "/verify": {
      greeting:
        "La página Verify comprueba las 5 pruebas criptográficas directamente en NEAR RPC.",
      actionLabel: "Re-verificar las 5",
    },
    "/seats": {
      greeting:
        "Explora el directorio completo de asientos del club y el NEAR guardado en cada bóveda.",
      actionLabel: "Acuñar Asiento",
    },
  },
};

/**
 * Automatically detects if the user typed a question in a specific language
 * so Bit-07 seamlessly responds in that language.
 */
function detectLanguageFromQuery(q: string, current: PetLang): PetLang {
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(q)) return "ja";
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(q)) return "ko";
  if (/[\u4E00-\u9FFF]/.test(q)) return "zh";
  if (/[¿¡]|(\b(qué|cómo|por qué|mercado|asiento|bóveda|claves|ataque|explica)\b)/i.test(q)) {
    return "es";
  }
  if (/\b(apa|kenapa|bagaimana|gimana|kursi|kunci|serangan|pasar|tolong|jelaskan|siapa)\b/i.test(q)) {
    return "id";
  }
  if (/\b(what|why|how|where|who|explain|tell|keys|vault|seat)\b/i.test(q)) {
    return "en";
  }
  return current;
}

/**
 * Pixel-accurate SVG sprite of the exact floating winged cube robot from `logen-mascot.png`.
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
        {/* LEFT CYAN PIXEL ENERGY WING */}
        <g transform={wingUp ? "translate(0, -1)" : "translate(0, 1)"}>
          <rect x="1" y="13" width="3" height="2" fill="#4DE8FF" />
          <rect x="2" y="15" width="4" height="2" fill="#3B9BFF" />
          <rect x="4" y="14" width="4" height="3" fill="#4DE8FF" />
          <rect x="6" y="16" width="3" height="2" fill="#1D6FE8" />
          <rect x="0" y="12" width="2" height="1" fill="#A6F4FF" />
        </g>

        {/* RIGHT CYAN PIXEL ENERGY WING */}
        <g transform={wingUp ? "translate(0, -1)" : "translate(0, 1)"}>
          <rect x="38" y="13" width="3" height="2" fill="#4DE8FF" />
          <rect x="36" y="15" width="4" height="2" fill="#3B9BFF" />
          <rect x="34" y="14" width="4" height="3" fill="#4DE8FF" />
          <rect x="33" y="16" width="3" height="2" fill="#1D6FE8" />
          <rect x="40" y="12" width="2" height="1" fill="#A6F4FF" />
        </g>

        {/* TOP POINTED ROBOT EARS */}
        <rect x="11" y="3" width="4" height="1" fill="#14192B" />
        <rect x="10" y="4" width="6" height="4" fill="#14192B" />
        <rect x="11" y="4" width="4" height="3" fill="#DCE6F7" />
        <rect x="12" y="5" width="2" height="2" fill="#4DE8FF" />

        <rect x="27" y="3" width="4" height="1" fill="#14192B" />
        <rect x="26" y="4" width="6" height="4" fill="#14192B" />
        <rect x="27" y="4" width="4" height="3" fill="#DCE6F7" />
        <rect x="28" y="5" width="2" height="2" fill="#4DE8FF" />

        {/* CUBE ROBOT CHASSIS */}
        <rect x="9" y="7" width="24" height="19" fill="#14192B" />
        <rect x="8" y="8" width="26" height="17" fill="#14192B" />
        <rect x="10" y="8" width="19" height="16" fill="#E6EEF9" />
        <rect x="10" y="8" width="19" height="2" fill="#FFFFFF" />
        <rect x="29" y="8" width="4" height="16" fill="#8FA3C7" />
        <rect x="31" y="9" width="2" height="14" fill="#6378A0" />
        <rect x="10" y="22" width="21" height="2" fill="#9BB0D4" />
        <rect x="11" y="9" width="1" height="1" fill="#8FA3C7" />
        <rect x="27" y="9" width="1" height="1" fill="#6378A0" />

        {/* DARK CRT SCREEN FACE */}
        <rect x="12" y="10" width="16" height="11" fill="#0B1020" />
        <rect x="13" y="11" width="14" height="9" fill="#11182D" />

        {/* EXPRESSIVE CYAN PIXEL EYES & MOUTH */}
        <g transform={`translate(${ex.toFixed(1)}, ${ey.toFixed(1)})`}>
          {mood === "sleeping" ? (
            <>
              <rect x="15" y="15" width="3" height="1" fill="#3B9BFF" />
              <rect x="22" y="15" width="3" height="1" fill="#3B9BFF" />
              <rect x="19" y="17" width="2" height="1" fill="#3B9BFF" />
            </>
          ) : mood === "lifted" ? (
            <>
              <rect x="15" y="13" width="3" height="3" fill="#4DE8FF" />
              <rect x="16" y="14" width="1" height="1" fill="#0B1020" />
              <rect x="22" y="13" width="3" height="3" fill="#4DE8FF" />
              <rect x="23" y="14" width="1" height="1" fill="#0B1020" />
              <rect x="19" y="17" width="2" height="2" fill="#4DE8FF" />
            </>
          ) : mood === "happy" || mood === "zapping" ? (
            <>
              <rect x="15" y="14" width="1" height="1" fill="#4DE8FF" />
              <rect x="16" y="13" width="1" height="1" fill="#A6F4FF" />
              <rect x="17" y="14" width="1" height="1" fill="#4DE8FF" />

              <rect x="22" y="14" width="1" height="1" fill="#4DE8FF" />
              <rect x="23" y="13" width="1" height="1" fill="#A6F4FF" />
              <rect x="24" y="14" width="1" height="1" fill="#4DE8FF" />

              <rect x="18" y="17" width="1" height="1" fill="#4DE8FF" />
              <rect x="19" y="18" width="2" height="1" fill="#A6F4FF" />
              <rect x="21" y="17" width="1" height="1" fill="#4DE8FF" />
            </>
          ) : mood === "scanning" ? (
            <>
              <rect x="14" y="14" width="12" height="2" fill="#4DE8FF" />
              <rect x="16" y="14" width="3" height="2" fill="#FFFFFF" />
              <rect x="18" y="18" width="4" height="1" fill="#3B9BFF" />
            </>
          ) : (
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
              <rect x="14" y="16" width="1" height="1" fill="#1D6FE8" />
              <rect x="25" y="16" width="1" height="1" fill="#1D6FE8" />
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

        {/* CUTE PIXEL FEET */}
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

        {/* GLOWING CYAN ORBITAL SWIRL UNDERNEATH */}
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
 * Multilingual element scanner that explains any clicked or dropped-on DOM element
 * in the active language (`id`, `en`, `ja`, `zh`, `ko`, `es`).
 */
function explainElementMultilingual(el: HTMLElement, lang: PetLang): string {
  const text = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const topics = MULTILINGUAL_TOPICS[lang];

  if (lower.includes("inside vault") || lower.includes("portrait") || lower.includes("locked inside")) {
    return topics.keyless.answer;
  }
  if (lower.includes("ascii vault") || el.tagName === "CANVAS") {
    return topics.about.answer;
  }
  if (lower.includes("buy this seat") || lower.includes("asking") || lower.includes("market")) {
    return topics.market.answer;
  }
  if (
    lower.includes("try it") ||
    lower.includes("blocked") ||
    lower.includes("simulate race") ||
    /^a\d+/i.test(lower)
  ) {
    return topics.lab.answer;
  }
  if (lower.includes("re-check") || lower.includes("access keys") || lower.includes("code hash")) {
    return topics.keyless.answer;
  }
  if (lower.includes("mint")) {
    return topics.mint.answer;
  }
  if (lower.includes("door") || lower.includes("lounge")) {
    return topics.lounge.answer;
  }
  if (lower.includes("event") || lower.includes("ticket") || lower.includes("pool")) {
    return topics.revenue.answer;
  }
  if (lower.includes("delegate")) {
    return topics.delegate.answer;
  }
  return topics.about.answer;
}

export function LogenWizardCompanion() {
  const pathname = usePathname();
  const router = useRouter();
  const { accountId } = useNear();
  const { demo, setDemo } = useDemo();

  const [lang, setLang] = useState<PetLang>("id");
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mood, setMood] = useState<RobotMood>("calm");
  const [panelOpen, setPanelOpen] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [autoRoam, setAutoRoam] = useState(true);
  const [title, setTitle] = useState("Bit-07 · Robot Familiar Logen");
  const [fullSpeech, setFullSpeech] = useState(PAGE_GREETINGS.id["/"].greeting);
  const [typedSpeech, setTypedSpeech] = useState(PAGE_GREETINGS.id["/"].greeting);
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

  const meta = LANG_META[lang];
  const langGreetings = PAGE_GREETINGS[lang];
  const pageInfo = langGreetings[pathname] ?? langGreetings["/"];

  const speak = useCallback(
    (
      newText: string,
      newTitle = "Bit-07 · Robot Familiar Logen",
      nextMood: RobotMood = "talking",
      routeSuggestion: { label: string; route: string } | null = null,
      shouldOpenPanel = false
    ) => {
      setTitle(newTitle);
      setFullSpeech(newText);
      setSuggestedRoute(routeSuggestion);
      if (shouldOpenPanel) {
        setPanelOpen(true);
      }
      setMood(nextMood);
    },
    []
  );

  // Typewriter speech animation
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

  // Route or language change awareness (updates speech silently without forcing bubble open)
  useEffect(() => {
    if (mood === "sleeping") return;
    const info = PAGE_GREETINGS[lang][pathname] ?? PAGE_GREETINGS[lang]["/"];
    speak(
      info.greeting,
      `Bit-07 (${LANG_META[lang].code}) · ${pathname === "/" ? "Home" : pathname}`,
      "happy",
      null,
      false
    );
  }, [pathname, lang, speak]);

  // Global Inspect Mode click listener
  useEffect(() => {
    if (!inspectMode) return;
    const onInspectClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-robot-companion]")) return;

      e.preventDefault();
      e.stopPropagation();

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
      const explanation = explainElementMultilingual(target, lang);
      speak(explanation, `🔍 Bit-07 (${LANG_META[lang].code})`, "scanning", null, true);
      setInspectMode(false);
    };

    window.addEventListener("click", onInspectClick, true);
    return () => window.removeEventListener("click", onInspectClick, true);
  }, [inspectMode, lang, speak]);

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
            const tryBtn = under
              .closest("div")
              ?.querySelector("button[aria-label^='Try attack']") as HTMLButtonElement | null;
            if (tryBtn) {
              tryBtn.click();
              speak(
                LANG_META[lang].zappedSpeech,
                `⚡ Bit-07 (${LANG_META[lang].code})`,
                "zapping"
              );
              return;
            }
            const explanation = explainElementMultilingual(under, lang);
            speak(explanation, `🔍 Bit-07 (${LANG_META[lang].code})`, "happy");
            return;
          }
        }
        speak(
          LANG_META[lang].landedSpeech,
          `Bit-07 (${LANG_META[lang].code})`,
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
  }, [lang, speak]);

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
      speak(meta.liftedSpeech, meta.liftedTitle, "lifted", null, false);
    }
  };

  const handleRobotClick = (e: React.MouseEvent) => {
    if (dragRef.current.moved) return;
    if (mood === "sleeping") {
      castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.9, tone: "signal" });
      speak(meta.wakeSpeech, `Bit-07 (${meta.code})`, "happy", null, false);
      return;
    }

    pokeCountRef.current += 1;
    castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.75, tone: "signal" });

    if (pokeCountRef.current >= 3) {
      pokeCountRef.current = 0;
      speak(meta.tickleSpeech, meta.tickleTitle, "happy", null, true);
      return;
    }

    setPanelOpen((prev) => !prev);
  };

  const selectTopic = (topicId: TopicId, targetLang = lang) => {
    const entry = MULTILINGUAL_TOPICS[targetLang][topicId];
    speak(
      entry.answer,
      `💡 ${entry.title}`,
      "talking",
      entry.actionRoute && entry.actionLabel
        ? { label: entry.actionLabel, route: entry.actionRoute }
        : null,
      true
    );
  };

  const answerQuery = (rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return;

    // Auto-detect language from user's question and switch seamlessly
    const detectedLang = detectLanguageFromQuery(q, lang);
    if (detectedLang !== lang) {
      setLang(detectedLang);
    }

    const topicIds = Object.keys(TOPIC_KEYWORDS) as TopicId[];
    for (const id of topicIds) {
      if (TOPIC_KEYWORDS[id].some((kw) => q.includes(kw))) {
        selectTopic(id, detectedLang);
        return;
      }
    }

    // Fallback comprehensive explanation in the detected language
    selectTopic("about", detectedLang);
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
      selectTopic("about", lang);
      return;
    }

    if (pathname === "/lab") {
      const runAllBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Run all 12")
      );
      runAllBtn?.click();
      selectTopic("lab", lang);
    } else if (pathname === "/verify") {
      const recheckBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Re-check all")
      );
      recheckBtn?.click();
      selectTopic("keyless", lang);
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
      }
      selectTopic("mint", lang);
    } else if (pathname === "/market") {
      const buyBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Buy this seat")
      );
      buyBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      selectTopic("market", lang);
    } else if (pathname === "/lounge") {
      const enterBtn = Array.from(document.querySelectorAll("button")).find(
        (b) =>
          b.textContent?.includes("Enter with seat") || b.textContent?.includes("Sign to enter")
      );
      enterBtn?.click();
      selectTopic("lounge", lang);
    } else {
      router.push("/verify");
      selectTopic("keyless", lang);
    }
  };

  const quickTopicIds: TopicId[] = ["about", "keyless", "market", "lab", "revenue", "lounge"];

  if (mood === "sleeping") {
    return (
      <div data-robot-companion="true" className="fixed bottom-4 right-4 z-50 select-none">
        <button
          type="button"
          onClick={handleRobotClick}
          className="group flex items-center gap-2 rounded-full border border-[#4de8ff]/40 bg-[#070d19]/95 px-3.5 py-2 font-mono text-[11px] text-[#4de8ff] shadow-[0_0_24px_rgba(77,232,255,0.2)] backdrop-blur-md transition-all hover:border-[#4de8ff] hover:text-paper"
          title="Wake up Bit-07 Robot Companion"
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
      {/* Interactive Multilingual Holo-Comms Brain Panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            data-robot-panel="true"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-[102px] right-0 w-[318px] sm:w-[348px] rounded-lg border border-[#4de8ff]/40 bg-[#080e1a]/95 p-3.5 shadow-[0_14px_44px_rgba(0,0,0,0.65),0_0_28px_rgba(77,232,255,0.14)] backdrop-blur-md"
          >
            {/* Header + 6-Language Switcher Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
              <div className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-[#4de8ff]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4de8ff] animate-pulse" />
                <span className="truncate">{title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAutoRoam((r) => !r)}
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

            {/* 6-Language Pill Selector (ID / EN / JA / ZH / KO / ES) */}
            <div className="mt-2 flex items-center justify-between gap-1 rounded border border-line bg-ink-deep/80 px-2 py-1">
              <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-label text-paper-muted">
                <Globe className="h-2.5 w-2.5 text-[#4de8ff]" />
                {meta.name}
              </span>
              <div className="flex items-center gap-1">
                {LANG_ORDER.map((l) => {
                  const active = l === lang;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      aria-pressed={active}
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase transition-colors ${
                        active
                          ? "bg-[#4de8ff] text-[#050a14]"
                          : "text-paper-muted hover:text-paper"
                      }`}
                    >
                      {LANG_META[l].code}
                    </button>
                  );
                })}
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

            {/* Localized Quick Topic Chips */}
            <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-2.5">
              {quickTopicIds.map((id) => {
                const topic = MULTILINGUAL_TOPICS[lang][id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTopic(id, lang)}
                    className="rounded border border-line bg-surface/80 px-2 py-0.5 font-mono text-[9px] text-paper-dim transition-colors hover:border-[#4de8ff]/60 hover:text-[#4de8ff]"
                  >
                    {topic.chipLabel ?? topic.title}
                  </button>
                );
              })}
            </div>

            {/* Ask Anything Input Box (Auto-detects Language!) */}
            <form onSubmit={handleAskSubmit} className="mt-2.5 flex items-center gap-1.5">
              <div className="relative flex-1">
                <MessageSquare className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-paper-muted" />
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={meta.placeholder}
                  aria-label="Ask Bit-07 Robot in any language"
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

            {/* Bottom Action Bar */}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-line pt-2.5 font-mono text-[9px] uppercase tracking-label">
              <button
                type="button"
                onClick={() => {
                  const next = !inspectMode;
                  setInspectMode(next);
                  if (next) {
                    speak(meta.inspectPrompt, meta.inspectTitle, "scanning");
                  }
                }}
                className={`inline-flex items-center justify-center gap-1 rounded border px-2 py-1.5 transition-colors ${
                  inspectMode
                    ? "border-positive bg-positive-soft text-positive"
                    : "border-line bg-ink-deep text-paper-dim hover:border-[#4de8ff] hover:text-paper"
                }`}
              >
                <Crosshair className="h-2.5 w-2.5" />
                <span className="truncate">{inspectMode ? meta.scanningBtn : meta.scanBtn}</span>
              </button>

              <button
                type="button"
                onClick={runSmartPageAction}
                className="inline-flex items-center justify-center gap-1 rounded border border-[#4de8ff]/50 bg-[#4de8ff]/15 px-2 py-1.5 text-[#4de8ff] transition-colors hover:bg-[#4de8ff]/25"
              >
                <Zap className="h-2.5 w-2.5" />
                <span className="truncate">
                  {!demo && !accountId && pathname !== "/lab"
                    ? meta.summonDemo
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
                {meta.sleepBtn}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable Floating Winged Cube Robot Body */}
      <motion.div
        onPointerDown={handlePointerDown}
        onClick={handleRobotClick}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        role="button"
        tabIndex={0}
        aria-label="Bit-07 Logen Robot Pet. Drag to pick up and drop on any element to inspect, or click to ask anything in 6 languages."
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
            ? meta.clickElementBadge
            : mood === "lifted"
              ? meta.dropToScanBadge
              : meta.askMeBadge}
        </span>
      </motion.div>
    </motion.div>
  );
}
