// Optional text-to-speech: feature-detected, never autoplays, voice picked by language.
import type { CardLang } from './card-text';

const BCP47: Record<CardLang, string> = {
  en: 'en-US',
  es: 'es-ES',
  'pt-BR': 'pt-BR',
  ar: 'ar-SA',
};

export function speechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

/** Prefer an exact region match, then any voice with the same base language. */
export function pickVoice(
  voices: readonly Pick<SpeechSynthesisVoice, 'lang' | 'name'>[],
  lang: CardLang,
): (typeof voices)[number] | undefined {
  const want = BCP47[lang].toLowerCase();
  const base = want.split('-')[0] ?? want;
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === want) ??
    voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(base))
  );
}

/** Speak once. Must be called from a user action. */
export function speak(text: string, lang: CardLang): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP47[lang];
  const voice = pickVoice(synth.getVoices(), lang);
  if (voice) u.voice = voice as SpeechSynthesisVoice;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
