# 知行台

一个支持账号同步的个人学习、自测工作台，包含学习资料、模拟考试、错题复盘和成绩记录。手机与电脑登录同一账号后会看到同一份个人数据。

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

学习工作台统一挂载在 `/study`。生产环境访问根地址时会跳转到 `/study`；旧版的资料、考试、错题和成绩链接也会跳转到对应的新地址。API 路径仍保持 `/api` 不变。

## 用户账号

用户名必须是中国大陆 11 位手机号，且全局唯一；新建用户时手机号也作为用户 ID。当前不开放网页注册，账号由管理员在命令行预置：

```bash
npm run user:upsert -- --username 13000000000 --display-name 学习者
```

命令会在终端中隐藏密码输入。重复执行会重置该账号的昵称和密码，并使它已有的登录会话失效。不要把密码写入命令参数、代码、文档或 Git。

从旧版匿名设备迁移成绩时，使用旧设备 ID 精确接管尚未归属账号的记录：

```bash
npm run user:upsert -- \
  --username 13000000000 \
  --display-name 学习者 \
  --adopt-device 00000000-0000-4000-8000-000000000000
```

密码以 scrypt 哈希保存，登录会话保存在 SQLite；浏览器只接收 `HttpOnly` 会话 Cookie。成绩、错题和统计均由服务端当前会话绑定到用户，不再由浏览器设备标识决定归属。

## 录入内容

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
