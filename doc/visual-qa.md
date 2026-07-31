# Visual QA

## Evidence matrix

主验收 `platform-layout` 保留生产 guest-shell，仅由 QA harness 隐藏外部访客栏。

| State | 390×844 | 320×568 |
|---|---|---|
| 拱门庭院错误视角 | `_qa/ui/open-field-selected-entry-platform-layout-390x844.png` | `_qa/ui/open-field-selected-entry-platform-layout-320x568.png` |
| 水平多圈 + 高俯仰 | `_qa/ui/open-field-selected-free-orbit-platform-layout-390x844.png` | `_qa/ui/open-field-selected-free-orbit-platform-layout-320x568.png` |
| 01 Open Field | `_qa/ui/open-field-selected-level1-complete-platform-layout-390x844.png` | `_qa/ui/open-field-selected-level1-complete-platform-layout-320x568.png` |
| 02 Living Field | `_qa/ui/open-field-selected-level2-complete-platform-layout-390x844.png` | `_qa/ui/open-field-selected-level2-complete-platform-layout-320x568.png` |
| 03 Optical Identity | `_qa/ui/open-field-selected-level3-complete-platform-layout-390x844.png` | `_qa/ui/open-field-selected-level3-complete-platform-layout-320x568.png` |
| 错误恢复 | — | `_qa/ui/open-field-selected-error-platform-layout-320x568.png` |
| 外部访客栏发布检查 | `_qa/ui/open-field-selected-entry-external-guest-390x844.png` | — |

## 本轮发现与修复

### P0 — 核心玩法被改成物件收平

- **问题**：旧实现固定观察相机，让三个套准点推动 mesh 从 scatter 插值到平面 target，并淡出拱门/轨道。
- **影响**：玩家无法旋转场景，3D 结构在完成时消失，完全背离原参考的强制透视玩法。
- **修复**：删除 target/scatter 插值与三点路径。投影机、几何和纹理全程固定；单指只旋转观察相机，按角误差与保持时间过关。
- **复验**：三关均由真实 CDP `touchStart → touchMove ×18 → touchEnd` 完成；QA 断言 yaw 改变大于 `0.25 rad` 且完成误差小于 `0.035 rad`。

### P1 — 3D 场景退化成薄板

- **问题**：旧构图主要由少量 PlaneGeometry 竖条组成，球体、厚度、建筑轮廓和空间遮挡不足。
- **修复**：用 `12–36` 个大小悬殊、带厚度的矩形/三角 ExtrudeGeometry 覆盖版面，页面深度跨度提高到至少 `5`；再加入球体、圆环、圆柱/圆锥和多面体。
- **复验**：每关 `objectCount >= 20`，同时包含 ExtrudeGeometry、SphereGeometry 与 TorusGeometry。错误视角截图清楚显示断面、暗侧面与多层遮挡。

### P0 — 正确视角仍有缝隙、阴影，版式过于单调

- **问题**：旧页面只有用户名、圆环和三行短语；不同深度 Box 的投影边缘无法无缝覆盖，正确视角仍像有阴影的几块板。
- **修复**：承载体按 `(cameraRadius-z)/cameraRadius` 做透视补偿，并向质心外扩 3.5% 覆盖子像素缝；shader 新增 `resolve`，接近完成时取消 facing 明暗。页面最终收敛为超大 SVG 水印、用户名、矩形头像块、编号和一行微型说明。
- **复验**：六张正确视角证据均呈现连续矩形版式，没有发丝缝、模型阴影或字体变形；错误视角仍保留相同 mesh 的强烈空间破碎。

### P1 — 块尺寸和深度都过于平均

- **问题**：`4×6×2` 规则三角网格与连续 sin/cos 深度场让每个碎片承担相似视觉重量，复杂但缺少主次和极端事件。
- **修复**：改为确定性 BSP 不规则分割，以递归停止概率产生大中小块；深度改为中性聚集、中距过渡和三个极端锚点。最大块在不同关卡交替落到最前或最后。
- **复验**：QA 断言每关页面块 `12–36`、最大/最小面积比 `≥8`、`|Z|<0.5` 聚集比例 25–75%、页面深度跨度 `≥5`。两档错误视角均出现明确主导大块、细小碎片与突然的前后跳跃；正确视角仍无缝。

