// CONTRACT STUB (C0w). E (e-captions-translation) replaces this file and keeps the signatures.
export interface SpeechSession {
  supported: boolean;
  engine?: 'whisper' | 'webspeech';
  stop(): void;
}

export interface CaptionSegment {
  id: string;
  text: string;
  lang: string;
  final: boolean;
}

export function startDictation(_onText: (text: string) => void): Promise<SpeechSession> {
  return Promise.resolve({ supported: false, stop() {} });
}

export function startCaptions(_onSegment: (segment: CaptionSegment) => void): Promise<SpeechSession> {
  return Promise.resolve({ supported: false, stop() {} });
}
