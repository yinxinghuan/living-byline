# Visual Bible

## 1. Visual thesis

- **Game and audience**：为 AlterU 手机信息流用户制作的 2–4 分钟身份视觉玩具。
- **Emotional promise**：看见自己的名字从平面资料变成一个可以触碰、穿行和收藏的空间。
- **One-sentence visual thesis**：一间黑暗的未来印刷室，用 HTML 排版光把 `用户名 × AlterU` 跨越碎裂几何重新印成完整署名。
- **Signature visual moment**：手指穿过最后一个套准点时，门廊、手风琴或轨道碎片从强烈纵深中准确收拢，装饰结构退场，只留下无阴影、无拉伸的 `2:3 用户名 × ALTERU` 平面印页。
- **Three required qualities**：排版是主角；投影断裂有真实空间深度；UI 像印刷机标记一样克制。
- **Three directions to avoid**：不复制参考的白底红卡；不做粒子姓名模板；不用泛化霓虹玻璃卡片堆。

## 2. Composition and camera

- **Orientation and aspect ratios**：竖屏，主验收 `390×844` 与 `320×568`；桌面居中适配但不模拟手机外框。
- **Camera and perspective**：显示相机固定为正面 `42°` 透视，主体位于画面中央 `18%–78%` 高度；投影相机固定 `24°`、`2:3` aspect。玩家改变纸片空间状态，不改变最终观看相机。
- **Playfield focal area**：中央 82% 宽度为几何与套准路径；三个大节点依关卡形成折线、V 形或拱形阅读路线。
- **Foreground / midground / background**：前景保持开放，不允许大型印版横穿遮挡；中景为投影主体，背景为消失于黑色的地平网格与低密度雾。
- **HUD safe areas**：顶部 `max(18px, env(safe-area-inset-top))` 起；底部操作距 home indicator 至少 `20px`。不为外部访客栏下移构图。
- **Attention path**：用户名 HUD → 编号 1 的发光套准点 → 路径连线 → 后续节点 → 终局署名。

## 3. Color

- **Ink / background**：`#07090D`、`#0D1118`。
- **Paper / text**：`#F3F0E8`、次级 `rgba(243,240,232,.62)`。
- **Coral projector**：`#FF5B4D`。
- **Electric blue projector**：`#4D7CFF`。
- **Reward mint**：`#A8FFD8`。
- **Warning / error**：`#FFB15A`，同时配图标和文字。
- **Usage ratios**：背景 72%、纸白 18%、珊瑚 6%、电蓝 3%、薄荷 1%。
- **Forbidden combinations**：不在同一小控件中叠加珊瑚与电蓝渐变；不以颜色单独表达字钉完成。

## 4. Typography

- **Display**：`Arial Black`, `Helvetica Neue`, `PingFang SC`, `Microsoft YaHei`, sans-serif；用户名使用 800–900 字重、紧缩字距。
- **UI/body**：`Inter`, `SF Pro Text`, `PingFang SC`, sans-serif。
- **Numeric/HUD**：`SFMono-Regular`, `Roboto Mono`, monospace。
- **Sizes**：用户名 `clamp(28px, 9vw, 52px)`；关卡名 `11px/700`；正文 `16px/1.45`；HUD 数字 `12px/700`。
- **Long names**：最多显示 18 个 Unicode 字符；纹理排版按 12/18/24 字符阈值分三档缩放，可分两行，不退回固定标题。

## 5. Shape, material, and lighting

- **Dominant shapes**：门廊使用六片纸页与三层透视套准框；折页剧场使用八片交替折叠纸页与双弧形导轨；轨道印刷机使用十二块 `3×4` 纸页碎片与三个空间轨道。所有文字承载片最终回到同一矩形平面。
- **Borders/shadows**：UI 使用 1px 纸白 18% 边框；不使用通用大圆角。3D 中间态允许深度遮挡，完成印页禁止模型阴影、环境暗角和法线明暗。
- **Materials**：未套准时为哑黑纸板；完成后正面成为干净的暖白编辑纸张，侧面与背面保持深色。禁止高频扫描条纹、CRT 纹理和摩尔纹。
- **Light**：左上冷白主光，右后珊瑚边光，关卡进度逐步加入电蓝投影；背景维持低照度。

## 6. Characters, environments, and assets

