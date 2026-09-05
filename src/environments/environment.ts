export const environment = {
  production: false,
  // Direct Django URL (most reliable). Proxy is also configured as backup.
  apiBaseUrl: 'http://192.168.88.53:8000/api/v1',
  appName: 'Bitech WiFi',
  defaultLocale: 'sw',
  paymentPollTimeoutMs: 3 * 60 * 1000,
  paymentPollIntervalMs: 2000,
};
