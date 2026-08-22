# 知行台工程规则

## 单一事实源

- 产品：使用预置账号登录的个人学习与自测工作台。
- 前端：React、TypeScript、Vite；所有页面必须兼容手机和电脑。
- 服务端：Node.js、Fastify。
- 数据库：SQLite，默认文件为 `data/study-workbench.sqlite`。
- 对象存储：私有 MinIO；图片和资料附件存对象存储，SQLite 只保存元数据。
- 身份策略：用户名为不超过 64 个字符的全局唯一标识，登录和管理员建号时统一移除全部空白字符，不做手机号格式校验；历史手机号账号及其用户 ID 保持不变，新账号使用独立随机 UUID 作为用户 ID。只允许管理员预置账号，暂不开放自助注册。
- 认证策略：密码只保存 scrypt 哈希和随机盐；登录必须通过 3 分钟内有效、只能使用一次且绑定请求 IP 的简单图片选择码。用户名与 IP 组合连续 5 次密码错误或同一 IP 连续 20 次密码错误后锁定 15 分钟；同一 IP 每 10 分钟最多获取 30 组图片选择码。每个用户只允许一个数据库会话，新登录会原子替换旧会话并使之前设备在下次请求时退出。登录后使用 `HttpOnly`、`SameSite=Lax` Cookie，前端不得保存明文密码或会话令牌。
- 学习资料状态：因原 PDF 水印与版权待核验，当前必须同时保持 `VITE_MATERIALS_ENABLED=false` 和 `MATERIALS_ENABLED=false`。前端不得显示资料导航或路由，服务端必须阻断资料列表、详情、附件接口和历史资料深链；SQLite 与 MinIO 原数据保留，版权确认前不得重新开放。
- 生产部署：阿里云 Ubuntu，Docker Engine + Compose；应用只公开宿主机 80 端口，MinIO 仅在 Compose 私有网络中提供服务。
- 公网页面统一挂载在 `/study`；根地址跳转到 `/study`，旧版考试、错题和成绩链接跳转到对应的 `/study/...` 地址；学习资料关闭期间，旧版和 `/study` 下的资料深链统一跳回 `/study`。API 与静态资源仍分别使用 `/api` 和 `/assets`。

## 常用命令

- 本地开发：`npm run dev`
- 构建：`npm run build`
- 测试：`npm test`
- 完整校验：`npm run check`
- 导入内容：`npm run import:data -- data/content.example.json`
- 重建短卷系列：`npm run exams:build-short-series`
- 确认短卷完整后隐藏原长卷：`npm run exams:archive-long`
- 重建 2026 电子资料包：`python3 scripts/build-electronic-study-pack.py --source-dir '<电子资料包目录>' --bundle-dir imports/electronic-study-pack-2026 --questions-output data/hr-electronic-study-pack-questions-2026.json`
- 创建或重置用户：`npm run user:upsert -- --username <用户名> --display-name <昵称>`
- 迁移旧设备成绩：在创建用户命令后追加 `--adopt-device <旧设备 ID>`；只能接管尚未归属账号的旧记录。

## 数据与接口约束

