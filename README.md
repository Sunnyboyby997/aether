# AETHER — WebGL 品牌单页 Demo

Lusion 风格（暗黑电影感 + WebGL 粒子流）的单页品牌站，用作面试作品展示。零构建、浏览器直接跑。

## 运行（任选其一）

**方式 A — VS Code Live Server**
装好 Live Server 插件 → 右键 `index.html` → `Open with Live Server`。

**方式 B — 命令行（用系统自带 Ruby，无需安装任何东西）**
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
| `main.js` | Three.js 粒子场景（自定义 GLSL 着色器）+ 滚动/鼠标交互 |
| `server.rb` | 零依赖本地服务器 |

## 自定义

- **文案**：直接改 `index.html` 里的文字（品牌名、标题、产品名等）
- **配色**：改 `main.js` 里的 `uColorA / uColorB / uColorC`（对应 蓝 → 青 → 暖橙）
- **粒子数量**：改 `main.js` 里的 `COUNT`（桌面 60000 / 移动 30000）
- **品牌字体**：改 `index.html` 的 Google Fonts 链接 + `style.css` 里的 `font-family`
