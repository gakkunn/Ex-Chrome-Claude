import { render } from 'preact';

import { App } from './App';
import './style.css';

// Set document title and lang dynamically (i18n placeholders don't work in HTML)
document.title = chrome.i18n.getMessage('extension_name');
document.documentElement.lang = chrome.i18n.getUILanguage();

const rootElement = document.getElementById('root');

if (rootElement) {
  render(<App />, rootElement);
}
