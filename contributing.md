# Contributing To Lichess-AutoPlayer

[中文文档](contributing.zh-cn.md) · [Project Guide](readme.md)

Exercise queued moves, cancellation and reset on the independent local practice page.

## Verification

```sh
npm --prefix website ci
npm --prefix website test
npm --prefix website run build
```

Include the commands and observed results in the pull request. Update both language guides when user-facing instructions change. Record unreleased changes in [the changelog](changelog.md).

[Report a bug](https://github.com/AMFI-Disable/Lichess-AutoPlayer/issues/new?title=%5BBUG%5D+&body=%23%23+Observed+%2F+%E5%AE%9E%E9%99%85%E7%BB%93%E6%9E%9C%0A%0A%0A%23%23+Expected+%2F+%E9%A2%84%E6%9C%9F%E7%BB%93%E6%9E%9C%0A%0A%0A%23%23+Steps+%2F+%E5%A4%8D%E7%8E%B0%E6%AD%A5%E9%AA%A4%0A%0A%0A%23%23+Environment+%2F+%E8%BF%90%E8%A1%8C%E7%8E%AF%E5%A2%83%0A%0A)
