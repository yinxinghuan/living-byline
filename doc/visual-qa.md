# Visual QA

## Evidence matrix

Authoritative `platform-layout` evidence keeps the production guest-shell script loaded while the QA harness hides only `#alteru-guest-banner`.

| State | 390×844 | 320×568 |
|---|---|---|
| Entry + real ghost interaction | `_qa/ui/playability-recheck-entry-platform-layout-390x844.png` | `_qa/ui/playability-recheck-entry-platform-layout-320x568.png` |
| Level 1 complete | `_qa/ui/playability-recheck-level1-complete-platform-layout-390x844.png` | `_qa/ui/playability-recheck-level1-complete-platform-layout-320x568.png` |
| Fold Theatre | `_qa/ui/playability-recheck-level2-platform-layout-390x844.png` | `_qa/ui/playability-recheck-level2-platform-layout-320x568.png` |
| Final Orbit Press | `_qa/ui/playability-recheck-final-platform-layout-390x844.png` | `_qa/ui/playability-recheck-final-platform-layout-320x568.png` |
| Error / recovery | — | `_qa/ui/playability-recheck-error-platform-layout-320x568.png` |
| External guest shell | `_qa/ui/playability-recheck-entry-external-guest-390x844.png` | — |

Poster evidence: `public/poster-source.webp` at 1024×1024 and `_qa/ui/poster-thumbnail-160.png`.

## First-pass findings and fixes

### P0 — 3D 字钉与相机拖动争抢同一输入

- **Observation**：原版把轻触 3D 字钉、拖动相机和长按增强全部绑定到 Canvas；字钉视觉尺寸与 raycast 命中球不一致，玩家必须猜测落点，轻微移动又会取消激活。
- **Impact**：核心闭环虽然能被自动坐标脚本完成，真实玩家却无法建立稳定操作模型，游戏处于“可触发但不可玩”状态。
- **Fix**：移除装配阶段的 3D raycast 与长按。增加屏幕空间套准路径、三个 `62–68px` 编号节点和 `14px` 命中宽容；一根连续 touch 可按顺序穿过整条路径，也可逐点轻触。第三点完成后才开放 Canvas 相机拖动。
- **Recheck**：两档手机均通过 CDP `touchStart → touchMove × 20 → touchEnd` 的一根真实连续触控轨迹完成三关；无键盘或 QA hook 推进。

### P1 — 进度机关没有表达玩家正在做什么

- **Observation**：原版九次独立找点只让几何统一增加 `1/3` 对齐，节点之间没有方向关系，幽灵手演示的拖动与实际“点击”动作矛盾。
- **Impact**：玩家看得到效果，却不知道目标、顺序或动作为何产生结果。
- **Fix**：节点用 `1→2→3`、虚线路径和单一当前态建立顺序；已走路径变薄荷色，每次接触同帧触发节点压入、投影冲击、几何拉齐、升阶音和可选轻振。幽灵手改为沿同一真实路径移动。
- **Recheck**：首屏第一眼可读当前起点、三点顺序与完整手势；完成态路径淡出，底部提示切换为“拖动观看”。

### P2 — Fold Theatre resembled Threshold

- **Observation**：第一版第 2 关仍由大型纵向矩形印版主导，与门廊的剪影差异不足。
- **Impact**：三关虽然代码不同，但玩家在第一眼可能把第 2 关理解成换色/换位。
- **Fix**：改为八片横向手风琴折页、开放弧环和扁平底座，阅读方向从纵向切割变为横向折叠。
- **Recheck**：两档手机证据均出现明确的横向 S 形舞台，与门廊和轨道印刷机可在无标题时区分。

### P2 — Completion action label lost contrast

- **Observation**：390×844 完成面板的按钮文字继承了面板深色 span 规则，落在墨黑按钮上不可读。
- **Impact**：虽然箭头可见，重玩/下一关动作依赖猜测。
- **Fix**：`.lb-complete__action span` 明确继承按钮纸白前景色；320×568 仍按窄屏合同只显示可访问箭头。
- **Recheck**：390×844 显示 `PRINT AGAIN` / 本地化动作；320×568 保留 48×48 箭头目标。

## Interaction and resilience checks

- 两档手机均通过一根真实连续 touch 轨迹穿过三枚套准点，不用键盘或 QA hook 捷径。
- 装配时路径独占 pointer，不会误转相机；完成后单指拖动画面前后 Canvas 像素不同。
- 平台 bridge 模拟返回 18 字符长用户名与不同来源、无 CORS 的头像 URL；画面身份来源断言为 `player`，且没有把头像错误送入 Canvas。
- 无横向溢出。
- 纯 DOM 错误态在 320×568 可读，Retry 为 48px 高。
- external guest banner 可见且游戏仍可操作；主构图没有为它永久下移。
- UI strict audit：无功能 Emoji；自定义 inline SVG 体系一致。
- adaptation audit：`PASS 11 / RESULT pass`。

## Final score

| Category | Score / 5 | Evidence |
|---|---:|---|
| Hierarchy | 4.4 | 用户名、场景主体、三枚字钉和进度按顺序读取 |
| Coherence | 4.6 | 三关共享投影/印刷材质，同时保持不同空间剪影 |
| Readability | 4.2 | CJK/长用户名/英文动作与窄屏均通过 |
| Game feel | 4.6 | 连续划动、同帧节点压入/路径填充/几何套准、输入模式严格分离 |
| Asset quality | 4.5 | 原创程序几何与 Aigram raster 海报；无外部模型 |
| Responsive UX | 4.4 | 390×844、320×568、safe-area 与 external guest 双态 |
| Polish | 4.3 | 完成、错误、重玩和 reduced-motion 均有明确定义 |

平均分 `4.43/5`，无类别低于 3。2026-07-30 可玩性复审发现的 P0/P1 已通过连续触控重构关闭；首轮两个 P2 继续保持关闭。
