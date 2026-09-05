# 知行台

一个支持账号同步的多课程个人学习与自测工作台，当前包含中级经济师人力资源、经济学、英语和 PMP® 项目管理学习模块。手机与电脑使用同一账号时会看到同一份个人数据，但同一时刻只允许一台设备保持登录。

> 学习资料模块因原 PDF 水印与版权待核验已暂时关闭。页面入口、资料接口和附件直链都会被阻断；SQLite 与 MinIO 中的原数据仍保留，确认授权后可恢复。

## 开发

```bash
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:5173/study`。前端开发服务会把 `/api` 转发到本地 API。

## 校验与运行

```bash
npm run check
npm start
```

生产环境默认监听 `127.0.0.1:3000`。可通过 `.env.example` 中的环境变量调整。

学习工作台统一挂载在 `/study`。生产环境访问根地址时会跳转到 `/study`；旧版的考试、错题和成绩链接会跳转到对应的新地址。学习资料关闭期间，旧资料链接会跳回工作台。API 路径仍保持 `/api` 不变。

## 用户账号

用户名是全局唯一标识，不要求是手机号；登录和建号时会移除其中的空白字符，不做手机号格式校验。已有手机号账号和它原来的用户 ID 保持不变，仍可照常登录；新账号会使用独立的随机 UUID 作为内部用户 ID。当前不开放自助注册。

管理员登录后可进入 `/study/admin/users`，在同一页面完成：

- 新增账号并设置初始密码
- 分配“中级经济师·人力资源”“中级经济师·经济学”“英语”“PMP·项目管理专业人士”等可见课程
- 修改显示名称、重置密码、授予管理员权限或停用账号
- 删除尚无考试、课后题、听力或错题练习记录的账号

课程权限同时在页面路由和服务端接口校验；隐藏课程卡片并不是唯一防线。停用或重置密码会立即清除该账号的现有会话。已有学习记录的账号为保留成绩只能停用，不能永久删除；管理员不能停用、降权或删除自己，系统也不允许移除最后一个启用中的管理员。所有账号管理操作都会写入数据库审计记录，审计内容不包含明文密码。

从旧数据库升级时，所有已有账号保留原有三门课程，新增的 PMP 课程只自动分配给用户名为 `doudou` 的账号；创建时间最早的已有账号会成为首位管理员。全新空数据库的第一个命令行账号会自动成为管理员。

服务器应急维护也可以使用命令行：

```bash
npm run user:upsert -- \
  --username study01 \
  --display-name 学习者 \
  --modules human-resources,english \
  --admin false
```

`--modules none` 可创建暂未分配课程的账号；也可显式使用 `--modules human-resources,economics,english,pmp` 分配 PMP。省略 `--modules` 时，新建 `doudou` 默认获得四门课程，其他新账号默认只获得三门常规课程，已有账号则保留原分配。命令会在终端中隐藏密码输入。重复执行会重置该账号的昵称和密码，并使它已有的登录会话失效。不要把密码写入命令参数、代码、文档或 Git。

从旧版匿名设备迁移成绩时，使用旧设备 ID 精确接管尚未归属账号的记录：

```bash
npm run user:upsert -- \
  --username study01 \
  --display-name 学习者 \
  --adopt-device 00000000-0000-4000-8000-000000000000
```

密码以 scrypt 哈希保存，登录会话保存在 SQLite；浏览器只接收 `HttpOnly` 会话 Cookie。每个账号只保留一个有效会话：在新设备登录后，旧设备会在下一次请求时被要求重新登录。系统不依赖不稳定的浏览器指纹来“识别设备”，而是由服务端直接执行单会话约束。

每次登录还要完成一组简单的图片选择码，选择码 3 分钟有效、只能使用一次并绑定请求 IP。单个“IP + 用户名”连续 5 次密码错误会锁定 15 分钟，同一 IP 累计连续 20 次密码错误也会锁定 15 分钟；同一 IP 每 10 分钟最多获取 30 组选择码。成绩、错题和统计均由服务端当前会话绑定到用户，不再由浏览器设备标识决定归属。