- 无角色、照片、模型或外部贴图。
- 所有场景几何在运行时原创生成；排版源是当前用户名、`ALTERU` 与本地化短句。
- 几何轮廓在 160px 缩略观看时仍需明确：门廊、扇形折页、轨道印刷机不可互换。
- 不引入参考项目的 `model.glb`、SVG 标志、字体文件或具体布局。

## 7. UI and icons

- **Icon family**：Material Symbols 24px 单色路径；触控演示使用 `touch_app`，下一关使用自绘右向箭头，重试使用同体系环形箭头。
- **Buttons**：最小 `48px` 高、44px 触控目标；主按钮纸白底/墨黑字，按下位移 2px；次按钮透明底/18% 边框。
- **HUD**：无浮动卡片，直接以细线、编号和小型印刷套准标记贴在画面边缘。
- **States**：加载为扫描线；当前套准点显示珊瑚脉冲和编号；按下缩进；完成节点变为薄荷实心印章；未到达节点保留低对比刻度；错误为暖橙图标+文字。
- **Emoji policy**：功能 UI 永不使用 Emoji。

## 8. Motion and VFX

- **Motion tokens**：即时 `90ms`、常规 `220ms`、定型 `520ms`、场景切换 `420/620ms`；缓动 `cubic-bezier(.2,.8,.2,1)`。
- **Input response**：同帧节点压入、路径填充、投影扫描与几何拉齐；`90ms` 达峰，`260ms` 回弹。
- **Reward**：关卡完成时只有一次套准环、几何对齐和和弦，不添加通用彩屑。
- **Ambient**：仅保留低速装饰框与轨道呼吸；不使用扫描线、投影漂移或完成态光照。
- **Reduced motion**：停止幽灵手、漂移和场景大位移；状态以 80ms 透明度与轮廓改变完成。

## 9. References translated into principles

- **Reference**：Cullen Webber 的 `three-html-to-canvas` 演示。
- **Useful principle**：网页排版作为纹理投射到跨深度几何时，平面设计会因相机运动变成空间事件。
- **Adaptation**：使用独立编写的 DOM→SVG→Canvas 纹理器、独立 shader patch 与原创程序几何；把滚动展示改为触摸恢复身份的三关闭环。
- **Element not to copy**：上游无许可证，因此不复制源码、`model.glb`、白底红卡、原始文案、品牌 SVG、镜头关键帧或具体几何构图。

## 10. Anti-patterns

- 禁止用用户名粒子云替代真实排版投影。
- 禁止把三个关卡仅做成同一场景换色。
- 禁止在投影材质中加入高频扫描线；手机缩放下会形成脏污与摩尔纹。
- 禁止把排版采样到背向投影机的表面；完成视角必须用不对称单词验证文字正向、直立。
- 禁止宽条几何互相穿插并遮掉主体排版；完成态首先是一张可读的编辑构图，其次才是空间分裂效果。
- 禁止让投影相机跟随手机 viewport aspect；DOM 纹理和 projector 必须共同保持 `2:3`，圆环必须仍为圆形，字体不得发生非均匀缩放。
- 禁止把折页或倾斜板作为完成 target；完成时所有文字承载片必须 `rotation=0`、Z 深度差接近零，装饰几何不可残留。
- 禁止通用玻璃拟态 HUD、大面积模糊和霓虹渐变。
- 禁止倒计时、生命值、随意得分或排行榜。
- 禁止为了外部访客栏永久下移标题、HUD、相机或主体。
- 禁止在生产 CSS 隐藏 `#alteru-guest-banner`。

## 11. Vertical-slice acceptance

- **Entry/start**：首屏在 JS 延迟时仍显示墨黑扫描面；首个有意义渲染帧后才交接 WebGL。
- **Gameplay**：第 1 关可用一根连续 touch 轨迹划过三个大节点，也可逐点轻触；装配阶段触控只服务路径，不误转相机；每次激活真实提高排版对齐度。
- **High-feedback moment**：第三个节点触发路径收束、几何与投影套准、分段振动与完成和弦，终态排版比过程态更完整。
- **Completion/end**：完成面板贴近底部，最终 `2:3` 平面印页保持正面、无阴影、不可拖动倾斜。
- **Narrow mobile**：`320×568` 下 HUD、3D 主体、底部提示与按钮互不覆盖。
- **Visual QA decision**：首轮实现后在真实运行截图中评分；任何 P0/P1 必须匹配重拍后关闭。
