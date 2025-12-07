import { render } from 'preact';

import { App } from './App';
import './style.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  render(<App />, rootElement);
}
