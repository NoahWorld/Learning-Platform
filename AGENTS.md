# 知行台工程规则

## 单一事实源

- 产品：使用预置账号登录的多模块个人学习与自测工作台；登录成功后先进入 `/study/modules` 选择学习模块。
- 页面文案：用户用于说明信息架构的词语（例如“模块”“四大板块”“以后新增其他学习类型”）属于开发需求，不得直接当作面向学习者的提示文案展示。界面应使用“课程”“今天学什么”“听 · 说 · 读 · 写”等自然、简洁的学习语言；尚未制作的内容只标记“内容准备中”或“即将开放”，不展示内部规划、数据隔离或后续扩展说明。
- 模块结构：模块选择页当前包含“中级经济师－人力资源”“中级经济师－经济学”“英语”三个大类。人力资源模块继续使用原 `/study`、考试、错题和成绩路由及现有数据；经济学和英语拥有独立模块首页，不得复用或展示人力资源数据。英语模块固定以 Listening/听、Speaking/说、Reading/读、Writing/写四板块扩展；当前 Listening/听已开放，目录路由为 `/study/modules/english/listening`，场景练习路由为 `/study/modules/english/listening/:sceneId`，“每日听闻”路由为 `/study/modules/english/listening/daily/:storyId`。听力模块只训练“听”，采用盲听、作答、提交后精析、正常或慢速复测的顺序，不得加入录音、麦克风、跟读或口语评分；发音参考保持折叠，并使用真人录制的完整记忆词组帮助辨音，不得让 Web Speech API 朗读孤立单词或把机器音作为兜底。场景对话、每日听闻与发音参考必须播放已同步到私有 MinIO 的真人 MP3；真人音频缺失、存储异常或播放失败时必须向用户显示明确错误，不得静默回退。新增学习类型时应扩展模块目录，而不是混入现有学科。模块选择页保持紧凑、可扩展的响应式网格：手机端使用双列卡片，桌面端根据可用宽度自动排布，不为最后一张卡片设置跨列特例。
- 前端：React、TypeScript、Vite；所有页面必须兼容手机和电脑。
- 服务端：Node.js、Fastify。
- 数据库：SQLite，默认文件为 `data/study-workbench.sqlite`。
- 对象存储：私有 MinIO；图片和资料附件存对象存储，SQLite 只保存元数据。
- 身份策略：用户名为不超过 64 个字符的全局唯一标识，登录和管理员建号时统一移除全部空白字符，不做手机号格式校验；历史手机号账号及其用户 ID 保持不变，新账号使用独立随机 UUID 作为用户 ID。只允许管理员通过 `/study/admin/users` 或管理命令创建账号，暂不开放自助注册。管理员可分配课程、重置密码、授予管理权限、停用账号，以及删除没有学习记录的账号；已有学习记录的账号只能停用，不能永久删除。
- 课程权限：`learning_modules` 是课程目录，`user_module_access` 是账号可见课程的唯一事实源。前端课程选择页必须按当前账号的 `moduleIds` 过滤，所有课程专属 API 和前端深层路由也必须独立校验权限，不能只依赖隐藏卡片。管理员页面仅限 `is_admin = 1` 且 `is_active = 1` 的账号进入；系统必须始终保留至少一个启用中的管理员，管理员不能停用、降权或删除自己。
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
- 同步 Everyday Conversations 真人音频：`npm run audio:sync-listening -- --source-dir <官方 MP3 所在目录>`
- 同步 Color Vowel Chart 真人发音：`npm run audio:sync-pronunciation -- --source-dir <官方 MP3 所在目录>`
- 从已下载的 VOA 原始 MP3 无损截取“每日听闻”片段：`npm run audio:build-daily`
- 校验并同步“每日听闻”真人音频：`npm run audio:sync-daily -- --source-dir <每日听闻 MP3 所在目录>`
- 重建短卷系列：`npm run exams:build-short-series`
- 确认短卷完整后隐藏原长卷：`npm run exams:archive-long`
- 重建 2026 电子资料包：`python3 scripts/build-electronic-study-pack.py --source-dir '<电子资料包目录>' --bundle-dir imports/electronic-study-pack-2026 --questions-output data/hr-electronic-study-pack-questions-2026.json`
- 日常账号配置：管理员登录后访问 `/study/admin/users`。
- 命令行创建或重置用户：`npm run user:upsert -- --username <用户名> --display-name <昵称> [--modules human-resources,economics,english|none] [--admin true|false]`
- 迁移旧设备成绩：在创建用户命令后追加 `--adopt-device <旧设备 ID>`；只能接管尚未归属账号的旧记录。

## 数据与接口约束

