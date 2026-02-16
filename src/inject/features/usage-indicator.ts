const CHAT_INPUT_CONTAINER_SELECTOR = '[data-testid="chat-input-grid-container"]';
const CHAT_INPUT_SELECTOR =
  'div.tiptap.ProseMirror[contenteditable="true"][data-testid="chat-input"], textarea[data-testid="chat-input-ssr"]';
const EXTRA_USAGE_SECTION_SELECTOR = 'section[data-testid="extra-usage-section"]';
const INDICATOR_SELECTOR = '[data-cps-usage-indicator="true"]';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SEND_REFRESH_DELAY_MS = 1200;
const SCAN_INTERVAL_MS = 250;
const SCAN_RETRY_COUNT = 20;
const HEARTBEAT_INTERVAL_MS = 5000;
const IFRAME_FETCH_TIMEOUT_MS = 12000;
const IFRAME_POLL_INTERVAL_MS = 300;

interface UsageSnapshot {
  sessionReset: string;
  sessionPercent: string;
  weeklyReset: string;
  weeklyPercent: string;
}

interface PartialUsageSnapshot {
  sessionReset: string | null;
  sessionPercent: string | null;
  weeklyReset: string | null;
  weeklyPercent: string | null;
}

const DEFAULT_SNAPSHOT: UsageSnapshot = {
  sessionReset: 'Resets in -',
  sessionPercent: '-%',
  weeklyReset: 'Resets -',
  weeklyPercent: '-%',
};

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function extractPercentToken(text: string | null | undefined): string | null {
  const normalized = normalizeText(text).replace(',', '.');
  if (!normalized) return null;

  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*[%％]/);
  if (!match) return null;
  return `${match[1]}%`;
}

function normalizePercent(raw: string | null | undefined): string | null {
  const text = normalizeText(raw);
  if (!text) return null;
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%?/);
  if (!match) return null;
  return `${match[1]}%`;
}

function normalizeReset(raw: string | null | undefined, withIn: boolean): string | null {
  const text = normalizeText(raw);
  if (!text) return null;
  if (/^Resets\b/i.test(text)) return text;
  return withIn ? `Resets in ${text}` : `Resets ${text}`;
}

function extractResetText(root: ParentNode): string | null {
  const paragraphs = Array.from(root.querySelectorAll<HTMLParagraphElement>('p'))
    .map((node) => normalizeText(node.textContent))
    .filter(Boolean);
  const nonPercentParagraphs = paragraphs.filter((text) => !extractPercentToken(text));

  if (nonPercentParagraphs.length >= 2) {
    return nonPercentParagraphs[1];
  }
  if (nonPercentParagraphs.length === 1) {
    return nonPercentParagraphs[0];
  }

  const nodes = root.querySelectorAll<HTMLElement>('span, div');
  for (const node of nodes) {
    const text = normalizeText(node.textContent);
    if (!text || extractPercentToken(text)) continue;
    if (text.length > 80) continue;
    return text;
  }
  return null;
}

function extractPercentText(root: ParentNode): string | null {
  const nodes = root.querySelectorAll<HTMLElement>('p, span, div');
  for (const node of nodes) {
    const percent = extractPercentToken(node.textContent);
    if (percent) return percent;
  }

  const rootPercent = extractPercentToken((root as HTMLElement).textContent ?? '');
  if (rootPercent) {
    return rootPercent;
  }

  const valueNowNodes = root.querySelectorAll<HTMLElement>('[aria-valuenow]');
  for (const node of valueNowNodes) {
    const raw = node.getAttribute('aria-valuenow');
    const percent = normalizePercent(raw);
    if (!percent) continue;
    return percent;
  }

  const widthNodes = root.querySelectorAll<HTMLElement>('[style*="width"]');
  for (const node of widthNodes) {
    const styleText = node.getAttribute('style') ?? '';
    const match = styleText.match(/width:\s*([0-9]+(?:\.[0-9]+)?)%/i);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < 0 || value > 100) continue;
    return `${match[1]}%`;
  }

  return null;
}

function findElementByExactText(root: ParentNode, text: string): HTMLElement | null {
  const target = normalizeText(text);
  if (!target) return null;

  const nodes = root.querySelectorAll<HTMLElement>('p, span, div, h1, h2, h3');
  for (const node of nodes) {
    if (normalizeText(node.textContent) === target) {
      return node;
    }
  }

  return null;
}

