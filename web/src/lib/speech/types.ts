export type EngineId = 'whisper' | 'webspeech';
export type Platform = 'ios' | 'desktop-chromium' | 'other';
export type DeviceClass = 'ios' | 'android' | 'desktop';

export interface SpeechSession {
  supported: boolean;
  engine?: EngineId;
  stop(): void;
}

export interface CaptionSegment {
  id: string;
  text: string;
  lang: string;
  final: boolean;
}

/** A running recognition engine (browser speech API or Whisper). */
export interface Engine {
  id: EngineId;
  start(): Promise<void>;
  stop(): void;
}

export interface EngineCallbacks {
  onSegment(segment: CaptionSegment): void;
  /** Lag of one segment in ms (chunk end to text shown; browser engine: last interim to final). */
  onLag?(ms: number): void;
  /** Latency from `audiostart` (not `start()`) to the first recognised word. */
  onFirstWord?(ms: number): void;
  onRestart?(): void;
  /** The engine gave up (for example 5 empty restarts); the string is a short machine reason. */
  onGiveUp?(reason: string): void;
}
