# 知行台

一个无需登录的个人学习、自测工作台，包含学习资料、模拟考试、错题复盘和成绩记录。

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
