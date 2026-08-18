# 知行台工程规则

## 单一事实源

- 产品：无登录的个人学习与自测工作台。
- 前端：React、TypeScript、Vite；所有页面必须兼容手机和电脑。
- 服务端：Node.js、Fastify。
- 数据库：SQLite，默认文件为 `data/study-workbench.sqlite`。
- 对象存储：私有 MinIO；图片和资料附件存对象存储，SQLite 只保存元数据。
- 身份策略：浏览器生成匿名 `device_id`，只用于区分本机成绩与错题；不建立账号系统。
- 生产部署：阿里云 Ubuntu，Docker Engine + Compose；应用只公开宿主机 80 端口，MinIO 仅在 Compose 私有网络中提供服务。
- 公网页面统一挂载在 `/study`；根地址跳转到 `/study`，旧版资料、考试、错题和成绩链接跳转到对应的 `/study/...` 地址；API 与静态资源仍分别使用 `/api` 和 `/assets`。

## 常用命令

- 本地开发：`npm run dev`
- 构建：`npm run build`
- 测试：`npm test`
- 完整校验：`npm run check`
- 导入内容：`npm run import:data -- data/content.example.json`

## 数据与接口约束

- 学习资料、试卷、题目、考试记录均以 SQLite 为权威数据源。
- 页面不得把 `localStorage` 当成绩、错题或内容的权威存储；它只保存匿名设备标识和界面偏好。
- 考试详情接口不得泄露正确答案；仅提交后返回判题结果和解析。
- 所有写接口必须校验输入，错误需返回明确上下文，不得静默吞掉。
- 数据库变更必须更新 `server/db.mjs` 中的迁移及本文件。
- 题目 `type` 决定作答方式（`single` / `multiple`），`section` 决定题面类别（`standard` / `case`）；案例题必须提供 `passage`。
- 多选题全选正确得题目满分；未错选但少选时，每个已选正确选项得 0.5 分；只要错选，该题得 0 分。案例多选题沿用同一规则。
- 成绩对试卷原始得分按百分制四舍五入；`passing_score` 始终使用百分制。
- 公网不得直接暴露 MinIO API 或管理控制台；附件统一通过应用接口读取。

## 部署约束

- 应用目录：`/opt/learning-workbench`。
- 持久化数据：Compose 命名卷 `learning-workbench_app_data` 与 `learning-workbench_minio_data`。
- 启停命令：`docker compose up -d --build`、`docker compose down`。
- 生产密钥只保存在服务器的 `/opt/learning-workbench/.env`，不得提交 Git。
- Dockerfile 的 Node 基础镜像通过 `NODE_IMAGE` 构建参数覆盖；代码默认官方镜像，大陆部署可在服务器 `.env` 中指定可信代理。
- Debian 构建源可通过 `DEBIAN_MIRROR` 与 `DEBIAN_SECURITY_MIRROR` 覆盖；代码默认仍使用官方源。
- `better-sqlite3` 原生模块在 Docker 构建阶段使用 Python/make/g++ 编译；运行镜像只复制裁剪后的生产依赖，不携带编译工具链。
- 当前仅通过 HTTP/IP 提供服务，因此关闭 HSTS 与 CSP `upgrade-insecure-requests`；配置域名和 TLS 后必须同步恢复这两项。
- 匿名设备 ID 优先使用 `crypto.randomUUID()`；HTTP 非安全上下文下使用 `crypto.getRandomValues()` 生成 RFC 4122 v4 UUID，不得降级到 `Math.random()`。
- 部署后必须检查容器健康状态、`/api/health`、`/study`、`/study` 下的前端深层路由、根地址和旧链接跳转，以及容器日志。
- “人力600母题”当前附件实际只有 154 题，权威导入文件为 `data/hr-600-master-collection.json`，试卷 ID 为 `hr-600-master-collection-v1`；不得用虚构题目补足到 600。答案与解析仅在交卷后的成绩详情中展示。
