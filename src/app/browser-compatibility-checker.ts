import type { BrowserInfo } from '../shared/types/app';

export class BrowserCompatibilityChecker {
  checkBrowser(): BrowserInfo {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const info = this.parseUserAgent(ua);
    info.webgl2Supported = this.checkWebGL2();
    info.isSupported = info.webgl2Supported && this.isModernBrowser(info.name);
    return info;
  }

  checkWebGL2(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      return gl !== null;
    } catch {
      return false;
    }
  }

  isSupported(): boolean {
    const info = this.checkBrowser();
    return info.isSupported;
  }

  getUnsupportedMessage(): string {
    return 'This application requires a modern browser with WebGL 2.0 support. Please use Chrome, Firefox, or Edge.';
  }

  private parseUserAgent(ua: string): BrowserInfo {
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      return { name: 'Chrome', version: this.extractVersion(ua, 'Chrome/'), isSupported: true, webgl2Supported: false };
    }
    if (ua.includes('Firefox')) {
      return { name: 'Firefox', version: this.extractVersion(ua, 'Firefox/'), isSupported: true, webgl2Supported: false };
    }
    if (ua.includes('Edg')) {
      return { name: 'Edge', version: this.extractVersion(ua, 'Edg/'), isSupported: true, webgl2Supported: false };
    }
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      return { name: 'Safari', version: this.extractVersion(ua, 'Version/'), isSupported: true, webgl2Supported: false };
    }
    return { name: 'Unknown', version: '0', isSupported: false, webgl2Supported: false };
  }

  private extractVersion(ua: string, prefix: string): string {
    const idx = ua.indexOf(prefix);
    if (idx === -1) return '0';
    const sub = ua.substring(idx + prefix.length);
    const match = sub.match(/^(\d+)/);
    return match ? match[1] : '0';
  }

  private isModernBrowser(name: string): boolean {
    return ['Chrome', 'Firefox', 'Edge', 'Safari'].includes(name);
  }
}
