# Reusable effect capture

## Capability

- **Working name**：DOM projection surface
- **One-sentence visual result**：把真实 HTML/CSS 排版栅格化为 CanvasTexture，并用独立投影相机跨任意 Three.js 几何保持同一张世界空间排版。
- **Reuse verdict**：promote now
- **Example game**：Living Byline

## Upstream

- **Concept reference**：`three-html-to-canvas`
- **Author**：Cullen Webber
- **Demo**：https://cullenwebber.github.io/three-html-to-canvas/
- **Source inspected**：https://github.com/cullenwebber/three-html-to-canvas
- **Revision inspected**：`bad1a7c78c5b8761c95b9c4cbfcfed7f48c2d44d`
- **License**：上游仓库未声明许可证；不得复制或打包上游源码、`model.glb`、布局、品牌 SVG 或文案。
- **Independent implementation boundary**：本项目只采用通用 DOM/SVG/Canvas/WebGL 概念，算法表达、shader、几何、交互和回退均独立编写。
- **Distributed dependency**：Three.js 0.182.0，MIT；完整 notice 位于 `public/THIRD_PARTY_NOTICES.txt`。

## Rendering recipe

- **Engine and minimum versions**：Three.js 0.182；WebGL 2 优先，WebGL 1 可运行当前 GLSL。
- **Geometry/data representation**：任意带 position/normal 的 BufferGeometry；多 mesh 共享一个 ShaderMaterial 和投影 uniforms。
- **Simulation/update passes**：每帧仅更新投影增强、时间和可选几何位移；Canvas 纹理只在身份或场景文案变化时重绘。
- **Material/shader stages**：world position → projector projection/view → NDC/UV → frustum mask → CanvasTexture → base/lighting/edge mix。
- **Camera and lighting**：显示相机可自由移动；投影相机固定或独立移动，两者不应共用 matrix。
- **Post-processing**：无要求。
- **Defining constants**：纹理 `1024×1536`；projector FOV `39°`；DPR 上限 `1.3/1.7`；scan frequency `430`。

## Interaction hooks

- **Primary pointer input**：点击/拖动可改变 scene alignment、显示相机或 projector camera。
- **Secondary input**：长按可映射到 `boost`，双指可保留给自由相机或第二投影机。
- **Safe parameters**：reveal `0–1`、boost `0–1`、scan frequency `0–600`、accent color、projector FOV `28–58°`。
- **Destabilizing inputs**：投影相机 near/far 不覆盖 mesh、非 uniform scale 下错误 normal、未限制的超大纹理、每帧重新序列化 DOM。

## Performance envelope

- **Desktop tier**：`2048px` 纹理、DPR 2、复杂几何。
- **390×844 mobile tier**：`1024×1536` 纹理、DPR 1.7、约 20 mesh。
- **320×568 low tier**：同纹理、DPR 1.3、避免后处理。
- **GPU/feature requirements**：WebGL；Canvas 2D；SVG `foreignObject` 用于完整路径。
- **Offscreen pause strategy**：IntersectionObserver `0.08` + visibilitychange 停 RAF。
- **Tap-to-start requirement**：当前复杂度无需；大型模型或多投影机消费者应首触创建 renderer。
- **Memory/disposal**：切换身份时 dispose 旧 texture；切换场景 dispose geometry；共享 material 最后 dispose。

## Portability

- **Build/import requirements**：Vite `base: './'`；Three.js；无根绝对资源路径。
- **Runtime assets**：不需要；使用系统字体和内联 HTML。
- **Relative-path concerns**：若 HTML 包含图片，必须先绝对化且满足 Canvas 可读性；本能力默认禁止跨域图片。
- **Browser/Safari caveats**：`foreignObject` 对外部字体、图片、复杂定位和部分 Safari 版本敏感。
- **Fallback or skip condition**：同一身份内容应提供 Canvas 2D 简化回退；必须精确还原复杂 DOM 且目标浏览器不能解码时跳过。

## Failure ledger

- **Visual parity failures**：把 HTML 逐元素手绘成 Canvas 会丢失排版语法；只给每个物体独立贴同一张图会丢失跨表面的世界投影。
- **Touch conflicts**：直接操作 mesh 与显示相机必须以命中域、单/双指或时间阶段仲裁。
- **Aspect-ratio failures**：固定横屏 projector aspect 会在竖屏拉伸；resize 时必须更新 projector projection matrix。
- **Performance failures**：每帧 DOM→SVG→Canvas 会产生高 CPU、解码和纹理上传成本。
- **Misleading approximations**：把 DOM 盖在 canvas 上、把排版当 HUD、用静态图片贴图、复制未许可的参考模型。

## Skill boundary

- **Include in reusable skill**：DOM 栅格器最小接口、projector shader、resize matrix 合同、Canvas 回退、性能分档、Safari 与许可边界。
- **Keep in game-specific code**：Living Byline 标题、三个关卡、字钉、HUD、用户名文案、几何构图与完成状态。
- **Suggested skill name**：`dom-projection-surface`

