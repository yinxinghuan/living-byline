# Visual QA

## Evidence matrix

Authoritative `platform-layout` evidence keeps the production guest-shell script loaded while the QA harness hides only `#alteru-guest-banner`.

| State | 390×844 | 320×568 |
|---|---|---|
| Entry + real ghost interaction | `_qa/ui/visual-rework-entry-platform-layout-390x844.png` | `_qa/ui/visual-rework-entry-platform-layout-320x568.png` |
| Level 1 complete | `_qa/ui/visual-rework-level1-complete-platform-layout-390x844.png` | `_qa/ui/visual-rework-level1-complete-platform-layout-320x568.png` |
| Fold Theatre | `_qa/ui/visual-rework-level2-platform-layout-390x844.png` | `_qa/ui/visual-rework-level2-platform-layout-320x568.png` |
| Fold Theatre complete | `_qa/ui/visual-rework-level2-complete-platform-layout-390x844.png` | `_qa/ui/visual-rework-level2-complete-platform-layout-320x568.png` |
| Final Orbit Press | `_qa/ui/visual-rework-final-platform-layout-390x844.png` | `_qa/ui/visual-rework-final-platform-layout-320x568.png` |
| Error / recovery | — | `_qa/ui/visual-rework-error-platform-layout-320x568.png` |
| External guest shell | `_qa/ui/visual-rework-entry-external-guest-390x844.png` | — |

Poster evidence: `public/poster-source.webp` at 1024×1024 and `_qa/ui/poster-thumbnail-160.png`.

## First-pass findings and fixes

### P0 — 高频扫描线与错误纹理方向破坏了最终画面

- **Evidence**：2026-07-30 Aigram iPhone 实机截图 `6C6880BE-38FC-4256-B71D-E5498FDFC856_1_101_o.jpeg`。
- **Observation**：shader 主动叠加 `sin(uv.y * 430.0)` 高频扫描线；CanvasTexture 已执行 DOM 图像方向处理，材质又对 `uv.y` 二次翻转，导致文字倒置。投影同时落到背向投影机的表面，产生更多反字。
- **Impact**：完成态出现明显摩尔纹、脏污和无法阅读的署名，视觉效果本身不成立。
- **Fix**：删除扫描线；使用原始 projector NDC UV；新增 projector world position uniform，并以法线朝向投影机的 smoothstep mask 限制文字只出现在正面。同步修正 `dom-projection-surface` Skill 资产与验证合同。
- **Recheck**：三关完成证据中 `平台林思远 / ULTRALONG / × ALTERU` 均正向直立；侧面折痕维持深色或纯纸面，无镜像排版和高频横纹。

### P1 — 宽条几何穿插，完成态仍像随机遮挡

- **Evidence**：同一实机截图中的折页剧场完成态。
- **Observation**：八片横向宽条、圆环和底座互相穿插，遮住主体排版；完成后只减少散射，没有形成清楚轮廓。
- **Impact**：玩家无法把结果理解为“完成的署名雕塑”，画面显得廉价、混乱。
- **Fix**：门廊改为五片等宽竖版；折页剧场改为七片不重叠竖向手风琴；轨道印刷机改为正面编辑印版和后方细环。散射位移、旋转幅度减少约 55–65%，并把用户名移动到纹理中央焦点区。
- **Recheck**：第二关完成态呈现一张有折痕但连续可读的暖白编辑海报；终局正面印版保持完整，轨道元素不再横穿文字。

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
| Coherence | 4.7 | 三关共享干净纸面与正面投影合同，同时保持门、折页、轨道剪影 |
| Readability | 4.7 | CJK/长用户名正向直立；无扫描纹、镜像字、倒字或背面文字 |
| Game feel | 4.6 | 连续划动、同帧节点压入/路径填充/几何套准、输入模式严格分离 |
| Asset quality | 4.7 | 原创程序几何被收束为可读编辑雕塑；折页与轨道无随机穿插 |
| Responsive UX | 4.4 | 390×844、320×568、safe-area 与 external guest 双态 |
| Polish | 4.6 | 完成、错误、重玩、正面裁切与 reduced-motion 均有明确定义 |

平均分 `4.59/5`，无类别低于 3。2026-07-30 实机截图暴露的扫描线、反字和几何穿插 P0/P1 已通过匹配状态复拍关闭；可玩性复审与首轮 P2 继续保持关闭。
