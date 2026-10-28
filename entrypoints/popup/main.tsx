import { render } from 'solid-js/web';
import { browser } from 'wxt/browser';

function App() {
  return (
    <main style={{ padding: '16px', width: '280px', 'font-family': 'system-ui, sans-serif' }}>
      <h1 style={{ margin: 0, 'font-size': '18px' }}>FandomGobbler (Fork)</h1>
      <p>Version {browser.runtime.getManifest().version}. Rewrite in progress.</p>
    </main>
  );
}

render(() => <App />, document.getElementById('app')!);
