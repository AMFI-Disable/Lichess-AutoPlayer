# Lichess-AutoPlayer 本地预走练习

[English](readme.md) · [参与贡献](contributing.zh-cn.md) · [打开练习棋盘](https://amfi-disable.github.io/Lichess-AutoPlayer/practice.html) · [更新日志](changelog.md) · [GPL-3.0 许可证](license)

在独立练习页面执白与本地电脑对手下棋。黑方思考时，先选白棋，再选目标格。棋盘会标出预走；黑方落子后，只有仍然合法的预走才会执行。重新选择可以替换预走，点击 **Cancel Premove** 可取消，重置棋盘可重新开局。

## 本地运行

```sh
npm --prefix website ci
npm --prefix website run dev
```

从本地首页打开 **Premove Practice**。使用 `npm --prefix website test` 检查练习逻辑，使用 `npm --prefix website run build` 检查生产构建。

## 公平竞赛

练习页独立于 Lichess 对局。仓库还包含引擎和实验性桌面组件。在 Lichess 使用程序下棋应遵守官方机器人账号和 Bot API 的要求；普通对局禁止程序代走、引擎建议或自动配对辅助。[公平竞赛规则](https://lichess.org/page/fair-play) · [安全政策](security.md)