- 学习资料、试卷、题目、考试记录均以 SQLite 为权威数据源。
- 用户、会话、考试成绩和错题归属均以 SQLite 为权威数据源；前端不得使用设备标识或 `localStorage` 作为身份和成绩归属依据。
- 数据库结构当前为版本 9：`users.is_admin` 与 `users.is_active` 保存管理和启停状态，`learning_modules` 保存课程目录，`user_module_access` 保存课程分配，`admin_audit_log` 保存网页及命令行账号管理记录，`daily_listening_attempts` 保存按用户隔离的每日听闻提交记录。所有网页管理写操作必须写入操作者、目标账号、请求 ID、变更摘要和时间，不得记录明文密码。
- 英语听力场景内容以 `server/english-listening-content.mjs` 为单一事实源；首批内容固定使用美国国务院 American English 的 `Everyday Conversations` 中 `Around Town` 10 个官方真人对话，并为每条内容保留来源页、官方文件名、对象键和预期字节数。列表与练习详情接口不得提前返回原文、正确答案、解析、MinIO 对象键或官方 MP3 直链，只有完成全部题目并提交后才可返回原文与解析。真人 MP3 经登录鉴权的同源接口流式读取，必须支持 HTTP Range；公网不得直连 MinIO。每次练习写入 `listening_attempts` 并绑定当前会话用户，前端只展示该用户自己的练习次数、最近成绩与最好成绩。
- “每日听闻”内容以 `server/english-daily-listening-content.mjs` 为单一事实源；首条内容使用 VOA Learning English 自制、公有领域的 `Learning English with English Clubs` 真人原声片段，并保留来源页、署名、授权说明、原始音频地址、私有对象键、预期字节数和 SHA-256。每条内容固定提供短背景、五个关键词、一道主旨题和两道细节题；公开列表与详情不得提前返回字幕、正确答案、解析、MinIO 对象键、原始音频地址、字节数或哈希，完成全部题目并提交后才可返回逐句字幕和解析。每次提交写入 `daily_listening_attempts` 并绑定当前会话用户；音频经登录鉴权的同源接口从私有 MinIO 流式读取并支持 HTTP Range。不得收录带 AP、Reuters、AFP 等第三方版权标记的 VOA 页面内容。
- 英语真人发音参考以 `server/english-pronunciation-content.mjs` 为单一事实源，固定使用美国国务院 American English 的 `The Color Vowel Chart` 15 条原始真人 MP3，作者为 Karen Taylor、Shirley Thompson，许可为 CC BY-NC-ND 4.0。文件必须保持原样，并按清单中的字节数与 SHA-256 双重校验后同步至私有 MinIO；公开接口只返回音标、记忆词组、来源归属和同源音频地址，不得返回 MinIO 对象键或官方 MP3 直链。音频接口必须登录鉴权并支持 HTTP Range，不得使用 Web Speech API 或静默机器音兜底。
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
- 首次部署或音源更新时，把已按预期字节数校验的 10 条官方 MP3 放入只读挂载的 `/app/imports/english-listening-audio`，执行 `docker compose run --rm app npm run audio:sync-listening -- --source-dir /app/imports/english-listening-audio`；同步命令必须逐条回读 MinIO 对象大小并输出对象键、字节数和 SHA-256，随后验证登录鉴权与 Range 播放接口。
- 首次启用发音参考或音源更新时，把 15 条 `The Color Vowel Chart` 原始 MP3 放入只读挂载的 `/app/imports/color-vowel-audio`，执行 `docker compose run --rm app npm run audio:sync-pronunciation -- --source-dir /app/imports/color-vowel-audio`；同步命令必须校验字节数与清单 SHA-256、逐条回读 MinIO 对象大小，并验证登录鉴权与 Range 播放接口。
- 首次启用或更新“每日听闻”时，将已构建的片段放入只读挂载的 `/app/imports/daily-listening-audio`，执行 `docker compose run --rm app npm run audio:sync-daily -- --source-dir /app/imports/daily-listening-audio`；同步命令必须同时校验 MPEG 文件头、精确字节数与 SHA-256，回读 MinIO 对象大小，并验证登录鉴权与 Range 播放接口。
- 部署数据库迁移前必须创建 SQLite 备份；迁移到版本 8 时，所有已有账号默认获得当前三门课程，按 `created_at`、`id` 排序最早的已有账号成为首位管理员，以保持旧账号可继续使用；迁移到版本 9 时新增 `daily_listening_attempts`，不改动已有账号、考试、错题或场景听力记录。迁移后需核对用户数量、管理员数量、课程分配数量、账号成绩数量、听力记录数量和未归属旧记录数量。
- “人力600母题”当前附件实际只有 154 题，权威导入文件为 `data/hr-600-master-collection.json`，试卷 ID 为 `hr-600-master-collection-v1`；不得用虚构题目补足到 600。答案与解析仅在交卷后的成绩详情中展示。
- “2026 人力资源电子资料包”由 `scripts/build-electronic-study-pack.py` 从 11 份指定 PDF 生成；纳入版本控制的在线题库是 `data/hr-electronic-study-pack-questions-2026.json`，固定包含 100、199、200 题三套试卷，共 499 题。带 11 份原始 PDF 的生产导入包放在 `imports/electronic-study-pack-2026/`，`imports/` 不提交 Git。
- `scripts/build-short-exam-series.mjs` 从上述 499 题和当前 154 道母题生成 `data/hr-short-exam-series-2026.json`：历年真题 4 套、知识点强化 7 套、经典母题 7 套、母题集锦 6 套，共 24 套、653 题；拆分时不漏题、不重复题，单套最多 30 题且限时 25 分钟。
- 电子资料包的源异常必须保持可追溯：历年真题第 85—88 题原 PDF 缺少转移矩阵图，只允许使用从同份资料解析可核对的数字摘要；经典母题第 34、74 题没有文字解析，第 64 题的解析缺少“参考解析”标记。不得静默丢题、伪造解析或补造缺失图表。
