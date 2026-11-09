export type Sponsor = 'gitar' | 'dash0' | 'radar';
export type TechKind = 'rule' | 'check' | 'query' | 'trace' | 'dashboard' | 'investigation' | 'workflow';

export interface TechRef {
  sponsor: Sponsor;
  kind: TechKind;
  /** Technical name, shown as code, not translated: "inclusion.md IN-2", "kc_capture_saved_ms p95". */
  label: string;
  /** Repo path (H links it to github.com/rfun-solutions/wemakedevs_hackathon_2026/blob/main/<ref>) or a public URL. */
  ref?: string;
  /** H fills this from F's /api/status/health or /api/status/release. */
  live?: `promise:${'P1' | 'P2' | 'P3' | 'P4' | 'P5'}` | 'release' | `route:${string}`;
}

export interface UnderTheHoodEntry {
  /** The change id, equal to the file name: 'b-capture'. */
  id: string;
  /** Merge order 1..9 (C0 1, D 2, G 3, A 4, B 5, F 6, E 7, C 8, H 9). */
  order: number;
  /** i18n key in the change's own domain file, e.g. 'capture.hood.title'. */
  titleKey: string;
  /** One plain sentence: what it does for Kay. */
  whatKey: string;
  /** Access promise ids this feature serves, may be empty. */
  promises: string[];
  /** 1..6 items. */
  tech: TechRef[];
}