### P1 — 品牌版式复杂且照片 Logo 语义含混

- **问题**：刊头、hero、编辑主标题、双栏正文、色卡和页脚同时争夺注意力；第二关的大面积默认 U 头像又容易被误读成照片 Logo。
- **修复**：Logo 改为直接内联平台通用水印 SVG 的两条 path，删除正文、色卡与目录式信息。每关最多保留四类视觉角色；头像只作为边界明确的完整矩形窄带/横带，不抠图、不做圆形徽章。
- **复验**：01 以黑色水印与红竖栏建立尺度冲突；02 的水印占主体、头像缩到右侧 29%；03 用水印/头像横带/名字三段重量对撞。两档正确视角均能在第一眼识别水印主角。

### P1 — 视角范围过窄且磁吸降低难度

- **问题**：旧 yaw 被限制在目标 `±1.15 rad`，pitch 仅 `±0.58 rad`，高对齐区还会自动磁吸，玩家无需真正理解空间。
- **修复**：yaw 改为无边界累加，pitch 只保留 `±1.42 rad` 防穿心安全极限；删除磁吸，以最短圆周角计算任意圈数后的目标误差。
- **复验**：QA 先用真实触控让 yaw 变化超过 `4.5 rad`、pitch 超过 `0.75 rad`，再从自由视角完成三关。

### P1 — 手机视场裁切完整装置

- **问题**：观察相机沿用投影机 `24°` FOV；在 390×844/320×568 上完整 `2:3` 投影区域超出窄屏。
- **修复**：投影机继续固定 `24° / 2:3`，观察相机改为 `34°`。两者位置方向可重合，但玩家视野更宽。
- **复验**：正确视角能看到完整拱门/轨道与排版中心，`projectorAspect === textureAspect` 容差 `0.0001`，字体和圆环无非均匀拉伸。

### P0 — 扫描线、反字与背面投影

- **修复**：删除高频扫描线和二次 Y 翻转；加入 projector-facing mask；投影纸面不乘法线阴影。
- **复验**：两档手机三关正确视角中，用户名、`ULTRALONG` 与 `ALTERU` 均正向，侧面无镜像文字。

### P1 — 选定 Open Field 后，旧字体与色彩仍显得业余

- **问题**：产品实现仍使用 `Arial Black`、高饱和珊瑚/电蓝和三个互不成系列的版式，与选定的 03 稿不一致。
- **修复**：三关统一采用粉笔绿、矿物绿、铜色及 `Avenir Next / Helvetica Neue / PingFang SC`；Logo、元数据锚点和高留白成为系列不变量，头像参与和文字方向成为变量。
- **复验**：三张完成稿在缩略尺寸下仍可识别为同一系列，但分别呈现移动名字轴、头像横向场域与右下水印色块。

### P1 — 长混合用户名不适合固定竖排

- **问题**：首次 Open Field 截图中，短拉丁名规则被直接套到 `平台林思远ULTRALONG`，形成拥挤的混合竖向字柱。
- **修复**：仅 `1–12` 个拉丁字母、数字、空格、点号或连字符使用竖轴；中文、混合文字和长名字自动切为右侧横排块。
- **复验**：`390×844` 与 `320×568` 的 01 完成稿均显示正向、未拉伸的两行混合用户名，未碰撞水印和页面边界。

## 自动化与结论

- 390×844 与 320×568 三关真实触控全部通过。
- 无横向 DOM 溢出；长用户名身份来源为 `player`。
- 3D 景深、球体/拱门类型、对象数、投影比例和完成角误差均有机械断言。
- 完成前后场景不重建、不共面化、不淡出装饰；唯一变化是观察相机姿态。
- 视觉结论：Open Field 已在保持错误视角空间复杂度的同时，让三关正确视角形成统一、可扩展的平面设计系列；本轮无 P0/P1 遗留。

| Category | Score |
|---|---:|
| Hierarchy | 5 |
| Coherence | 5 |
| Readability | 4 |
| Game feel | 4 |
| Asset quality | 5 |
| Responsive UX | 4 |
| Polish | 4 |

平均 `4.43 / 5`；无类别低于 3。
