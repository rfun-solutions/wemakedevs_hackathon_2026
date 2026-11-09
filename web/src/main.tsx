import { render } from 'preact';
import { App } from './app';
import { initTelemetry } from './telemetry';
import { registerServiceWorker } from './sw-register';
import './styles/tokens.css';
import './styles/base.css';
import './styles/global.css';

void initTelemetry();
render(<App />, document.getElementById('app')!);
registerServiceWorker();
