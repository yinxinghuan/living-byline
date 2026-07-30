# Technical

## 1. 技术栈

- **构建**：Vite 7，`base: './'`，TypeScript 5 严格模式。
- **渲染**：Three.js 0.182；单个 `WebGLRenderer`、透视相机、原创程序几何与自定义 `ShaderMaterial`。
- **排版纹理**：隐藏的 XHTML 字符串序列化为 SVG `foreignObject`，解码到 Canvas，再作为 `THREE.CanvasTexture` 上传；解码失败时使用纯 Canvas 文字回退。
- **平台**：复制项目 canonical Aigram bridge，通过 `callAigramAPI()` 请求当前玩家资料；读取 `data.name`，`data.user_name` 仅作兼容。
- **样式**：原生 CSS、`100dvh`、safe-area、双语排版和 `prefers-reduced-motion`。
- **音频**：Web Audio API 按用户手势创建振荡器，不使用外部音频文件。

## 2. 目录结构

- `index.html`：关键首屏、iOS 长按防护、远程 guest shell、永久游戏 UUID。
- `src/main.ts`：身份解析、UI 状态、三关流程、屏幕空间套准路径、键盘/按钮输入、首帧交接与 QA hook。
- `src/style.css`：完整视觉 token、HUD、SVG 套准路径与节点、幽灵手、完成/错误状态和窄屏适配。
- `src/i18n.ts`：`zh/en` 检测与全部 UI 文案。
- `src/audio.ts`：字钉、关卡完成与终局合成音。
- `src/engine/IdentityTexture.ts`：用户名与 `ALTERU` 的 HTML→SVG→Canvas 纹理生成及回退。
- `src/engine/ProjectedMaterial.ts`：世界空间投影坐标、CanvasTexture 方向、投影机正面裁切、边缘光与触点冲击 shader。
- `src/engine/SceneDirector.ts`：Three.js 生命周期、三个程序化 3D 中间态、平面 target、装饰退场、离屏暂停与资源释放。
- `src/shared/runtime/bridge.ts`：canonical Aigram 平台桥。
- `public/poster-source.webp`：Aigram transit 生成的 1024×1024 raster 海报源。
- `public/poster.png`：发布海报。
- `public/THIRD_PARTY_NOTICES.txt`：Three.js MIT 完整 notice。
- `_qa/capture.mjs`：双尺寸、平台身份、连续 CDP touch 路径、完成态共面/零旋转/aspect 断言、错误态与 external guest 自动验证。

## 3. 核心模块

### 状态与主循环

`main.ts` 维护 `level / pins / complete` 产品状态与当前 touch pointer；`SceneDirector` 维护高频相机、投影与几何对齐。RAF 不触发 DOM 重绘；只有关卡、套准点和完成状态更新 DOM。

### 投影纹理

`IdentityTexture.render(level)` 为每个场景生成不同排版。输入仅包含转义后的玩家名和固定平台名，不包含跨域照片，因此 SVG `foreignObject` 不需要读取外部资源。纹理尺寸固定为 `1024×1536`，CanvasTexture 使用 sRGB 与线性过滤。

`ProjectedMaterial` 接收独立投影相机的 projection/view matrix 与世界坐标位置，把世界坐标转换成纹理 UV。投影相机固定 `24°` 和 `1024/1536` aspect；显示相机独立跟随 viewport，因此字体与圆形不会随手机比例非均匀缩放。CanvasTexture 已按 DOM 图像约定上传，shader 不二次翻转 Y。采样强度乘以表面法线朝向投影机的 facing mask，且纸面颜色不乘法线光照；正面显示原始排版，侧面和背面回退到深色基础材质。

### 三个场景与闭环

- 门廊：六片纸页从三层透视套准框中的不同 Z 深度收拢。
- 折页剧场：八片纸页从交替 `±0.5 rad` 的手风琴折叠完全展开，双弧形导轨同步退场。
- 轨道印刷机：十二块 `3×4` 纸页碎片从三维椭圆轨道收拢，三个空间轨道同步退场。

每个文字片保存 target/scatter 两套位置和旋转。scatter 是关卡专属 3D 构图；target 一律位于 `3.2×4.8`、`Z=0.2` 的平面且旋转为零。第三点后 alignment 使用 `0.16` 阻尼并在 `>0.995` 时精确锁到 `1`，避免完成面板出现时仍残留折角和阴影。装饰对象按 `1 - alignment` 淡出并缩小。

### 输入与反馈

装配阶段由覆盖画布的 `.lb-route` 使用 Pointer Events 和 pointer capture 接管输入。三条路径以百分比坐标配置；每个节点直径 `68px`（窄屏 `62px`），命中检测额外外扩 `14px`。手指进入当前节点时立即推进，继续移动可在同一次手势中穿过后续节点；也可逐点轻触。

第三个节点完成后 `.lb-route` 淡出并关闭 pointer events，Canvas 保持固定正面构图，不再开放拖动倾斜。键盘 Enter 推进当前节点，终局 `R` 重开。

幽灵手是 Material `touch_app` 图形；沿第一关三点路径移动。出现时 `.lb-route.is-previewing` 与 `SceneDirector.setGhostPreview(true)` 会真实提升当前节点呼吸和投影扫描，不推进进度。

### 屏幕、性能与恢复

renderer DPR 在窄屏限制为 `1.3`，其他手机最多 `1.7`；几何总量低于 20 个 mesh。`IntersectionObserver` 低于 `0.08` 可见比例以及 `visibilitychange` 隐藏状态都会停止 RAF。场景切换释放旧 geometry 和非共享 material。

初始化异常或 `?qa_error=1` 进入纯 DOM 署名错误态。`foreignObject` 解码失败时不让场景空白，而是用 Canvas API 生成较简化的同身份纹理。

### 平台身份与本地化

回退顺序是 `?user_name=` → Aigram 当前玩家 `data.name` → `data.user_name` 兼容 → `AlterU`。平台外从不显示 GitHub 作者身份。最长取 18 个 Unicode 字符，纹理与 HUD 会按长度缩放或换行。所有 UI 文案通过 `i18n.ts`，使用 `localStorage.game_locale` 调试。

## 4. 扩展点

- **增加关卡**：在 `SceneDirector.buildLevel()` 注册新的原创几何构建器，并在 `i18n.ts` 增加关卡名与印章。
- **调整玩法数值**：在 `main.ts` 修改 `routes` 坐标、`14px` 命中宽容与完成延迟；在 `SceneDirector` 修改各关 scatter、alignment 阻尼和装饰退场；在 `requirements.md` 同步。
- **改变排版与平台短句**：编辑 `IdentityTexture.markup()`；不要加入无 CORS 的外部图片或 Web Font。
- **改变 shader**：编辑 `ProjectedMaterial.ts` 的世界投影、扫描、边缘光和位移；保持 projector matrix/UV 合同。
- **改变 UI / 响应式**：编辑 `style.css`；`platform-layout` 构图必须继续按无访客栏状态验收。
- **改变声音**：编辑 `audio.ts` 的频率、波形和 envelope；失败必须继续非阻塞。
- **改变平台资料接口**：只通过 `src/shared/runtime/bridge.ts` 的 canonical `callAigramAPI()` 调用，不自造 postMessage 协议。
- **发布资产**：同名覆盖 `public/poster.png` 与 games repo 的 `posters/living-byline.png`；更新 `doc/poster-provenance.md`。