- 学习资料、试卷、题目、考试记录均以 SQLite 为权威数据源。
- 用户、会话、考试成绩和错题归属均以 SQLite 为权威数据源；前端不得使用设备标识或 `localStorage` 作为身份和成绩归属依据。
- 错题重练的每次提交写入 `mistake_practice_attempts`；只有完整答对才标记为“已重学”，该状态一旦获得便永久保留，但题目始终保留在错题本并允许继续重练。重练接口在提交前不得泄露正确答案和解析。
- `sessions.user_id` 必须保持唯一；数据库升级时只保留每个用户到期时间最晚的会话，任何登录成功都必须删除该用户旧会话后再写入新会话。
- 成绩和错题接口必须从当前有效会话取得 `user_id`，不得接受客户端传入用户名、用户 ID 或设备 ID 来决定数据归属。
- 旧版本匿名成绩保留原 `device_id` 且默认不归属任何用户；只能通过精确设备 ID 的管理命令显式迁移，禁止批量猜测归属。
- 考试详情接口不得泄露正确答案；仅提交后返回判题结果和解析。
- 大题库以 `series_id` 分组展示；公开练习卷应控制在每套最多 30 题、25 分钟。原长卷只能改为 `draft` 隐藏，不得删除，以保留历史成绩和答题明细的外键关系。
- 所有写接口必须校验输入，错误需返回明确上下文，不得静默吞掉。
- 图片选择码只向客户端返回随机选项 ID 与图像，正确答案只保存在服务端内存中；每次登录尝试后立即作废，不得复用。
- 数据库变更必须更新 `server/db.mjs` 中的迁移及本文件。
- 题目 `type` 决定作答方式（`single` / `multiple`），`section` 决定题面类别（`standard` / `case`）；案例题必须提供 `passage`。
- 多选题全选正确得题目满分；未错选但少选时，每个已选正确选项得 0.5 分；只要错选，该题得 0 分。案例多选题沿用同一规则。
- 成绩对试卷原始得分按百分制四舍五入；`passing_score` 始终使用百分制。
- 公网不得直接暴露 MinIO API 或管理控制台；学习资料关闭期间，附件应用接口也必须返回明确的 404，避免 PDF 直链绕过前端入口。

## 部署约束

- 应用目录：`/opt/learning-workbench`。
- 持久化数据：Compose 命名卷 `learning-workbench_app_data` 与 `learning-workbench_minio_data`。
- 启停命令：`docker compose up -d --build`、`docker compose down`。
- 生产密钥只保存在服务器的 `/opt/learning-workbench/.env`，不得提交 Git。
- Dockerfile 的 Node 基础镜像通过 `NODE_IMAGE` 构建参数覆盖；代码默认官方镜像，大陆部署可在服务器 `.env` 中指定可信代理。
- 学习资料开关分为前端构建参数 `VITE_MATERIALS_ENABLED` 和服务端运行参数 `MATERIALS_ENABLED`，两者必须同步设置；当前生产值均为 `false`。
- Debian 构建源可通过 `DEBIAN_MIRROR` 与 `DEBIAN_SECURITY_MIRROR` 覆盖；代码默认仍使用官方源。
- `better-sqlite3` 原生模块在 Docker 构建阶段使用 Python/make/g++ 编译；运行镜像只复制裁剪后的生产依赖，不携带编译工具链。
- 当前仅通过 HTTP/IP 提供服务，因此关闭 HSTS 与 CSP `upgrade-insecure-requests`；配置域名和 TLS 后必须同步恢复这两项。
- 部署后必须检查容器健康状态、`/api/health`、`/study`、`/study` 下的前端深层路由、根地址和旧链接跳转，以及容器日志。
- 部署数据库迁移前必须创建 SQLite 备份；迁移后需核对用户数量、账号成绩数量和未归属旧记录数量。
- “人力600母题”当前附件实际只有 154 题，权威导入文件为 `data/hr-600-master-collection.json`，试卷 ID 为 `hr-600-master-collection-v1`；不得用虚构题目补足到 600。答案与解析仅在交卷后的成绩详情中展示。
- “2026 人力资源电子资料包”由 `scripts/build-electronic-study-pack.py` 从 11 份指定 PDF 生成；纳入版本控制的在线题库是 `data/hr-electronic-study-pack-questions-2026.json`，固定包含 100、199、200 题三套试卷，共 499 题。带 11 份原始 PDF 的生产导入包放在 `imports/electronic-study-pack-2026/`，`imports/` 不提交 Git。
- `scripts/build-short-exam-series.mjs` 从上述 499 题和当前 154 道母题生成 `data/hr-short-exam-series-2026.json`：历年真题 4 套、知识点强化 7 套、经典母题 7 套、母题集锦 6 套，共 24 套、653 题；拆分时不漏题、不重复题，单套最多 30 题且限时 25 分钟。
- 电子资料包的源异常必须保持可追溯：历年真题第 85—88 题原 PDF 缺少转移矩阵图，只允许使用从同份资料解析可核对的数字摘要；经典母题第 34、74 题没有文字解析，第 64 题的解析缺少“参考解析”标记。不得静默丢题、伪造解析或补造缺失图表。