## 管理员课后作业

`/study/admin/homework` 只对启用中的管理员开放。当前“精讲班 · 殷巧玲”课后作业已整理为 19 章、403 道在线题，点击章节后直接逐题作答，不再默认打开 PDF。每次提交都会立即显示正确答案和解析；答错会进入当前账号的错题本，并可沿用“错题重练—答对标记已重学—仍可继续重做”的流程。

课后作业是练习，不计算分数、不生成考试成绩，也不会出现在考试记录里。系统只保存每道题的逐次选择、正误和提交时间，用于章节进度与错题统计。第 9、14 章案例题所需的两张题面图通过管理员鉴权后的同源接口从私有 MinIO 读取；原始 PDF 仍作为来源存档保留，但页面不再把 PDF 作为作业入口。

需要从 19 份原始 PDF 重建结构化题库时，先安装内容构建依赖，再执行严格提取器：

```bash
python3 -m pip install -r scripts/requirements-content.txt
python3 scripts/build-admin-homework-questions.py \
  --source-dir '/你的文件路径/课后作业' \
  --output server/admin-homework-questions.json \
  --asset-output-dir imports/admin-homework-2026/question-assets
```

生成器会核对 19 个章节、403 道连续题号、选项、参考答案、解析、已确认的空白尾页和两张案例图的精确字节数与 SHA-256；遇到缺题或提取歧义时直接报错。生产环境同步 PDF 与题面图片：

```bash
docker compose run --rm app npm run homework:sync-admin -- \
  --source-dir /app/imports/admin-homework-2026
```

## PMP 学习模块

PMP 模块挂载在 `/study/modules/pmp`，当前包含 6 篇中文原创导学、3 套原创情境模拟短卷（每套 12 题、20 分钟）、官方考纲与官方样题入口，以及独立的成绩复盘。学习笔记与模拟题是本项目自行编写的内容；不复制、不导入来源不明的“真题”，PMI 公开样题仅通过官方页面链接访问。

