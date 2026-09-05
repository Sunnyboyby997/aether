# ZOUWENSHENG — 跨境商业品牌站 Demo

Lusion 风格（暗黑电影感 + WebGL 粒子流）的个人品牌单页，用作面试作品展示。内容为跨境商业：DTC 独立站 / 海外社媒 / 网红种草 / SEO·GEO / 联盟 Deals / AI 内容工作流。

## 运行（任选其一）

**方式 A — VS Code Live Server**
装好 Live Server 插件 → 右键 `index.html` → `Open with Live Server`。

**方式 B — 命令行（用系统自带 Ruby，无需安装）**
```bash
ruby server.rb
```
然后打开 http://localhost:8000

> 页面用 ES Module + import map 从 CDN 加载 Three.js，**必须通过 http 访问**（不能直接双击 `file://` 打开）。

## 结构

| 文件 | 作用 |
|---|---|
| `index.html` | 页面结构与文案 |
| `style.css` | 排版 / 布局 / 动效 |
| `main.js` | Three.js 粒子场景（自定义 GLSL 着色器）+ 鼠标跟随粒子群 + 滚动交互 |
| `server.rb` | 零依赖本地服务器 |

## 交互亮点

- 6 万粒子 **simplex 噪声流体运动**，滚动时镜头推进、粒子场旋转
- **鼠标跟随粒子群**（orbiting swarm）+ 主粒子场**随鼠标「拨开」**
- 配色随章节渐变（蓝 → 青 → 暖橙）、文字滚动淡入

## 自定义

- **文案**：直接改 `index.html`（品牌名、服务项、标语）
- **配色**：改 `main.js` 的 `uColorA / uColorB / uColorC`（蓝 → 青 → 暖橙）
- **粒子数量**：改 `main.js` 的 `COUNT`（桌面 60000 / 移动 30000）
- **鼠标粒子群**：改 `main.js` 的 `SWARM_COUNT / sRadii` 控制数量与扩散半径
