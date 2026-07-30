# Visual QA

## Evidence matrix

主验收 `platform-layout` 保留生产 guest-shell，仅由 QA harness 隐藏外部访客栏。

| State | 390×844 | 320×568 |
|---|---|---|
| 拱门庭院错误视角 | `_qa/ui/camera-lock-rework-entry-platform-layout-390x844.png` | `_qa/ui/camera-lock-rework-entry-platform-layout-320x568.png` |
| 拱门庭院正确视角 | `_qa/ui/camera-lock-rework-level1-complete-platform-layout-390x844.png` | `_qa/ui/camera-lock-rework-level1-complete-platform-layout-320x568.png` |
| 折面剧场错误视角 | `_qa/ui/camera-lock-rework-level2-entry-platform-layout-390x844.png` | `_qa/ui/camera-lock-rework-level2-entry-platform-layout-320x568.png` |
| 折面剧场正确视角 | `_qa/ui/camera-lock-rework-level2-complete-platform-layout-390x844.png` | `_qa/ui/camera-lock-rework-level2-complete-platform-layout-320x568.png` |
| 轨道雕塑错误视角 | `_qa/ui/camera-lock-rework-level3-entry-platform-layout-390x844.png` | `_qa/ui/camera-lock-rework-level3-entry-platform-layout-320x568.png` |
| 轨道雕塑正确视角 | `_qa/ui/camera-lock-rework-level3-complete-platform-layout-390x844.png` | `_qa/ui/camera-lock-rework-level3-complete-platform-layout-320x568.png` |
| 错误恢复 | — | `_qa/ui/camera-lock-rework-error-platform-layout-320x568.png` |

## 本轮发现与修复

### P0 — 核心玩法被改成物件收平

- **问题**：旧实现固定观察相机，让三个套准点推动 mesh 从 scatter 插值到平面 target，并淡出拱门/轨道。
- **影响**：玩家无法旋转场景，3D 结构在完成时消失，完全背离原参考的强制透视玩法。
- **修复**：删除 target/scatter 插值与三点路径。投影机、几何和纹理全程固定；单指只旋转观察相机，按角误差与保持时间过关。
- **复验**：三关均由真实 CDP `touchStart → touchMove ×18 → touchEnd` 完成；QA 断言 yaw 改变大于 `0.25 rad` 且完成误差小于 `0.035 rad`。

### P1 — 3D 场景退化成薄板

- **问题**：旧构图主要由少量 PlaneGeometry 竖条组成，球体、厚度、建筑轮廓和空间遮挡不足。
- **修复**：三关分别引入 7 根厚柱/双拱/3 球、9 折面/锥柱/双球、20 单元/双环/中心轴；外部均保留双空间轨道。
- **复验**：每关 `depthSpread > 1.2`、`objectCount >= 12`，且同时包含 SphereGeometry 与 TorusGeometry。错误视角截图清楚显示侧面厚度与前后遮挡。

### P1 — 手机视场裁切完整装置

- **问题**：观察相机沿用投影机 `24°` FOV；在 390×844/320×568 上完整 `2:3` 投影区域超出窄屏。
- **修复**：投影机继续固定 `24° / 2:3`，观察相机改为 `34°`。两者位置方向可重合，但玩家视野更宽。
- **复验**：正确视角能看到完整拱门/轨道与排版中心，`projectorAspect === textureAspect` 容差 `0.0001`，字体和圆环无非均匀拉伸。

### P0 — 扫描线、反字与背面投影

- **修复**：删除高频扫描线和二次 Y 翻转；加入 projector-facing mask；投影纸面不乘法线阴影。
- **复验**：两档手机三关正确视角中，用户名、`ULTRALONG` 与 `ALTERU` 均正向，侧面无镜像文字。

## 自动化与结论

- 390×844 与 320×568 三关真实触控全部通过。
- 无横向 DOM 溢出；长用户名身份来源为 `player`。
- 3D 景深、球体/拱门类型、对象数、投影比例和完成角误差均有机械断言。
- 完成前后场景不重建、不共面化、不淡出装饰；唯一变化是观察相机姿态。
- 视觉结论：核心玩法与参考机制一致，三关剪影可区分，当前版本可发布。
