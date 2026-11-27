# 参与 Lichess-AutoPlayer 开发

[English](contributing.md) · [项目指南](readme.zh-cn.md)

在独立的本地预走页面检查排队走子、取消预走及重置棋盘。

## 验证

```sh
npm --prefix website ci
npm --prefix website test
npm --prefix website run build
```

请在拉取请求中记录执行的命令与实际结果。面向用户的步骤发生变化时，同步更新两种语言的指南，并在[更新日志](changelog.md)中记录待发布的改动。

[报告问题](https://github.com/AMFI-Disable/Lichess-AutoPlayer/issues/new?title=%5BBUG%5D+&body=%23%23+Observed+%2F+%E5%AE%9E%E9%99%85%E7%BB%93%E6%9E%9C%0A%0A%0A%23%23+Expected+%2F+%E9%A2%84%E6%9C%9F%E7%BB%93%E6%9E%9C%0A%0A%0A%23%23+Steps+%2F+%E5%A4%8D%E7%8E%B0%E6%AD%A5%E9%AA%A4%0A%0A%0A%23%23+Environment+%2F+%E8%BF%90%E8%A1%8C%E7%8E%AF%E5%A2%83%0A%0A)
