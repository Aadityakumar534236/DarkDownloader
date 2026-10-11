# Privacy

DarkDownloader does not implement accounts or a database in this release.

The browser may store:

- Theme preference.
- API base URL setting.
- Queue URLs so queued work can be submitted later.
- History with source hostname, provider key, status, and known byte counts. New history entries omit URL paths, query strings, and fragments.

Do not submit private or signed URLs. Passwords, cookies, access tokens, authorization headers, and downloaded media are not stored in history. Queue URLs remain in local storage until removed or cleared. Browser storage is not synchronized across devices and may be lost when cleared.
