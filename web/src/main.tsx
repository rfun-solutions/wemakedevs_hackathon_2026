import { render } from 'preact';
import { App } from './app';
import { initTelemetry } from './telemetry';
import { registerServiceWorker } from './sw-register';
import './styles/tokens.css';
import './styles/base.css';
// >> d-access-kit
import './styles/global.css';

// >> d-access-kit
import { initDisplayPrefs } from './prefs/display';
import { applyDocumentLang, getLang } from './i18n';

initDisplayPrefs();
applyDocumentLang(getLang());
void initTelemetry();
render(<App />, document.getElementById('app')!);
registerServiceWorker();
