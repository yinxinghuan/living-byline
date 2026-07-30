# Technical

## 1. 技术栈

- Vite 6、TypeScript 5、Three.js 0.182，`base: './'`。
- 单个 WebGLRenderer、独立观察相机与投影相机、自定义 ShaderMaterial、原创程序几何。
- XHTML → SVG `foreignObject` → Canvas → `THREE.CanvasTexture` 生成身份排版。
- 原生 CSS、Pointer Events、Web Audio API、Aigram canonical bridge。

## 2. 目录结构

- `src/main.ts`：身份解析、三关产品状态、对齐 UI、完成流程和 QA hook。
- `src/engine/SceneDirector.ts`：固定场景、相机轨道、触控输入、角误差判定、RAF 与资源释放。
- `src/engine/IdentityTexture.ts`：官方水印 SVG、用户名与完整矩形头像块组成的三套极简排版纹理。
- `src/engine/ProjectedMaterial.ts`：世界坐标投影、正面裁切、无扫描线纸面与边缘光。
- `src/style.css`：HUD、对齐仪、幽灵手、完成/错误状态与窄屏适配。
- `src/i18n.ts`、`src/audio.ts`：双语文案与合成反馈音。
- `_qa/capture.mjs`：两档手机真实 CDP touch、三关过关、几何/景深/aspect 断言与截图。

## 3. 核心模块

### 固定投影与可旋转观察相机

投影机每关使用独立目标 `(yaw,pitch)`，半径 `11.5`、FOV `24°`、aspect `2/3`，其 projection/view matrix 写入 shader 后保持固定。观察相机使用相同轨道中心与半径、FOV `34°`，pointer delta 只更新观察姿态。投影机、root 几何和纹理在拖动及完成时均不改变。

### 对齐判定

`SceneDirector` 计算观察姿态与关卡目标姿态的角误差。yaw 无 clamp 并持续累加；误差通过 `atan2(sin Δ, cos Δ)` 归一为最短圆周角，使 `target + 2πn` 都是同一答案。pitch 只 clamp 到 `±1.42` 防止穿心。不使用磁吸；低于 `0.032 rad` 持续 `380ms` 触发完成。

### 投影与场景

纹理固定为 `1024×1536`。`alterULogo()` 直接内联平台通用水印 SVG 的两条原始 path，并按关卡注入黑/纸白填色；不读取 Logo 照片、不描摹位图。三套 DOM 版式只组合 SVG 水印、用户名、完整矩形头像块、关卡编号和一行微型说明，分别使用纯水印、右侧头像窄带、中部头像横带的关系。shader 不翻转 Y；过程态用 facing mask 表现侧面，`resolve` 在对齐度 `0.72–0.98` 间把可见表面恢复为同一页面像素。

`splitMosaicRect()` 以关卡种子执行 2–5 层非对称 BSP 分割，长宽比会影响切分方向，停止概率随深度从 `0.18` 升到 `0.72`。部分区域再沿对角线拆分，最终形成 `12–36` 个面积跨度至少 `8:1` 的 ExtrudeGeometry。

每片根据深度按 `(11.5-z)/11.5` 做透视缩放，并以 3.5% 质心外扩消除子像素缝。深度不是连续函数：约 58% 的普通片聚集到 `|Z|<0.41`，中距片落在约 `0.72–1.68`，最大、第二大和最小片被指定为 `|Z|>2.4` 的极端锚点。三关再叠加 Sphere/Torus/Cylinder/Cone/多面体。

### 性能、身份与恢复

DPR 在窄屏限制为 `1.25`，其他手机最多 `1.65`；IntersectionObserver 与 visibilitychange 暂停离屏 RAF。切关释放旧 geometry 与非共享 material。用户名回退为 `?user_name=` → Aigram `data.name` → `data.user_name` → `AlterU`。头像回退为 `?avatar_url=` → Aigram `head_url` → `public/alteru-default-avatar.jpg`；远程头像只有经 CORS fetch 转成 data URL 后才进入 WebGL Canvas。

## 4. 扩展点

- **新增关卡**：在 `LEVEL_POSES` 增加目标/起始姿态，在 `buildLevel()` 注册新的固定几何构建器。
- **调手感**：修改 pointer 灵敏度、pitch `±1.42` 极限、`0.032` 锁定阈值与 `380ms` 保持时间；yaw 保持无边界。
- **换排版**：编辑 `IdentityTexture.markup()` 的三套 composition，保持 `1024×1536`、水印 SVG path 真源与无跨域像素依赖。
- **换材质/几何**：编辑 `splitMosaicRect()` 的递归停止/切分比例、`buildDepthMosaic()` 的深度分档或三个 `build*()` 的空间物件；投影承载体继续使用共享 `projectedMaterial`。
- **改 shader**：编辑 `ProjectedMaterial.ts`，保持固定 projector matrix、正面 mask 与不翻转 Y 的合同。
- **改 UI/声音/平台**：分别编辑 `style.css`、`audio.ts`、`src/shared/runtime/bridge.ts`。