当前考试信息以 [PMI PMP 认证页](https://www.pmi.org/certifications/project-management-pmp) 和 [2026 考试内容纲要](https://www.pmi.org/-/media/pmi/documents/public/pdf/certifications/new-pmp-examination-content-outline-2026.pdf) 为准。站内展示 2026 年 7 月新版的 180 题、240 分钟、人员 33% / 过程 41% / 业务环境 26%；70 分只是站内训练目标，不代表 PMI 公布的固定合格线。PMP 内容不受下方通用 PDF “学习资料”开关影响，但所有页面和 API 都必须先通过 PMP 课程权限校验。

## 录入内容

当前仍可整理和导入资料，但生产网站不会展示或下载这些资料。版权确认前请保持下列两个环境变量为 `false`：

```dotenv
VITE_MATERIALS_ENABLED=false
MATERIALS_ENABLED=false
```

恢复时需要把两项同时改为 `true` 并重新构建部署；只开启一项会造成前后端状态不一致。

复制并编辑 `data/content.example.json`，然后运行：

```bash
npm run import:data -- /你的文件路径/content.json
```

导入器会在事务中校验并写入资料、试卷和题目；任何格式错误都会中止整次导入。

仓库同时提供一套可直接导入的中级经济师人力资源管理体验内容：

```bash
npm run import:data -- data/hr-economist-sample.json
```

该体验卷包含 12 道单选、4 道多选和 4 道案例分析题。题目的 `type` 控制作答方式，`section: "case"` 与 `passage` 用于案例题。多选题全选正确得满分；没有错选但少选时，每个已选正确选项得 0.5 分；错选不得分。

“人力600母题”附件的当前版本实际收录 154 道题，可作为独立的「母题集锦」导入：

```bash
npm run import:data -- data/hr-600-master-collection.json
```

该数据集保留附件中的原题顺序、选项、参考答案和解析。答题接口不会提前返回答案；交卷后，成绩详情按第 1—154 题的顺序统一展示答案与解析。后续补齐其余题目时应创建新版本的试卷 ID，避免改写已有考试记录。

### 短卷系列

模拟考试页按系列展示短卷，每套最多 30 题、限时 25 分钟。当前 653 道题被均匀拆成 24 套，避免末卷只剩少量题：

- 历年真题系列：4 套，共 100 题
- 知识点强化系列：7 套，共 199 题
- 经典母题系列：7 套，共 200 题
- 母题集锦系列：6 套，共 154 题

重新生成、导入短卷并隐藏原长卷：

```bash
npm run exams:build-short-series
npm run import:data -- data/hr-short-exam-series-2026.json
npm run exams:archive-long
```

最后一步会先校验 24 套短卷的套数、题量和时长，校验成功后才把 4 套原长卷改为草稿。原长卷及其历史考试记录不会被删除。

### 2026 人力资源电子资料包

`scripts/build-electronic-study-pack.py` 可把“电子资料包”目录中的 11 份指定 PDF 整理为 11 条学习资料、11 个 PDF 附件和 3 套在线试卷，共 499 道题：

- 历年真题 100 题
- 知识点配题 199 题
- 经典母题 200 题

先安装内容构建工具，再从原始资料重新生成：

```bash
python3 -m pip install -r scripts/requirements-content.txt
python3 scripts/build-electronic-study-pack.py \
  --source-dir '/你的文件路径/电子资料包' \
  --bundle-dir imports/electronic-study-pack-2026 \
  --questions-output data/hr-electronic-study-pack-questions-2026.json
```

`data/hr-electronic-study-pack-questions-2026.json` 是纳入版本控制的在线题库。包含原始 PDF 的完整导入包位于 `imports/`，该目录不提交 Git；导入生产环境时使用：

```bash
docker compose exec app npm run import:data -- \
  /app/imports/electronic-study-pack-2026/content.json
```

生成器会严格核对文件名、题量、选项和答案并在异常时退出。其中历年真题第 85—88 题的原 PDF 缺少转移矩阵图，案例材料只补入从原文解析可逐项核对的数字摘要；经典母题第 34、74 题原文没有文字解析，平台会明确显示“原始资料未提供文字解析”，不生成虚构内容。

图片和附件由 MinIO 保存，SQLite 只保存文件元数据。需要导入附件时，在 JSON 顶层加入：

```json
{
  "assets": [
    {
      "id": "memory-map-cover",
      "materialId": "memory-map",
      "role": "cover",
      "title": "记忆地图封面",
      "source": "./files/memory-map.png"
    }
  ]
}
```

`source` 相对于 JSON 文件所在目录。MinIO 不公开管理端口，网站通过受控的 `/api/assets/:id` 接口读取文件。

## Docker 部署

```bash
cp .env.production.example .env
# 把 .env 中的两项 MinIO 凭据替换为随机强密码
mkdir -p imports
docker compose up -d --build
```

如果服务器无法访问 Docker Hub，可在 `.env` 中把 `NODE_IMAGE` 指向可用的可信镜像代理；默认值仍是官方 `node:22-bookworm-slim`。原生模块编译期间如无法访问 Debian 官方源，可通过 `DEBIAN_MIRROR` 和 `DEBIAN_SECURITY_MIRROR` 覆盖软件源；默认保持官方源。

应用公开宿主机 80 端口，SQLite 与 MinIO 数据分别保存在 Docker 命名卷中；MinIO 的 API 和管理界面不暴露到公网。

需要导入内容时，把 JSON 和它引用的文件放入 `imports/`，然后运行：

```bash
docker compose exec app npm run import:data -- /app/imports/content.json
```

MinIO 社区版目前已停止提供持续维护的预编译镜像，因此这里锁定到社区版最后阶段的镜像，并通过私有网络隔离。若网站未来面向不受信任的多用户或商业场景，应迁移到仍持续维护的 S3 兼容对象存储。