function findUsageRowFromLabel(label: HTMLElement): HTMLElement | null {
  const boundary = label.ownerDocument.body;
  let current: HTMLElement | null = label;

  while (current && current !== boundary) {
    const reset = extractResetText(current);
    const percent = extractPercentText(current);
    if (reset && percent) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function toDocumentOrder(rows: HTMLElement[]): HTMLElement[] {
  return [...rows].sort((a, b) => {
    if (a === b) return 0;
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

function hasProgressBar(root: ParentNode): boolean {
  const widthNodes = root.querySelectorAll<HTMLElement>('[style*="width"]');
  return Array.from(widthNodes).some((node) =>
    /width:\s*([0-9]+(?:\.[0-9]+)?)%/i.test(node.getAttribute('style') ?? '')
  );
}

function findUsageRowsByStructure(section: ParentNode): HTMLElement[] {
  const divs = Array.from(section.querySelectorAll<HTMLElement>('div'));
  const candidates = divs.filter((div) => !!extractPercentText(div) && hasProgressBar(div));

  const leafRows = candidates.filter((candidate) => {
    return !candidates.some((other) => other !== candidate && candidate.contains(other));
  });

  return toDocumentOrder(leafRows);
}

function getPrimaryUsageRows(doc: Document): HTMLElement[] {
  const sections = Array.from(doc.querySelectorAll<HTMLElement>('section')).filter(
    (section) => !section.matches(EXTRA_USAGE_SECTION_SELECTOR)
  );

  for (const section of sections) {
    const rows = findUsageRowsByStructure(section);
    if (rows.length >= 2) {
      return rows;
    }
  }

  return [];
}

function parseUsageSnapshotFromDocument(doc: Document): UsageSnapshot {
  const parsed: PartialUsageSnapshot = {
    sessionReset: null,
    sessionPercent: null,
    weeklyReset: null,
    weeklyPercent: null,
  };

  const sessionLabel = findElementByExactText(doc, 'Current session');
  if (sessionLabel) {
    const row = findUsageRowFromLabel(sessionLabel);
    if (row) {
      parsed.sessionReset = extractResetText(row);
      parsed.sessionPercent = extractPercentText(row);
    }
  }

  const weeklyLabel = findElementByExactText(doc, 'All models');
  if (weeklyLabel) {
    const row = findUsageRowFromLabel(weeklyLabel);
    if (row) {
      parsed.weeklyReset = extractResetText(row);
      parsed.weeklyPercent = extractPercentText(row);
    }
  }

  if (
    !parsed.sessionReset ||
    !parsed.sessionPercent ||
    !parsed.weeklyReset ||
    !parsed.weeklyPercent
  ) {
    const rows = getPrimaryUsageRows(doc);
    const sessionRow = rows[0] ?? null;
    const weeklyRow = rows[1] ?? null;

    if ((!parsed.sessionReset || !parsed.sessionPercent) && sessionRow) {
      parsed.sessionReset = parsed.sessionReset ?? extractResetText(sessionRow);
      parsed.sessionPercent = parsed.sessionPercent ?? extractPercentText(sessionRow);
    }

    if ((!parsed.weeklyReset || !parsed.weeklyPercent) && weeklyRow) {
      parsed.weeklyReset = parsed.weeklyReset ?? extractResetText(weeklyRow);
      parsed.weeklyPercent = parsed.weeklyPercent ?? extractPercentText(weeklyRow);
    }
  }

  return {
    sessionReset: normalizeReset(parsed.sessionReset, true) ?? DEFAULT_SNAPSHOT.sessionReset,
    sessionPercent: normalizePercent(parsed.sessionPercent) ?? DEFAULT_SNAPSHOT.sessionPercent,
    weeklyReset: normalizeReset(parsed.weeklyReset, false) ?? DEFAULT_SNAPSHOT.weeklyReset,
    weeklyPercent: normalizePercent(parsed.weeklyPercent) ?? DEFAULT_SNAPSHOT.weeklyPercent,
  };
}

function hasUsablePercent(snapshot: UsageSnapshot): boolean {
  return (
    snapshot.sessionPercent !== DEFAULT_SNAPSHOT.sessionPercent ||
    snapshot.weeklyPercent !== DEFAULT_SNAPSHOT.weeklyPercent
  );
}

function formatUsage(snapshot: UsageSnapshot): string {
  return `5h : ${snapshot.sessionReset} : ${snapshot.sessionPercent} / 1w : ${snapshot.weeklyReset} : ${snapshot.weeklyPercent}`;
}

function isVisible(element: HTMLElement): boolean {
  return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function pickTargetContainer(): HTMLElement | null {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>(CHAT_INPUT_CONTAINER_SELECTOR)
  );
  if (!containers.length) return null;

  const active = containers.filter((container) => {
    if (container.getAttribute('aria-hidden') === 'true') return false;
    if (!container.querySelector(CHAT_INPUT_SELECTOR)) return false;
    return isVisible(container);
  });

  if (active.length) {
    return active[active.length - 1];
  }

  const visible = containers.filter((container) => isVisible(container));
  if (visible.length) {
    return visible[visible.length - 1];
  }

  return containers[containers.length - 1];
}

export class UsageIndicator {
  private enabled = false;
  private indicatorElement: HTMLDivElement | null = null;
  private navigationHooked = false;
  private scanTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private refreshIntervalTimer: number | null = null;
  private sendRefreshTimer: number | null = null;
  private refreshing = false;
  private refreshQueued = false;

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    this.hookHistory();
    document.addEventListener('keydown', this.handleKeydown, true);
    document.addEventListener('click', this.handleClick, true);

    this.ensureAttached();
    this.scheduleScan();
    this.heartbeatTimer = window.setInterval(() => this.ensureAttached(), HEARTBEAT_INTERVAL_MS);
    this.refreshIntervalTimer = window.setInterval(() => {
      void this.refreshUsage();
    }, REFRESH_INTERVAL_MS);
    void this.refreshUsage();
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    document.removeEventListener('keydown', this.handleKeydown, true);
    document.removeEventListener('click', this.handleClick, true);

    if (this.scanTimer !== null) {
      window.clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.refreshIntervalTimer !== null) {
      window.clearInterval(this.refreshIntervalTimer);
      this.refreshIntervalTimer = null;
    }
    if (this.sendRefreshTimer !== null) {
      window.clearTimeout(this.sendRefreshTimer);
      this.sendRefreshTimer = null;
    }

    if (this.indicatorElement?.isConnected) {
      this.indicatorElement.remove();
    }
    this.indicatorElement = null;
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (event.repeat) return;
    if (event.key !== 'Enter') return;
    if (event.isComposing || event.keyCode === 229) return;
    if (event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(CHAT_INPUT_SELECTOR)) return;

    this.scheduleSendRefresh();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.enabled) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!button) return;
    if (!button.closest(CHAT_INPUT_CONTAINER_SELECTOR)) return;

    const type = (button.getAttribute('type') ?? '').toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') ?? '').toLowerCase();
    if (type !== 'submit' && !ariaLabel.includes('send')) return;

    this.scheduleSendRefresh();
  };

  private hookHistory(): void {
    if (this.navigationHooked) return;
    this.navigationHooked = true;

    const onNavigate = (): void => {
      this.scheduleScan();
      this.scheduleSendRefresh(800);
    };

    const originalPushState = history.pushState.bind(history);
    history.pushState = ((...args: Parameters<History['pushState']>) => {
      onNavigate();
      return originalPushState(...args);
    }) as History['pushState'];

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      onNavigate();
      return originalReplaceState(...args);
    }) as History['replaceState'];

    window.addEventListener('popstate', onNavigate);
  }

  private getOrCreateIndicator(): HTMLDivElement {
    const existing = Array.from(document.querySelectorAll<HTMLDivElement>(INDICATOR_SELECTOR));
    if (!this.indicatorElement || !document.contains(this.indicatorElement)) {
      this.indicatorElement = existing[0] ?? null;
    }

    for (let i = 1; i < existing.length; i += 1) {
      existing[i].remove();
    }

    if (!this.indicatorElement) {
      const element = document.createElement('div');
      element.setAttribute('data-cps-usage-indicator', 'true');
      element.className = 'cps-usage-indicator';
      element.textContent = formatUsage(DEFAULT_SNAPSHOT);
      this.indicatorElement = element;
    }

    return this.indicatorElement;
  }

  private ensureAttached(): void {
    if (!this.enabled) return;
    const container = pickTargetContainer();
    if (!container) return;

    const indicator = this.getOrCreateIndicator();
    if (indicator.parentElement !== container) {
      container.appendChild(indicator);
    } else if (container.lastElementChild !== indicator) {
      container.appendChild(indicator);
    }
  }

  private scheduleScan(retries = SCAN_RETRY_COUNT, interval = SCAN_INTERVAL_MS): void {
    if (!this.enabled) return;
    if (this.scanTimer !== null) {
      window.clearInterval(this.scanTimer);
    }

    let attempts = 0;
    this.scanTimer = window.setInterval(() => {
      if (!this.enabled) {
        if (this.scanTimer !== null) {
          window.clearInterval(this.scanTimer);
          this.scanTimer = null;
        }
        return;
      }

      this.ensureAttached();
      attempts += 1;
      if (attempts >= retries && this.scanTimer !== null) {
        window.clearInterval(this.scanTimer);
        this.scanTimer = null;
      }
    }, interval);
  }

  private scheduleSendRefresh(delay = SEND_REFRESH_DELAY_MS): void {
    if (!this.enabled) return;
    this.ensureAttached();

    if (this.sendRefreshTimer !== null) {
      window.clearTimeout(this.sendRefreshTimer);
    }
    this.sendRefreshTimer = window.setTimeout(() => {
      this.sendRefreshTimer = null;
      void this.refreshUsage();
    }, delay);
  }

  private async refreshUsage(): Promise<void> {
    if (!this.enabled) return;
    if (this.refreshing) {
      this.refreshQueued = true;
      return;
    }

    this.refreshing = true;
    try {
      const snapshot = await this.fetchSnapshot();
      this.render(snapshot);
    } catch {
      this.render(DEFAULT_SNAPSHOT);
    } finally {
      this.refreshing = false;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        void this.refreshUsage();
      }
    }
  }

  private async fetchSnapshot(): Promise<UsageSnapshot> {
    let fromFetch: UsageSnapshot | null = null;
    try {
      fromFetch = await this.fetchSnapshotFromHtml();
      if (hasUsablePercent(fromFetch)) {
        return fromFetch;
      }
    } catch {
      // Fallback to iframe strategy below.
    }

    const fromIframe = await this.fetchSnapshotFromIframe();
    if (hasUsablePercent(fromIframe)) {
      return fromIframe;
    }
    return fromFetch ?? fromIframe;
  }

  private async fetchSnapshotFromHtml(): Promise<UsageSnapshot> {
    const response = await fetch('/settings/usage', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch usage page: ${response.status}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return parseUsageSnapshotFromDocument(doc);
  }

  private async fetchSnapshotFromIframe(): Promise<UsageSnapshot> {
    return new Promise<UsageSnapshot>((resolve, reject) => {
      if (!document.body) {
        reject(new Error('Document body is not ready'));
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.src = '/settings/usage';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = '0';
      iframe.style.bottom = '0';
      iframe.style.right = '0';

      let pollTimer: number | null = null;
      let timeoutTimer: number | null = null;
      let settled = false;

      const finish = (result: UsageSnapshot | null, error: Error | null): void => {
        if (settled) return;
        settled = true;

        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
        if (timeoutTimer !== null) {
          window.clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }

        iframe.removeEventListener('load', onLoad);
        iframe.removeEventListener('error', onError);
        iframe.remove();

        if (result) {
          resolve(result);
          return;
        }
        reject(error ?? new Error('Unknown iframe parse error'));
      };

      const tryParse = (): void => {
        let doc: Document | null = null;
        try {
          doc = iframe.contentDocument;
        } catch {
          return;
        }
        if (!doc) return;

        const snapshot = parseUsageSnapshotFromDocument(doc);
        if (!hasUsablePercent(snapshot)) return;

        finish(snapshot, null);
      };

      const onLoad = (): void => {
        tryParse();
        pollTimer = window.setInterval(() => {
          tryParse();
        }, IFRAME_POLL_INTERVAL_MS);
      };

      const onError = (): void => {
        finish(null, new Error('Failed to load /settings/usage in iframe'));
      };

      timeoutTimer = window.setTimeout(() => {
        const doc = iframe.contentDocument;
        const snapshot = doc ? parseUsageSnapshotFromDocument(doc) : DEFAULT_SNAPSHOT;
        if (hasUsablePercent(snapshot)) {
          finish(snapshot, null);
          return;
        }
        finish(null, new Error('Timed out waiting for usage data in iframe'));
      }, IFRAME_FETCH_TIMEOUT_MS);

      iframe.addEventListener('load', onLoad);
      iframe.addEventListener('error', onError);
      document.body.appendChild(iframe);
    });
  }

  private render(snapshot: UsageSnapshot): void {
    this.ensureAttached();
    const indicator = this.getOrCreateIndicator();
    indicator.textContent = formatUsage(snapshot);
  }
}
