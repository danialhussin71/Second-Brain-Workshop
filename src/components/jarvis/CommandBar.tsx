"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Article, Cards, EnvelopeSimple, FilmSlate, Image, Microphone, Stop, VideoCamera } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { matchSlashCommands, parseSlashCommand, type SlashCommand } from "@/lib/slash-commands";

const COMMAND_ICONS: Record<SlashCommand["icon"], typeof Cards> = { Article, Image, Cards, VideoCamera, FilmSlate, EnvelopeSimple };

type SR = {
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

export default function CommandBar({
  onSubmit,
  running,
}: {
  onSubmit: (text: string) => void;
  running: boolean;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);
  const [voiceOk, setVoiceOk] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // A chosen command lives as a chip beside the input; the input holds only the topic.
  const [command, setCommand] = useState<SlashCommand | null>(null);
  const [menuRect, setMenuRect] = useState<{ left: number; width: number; bottom: number } | null>(null);

  // The menu is open while the founder is still typing the command word itself.
  const commandWord = command ? undefined : value.match(/^\/([a-z-]*)$/i)?.[1];
  const suggestions = commandWord !== undefined ? matchSlashCommands(commandWord) : [];
  const menuOpen = commandWord !== undefined && !menuDismissed && !running;
  const active = command ? { command, topic: value.trim() } : null;
  const unknownCommand = !command && /^\/[a-z-]+\s/i.test(value);
  const selected = suggestions[Math.min(highlight, suggestions.length - 1)];

  // The menu is portalled to <body> so no sibling panel can paint over it; track the bar's position.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const place = () => {
      const rect = barRef.current?.getBoundingClientRect();
      if (rect) setMenuRect({ left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 8 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
    if (!Ctor) return;
    setVoiceOk(true);
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const txt = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join("");
      setValue(txt);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, []);

  const submit = (text?: string) => {
    const typed = (text ?? value).trim();
    const t = command ? `/${command.name} ${typed}`.trim() : typed;
    if (!t || running || unknownCommand) return;
    onSubmit(t);
    setValue("");
    setCommand(null);
  };

  const complete = (next: SlashCommand, rest = "") => {
    setCommand(next);
    setValue(rest);
    setHighlight(0);
    inputRef.current?.focus();
  };

  const toggleMic = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setValue("");
      rec.start();
      setListening(true);
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {menuOpen && menuRect && createPortal(
        <div style={{ left: menuRect.left, width: menuRect.width, bottom: menuRect.bottom }} className="fixed z-[1000] overflow-hidden rounded-2xl border border-white/10 bg-[#070b14]/95 p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[.2em] text-white/35">Commands</p>
          {suggestions.length ? suggestions.map((command, index) => {
            const Icon = COMMAND_ICONS[command.icon];
            return (
              <button
                key={command.name}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => complete(command)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", command === selected ? "bg-white/[.07]" : "hover:bg-white/[.04]")}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-400/[.06] text-cyan-200"><Icon size={16} weight="duotone" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2"><span className="font-mono text-[12.5px] text-white">/{command.name}</span><span className="text-[11px] text-white/45">{command.label}</span></span>
                  <span className="block truncate text-[11px] text-white/35">{command.description} · e.g. {command.example}</span>
                </span>
              </button>
            );
          }) : <p className="px-2.5 py-2 text-[12px] text-white/45">No command matches /{commandWord}</p>}
        </div>,
        document.body,
      )}
      <div
        ref={barRef}
        className={cn(
          "flex w-full items-center gap-2 rounded-2xl border bg-[#070b14]/80 px-3 py-2.5 backdrop-blur-xl transition-colors",
          listening ? "border-rose-400/50 shadow-[0_0_30px_rgba(244,63,94,0.18)]" : "border-white/10 focus-within:border-cyan-300/40",
        )}
      >
        <span className="pl-1.5 font-mono text-[11px] tracking-widest text-cyan-300/70">›</span>
        {command && <span className="shrink-0 rounded-md border border-cyan-300/25 bg-cyan-400/[.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-cyan-200">{command.label}</span>}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            // Typing or pasting a full `/command ` turns it into the chip.
            const typed = !command && e.target.value.match(/^\/([a-z-]+)\s([\s\S]*)$/i);
            const found = typed ? parseSlashCommand(e.target.value) : null;
            if (typed && found) {
              complete(found.command, typed[2]);
              setMenuDismissed(false);
              return;
            }
            setValue(e.target.value);
            setHighlight(0);
            setMenuDismissed(false);
          }}
          onKeyDown={(e) => {
            // Backspace at the very start of the input removes the command chip.
            if (command && e.key === "Backspace" && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
              e.preventDefault();
              setCommand(null);
              return;
            }
            if (menuOpen && suggestions.length) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setHighlight((current) => (Math.min(current, suggestions.length - 1) + step + suggestions.length) % suggestions.length);
                return;
              }
              if ((e.key === "Tab" || e.key === "Enter") && selected) {
                e.preventDefault();
                complete(selected);
                return;
              }
            }
            if (menuOpen && e.key === "Escape") {
              e.preventDefault();
              setMenuDismissed(true);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={running ? "Your CEO is working…" : command ? `e.g. ${command.example}` : "Tell the CEO what you need, or type / for commands."}
          disabled={running}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30 disabled:opacity-60"
        />
        {voiceOk && (
          <button
            onClick={toggleMic}
            disabled={running}
            title="Voice input"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl transition disabled:opacity-40",
              listening ? "bg-rose-500/20 text-rose-300" : "text-white/45 hover:bg-white/5 hover:text-white",
            )}
          >
            {listening ? <Stop size={16} weight="fill" /> : <Microphone size={17} />}
          </button>
        )}
        <button
          onClick={() => submit()}
          disabled={running || (!value.trim() && !command) || unknownCommand}
          className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/90 text-[#04121a] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          <ArrowUp size={17} weight="bold" />
        </button>
      </div>
      {unknownCommand ? (
        <p className="mt-1.5 text-[11px] text-rose-300/80">Unknown command. Type / to see what's available.</p>
      ) : active ? (
        <p className="mt-1.5 text-[11px] text-white/35">{active.topic ? `Enter to create the ${active.command.label.toLowerCase()}.` : `Add a topic, or press Enter and the brain picks one. e.g. ${active.command.example}`}</p>
      ) : null}
    </div>
  );
}
