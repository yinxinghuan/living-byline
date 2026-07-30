# Technical

## 1. 技术栈

- Vite 6、TypeScript 5、Three.js 0.182，`base: './'`。
- 单个 WebGLRenderer、独立观察相机与投影相机、自定义 ShaderMaterial、原创程序几何。
- XHTML → SVG `foreignObject` → Canvas → `THREE.CanvasTexture` 生成身份排版。
- 原生 CSS、Pointer Events、Web Audio API、Aigram canonical bridge。

## 2. 目录结构

- `src/main.ts`：身份解析、三关产品状态、对齐 UI、完成流程和 QA hook。
- `src/engine/SceneDirector.ts`：固定场景、相机轨道、触控输入、角误差判定、RAF 与资源释放。
- `src/engine/IdentityTexture.ts`：每关 `用户名 × ALTERU` 排版纹理。
- `src/engine/ProjectedMaterial.ts`：世界坐标投影、正面裁切、无扫描线纸面与边缘光。
- `src/style.css`：HUD、对齐仪、幽灵手、完成/错误状态与窄屏适配。
- `src/i18n.ts`、`src/audio.ts`：双语文案与合成反馈音。
- `_qa/capture.mjs`：两档手机真实 CDP touch、三关过关、几何/景深/aspect 断言与截图。

## 3. 核心模块

### 固定投影与可旋转观察相机

投影机每关使用独立目标 `(yaw,pitch)`，半径 `11.5`、FOV `24°`、aspect `2/3`，其 projection/view matrix 写入 shader 后保持固定。观察相机使用相同轨道中心与半径、FOV `34°`，pointer delta 只更新观察姿态。投影机、root 几何和纹理在拖动及完成时均不改变。

### 对齐判定

`SceneDirector` 计算观察姿态与关卡目标姿态的欧氏角误差。误差映射为 `0–1` 对齐度并通过事件更新 DOM 仪表；松手进入 `0.13 rad` 后逐帧磁吸，低于 `0.032 rad` 持续 `380ms` 触发完成。完成时观察相机锁到目标，但所有 mesh 保留原 transform。

### 投影与场景

纹理固定为 `1024×1536`，DOM 页面由刊头、双色 hero、用户名、期号、编辑标题、双栏正文、色卡与页脚组成。shader 不翻转 Y；过程态用 facing mask 表现侧面，`resolve` 在对齐度 `0.72–0.98` 间把可见表面恢复为同一页面像素。

三关共同使用 48 个 ExtrudeGeometry 三角体覆盖 `3.3×4.95` 页面区域；每片根据深度按 `(11.5-z)/11.5` 做透视缩放，并以 3.5% 质心外扩消除子像素缝。三关深度场约为 `±1.62 / ±1.86 / ±2.05`，再叠加 Sphere/Torus/Cylinder/Cone/多面体。

### 性能、身份与恢复

DPR 在窄屏限制为 `1.25`，其他手机最多 `1.65`；IntersectionObserver 与 visibilitychange 暂停离屏 RAF。切关释放旧 geometry 与非共享 material。身份回退为 `?user_name=` → Aigram `data.name` → `data.user_name` → `AlterU`。初始化异常进入纯 DOM 错误态。

## 4. 扩展点

- **新增关卡**：在 `LEVEL_POSES` 增加目标/起始姿态，在 `buildLevel()` 注册新的固定几何构建器。
- **调手感**：修改 pointer 灵敏度、`0.13` 磁吸半径、`0.032` 锁定阈值与 `380ms` 保持时间。
- **换排版**：编辑 `IdentityTexture.markup()` 的 editions 数据与 editorial grid，保持 `1024×1536` 与无跨域像素依赖。
- **换材质/几何**：编辑 `buildDepthMosaic()` 的深度函数或三个 `build*()` 的空间物件；投影承载体继续使用共享 `projectedMaterial`。
- **改 shader**：编辑 `ProjectedMaterial.ts`，保持固定 projector matrix、正面 mask 与不翻转 Y 的合同。
- **改 UI/声音/平台**：分别编辑 `style.css`、`audio.ts`、`src/shared/runtime/bridge.ts`。
