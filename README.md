# 知行台

一个无需登录的个人学习、自测工作台，包含学习资料、模拟考试、错题复盘和成绩记录。

## 开发

```bash
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:5173`。前端开发服务会把 `/api` 转发到本地 API。

## 校验与运行

```bash
npm run check
npm start
```

生产环境默认监听 `127.0.0.1:3000`。可通过 `.env.example` 中的环境变量调整。

## 录入内容

复制并编辑 `data/content.example.json`，然后运行：

```bash
npm run import:data -- /你的文件路径/content.json
```

导入器会在事务中校验并写入资料、试卷和题目；任何格式错误都会中止整次导入。

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

应用公开宿主机 80 端口，SQLite 与 MinIO 数据分别保存在 Docker 命名卷中；MinIO 的 API 和管理界面不暴露到公网。

需要导入内容时，把 JSON 和它引用的文件放入 `imports/`，然后运行：

```bash
docker compose exec app npm run import:data -- /app/imports/content.json
```

MinIO 社区版目前已停止提供持续维护的预编译镜像，因此这里锁定到社区版最后阶段的镜像，并通过私有网络隔离。若网站未来面向不受信任的多用户或商业场景，应迁移到仍持续维护的 S3 兼容对象存储。
