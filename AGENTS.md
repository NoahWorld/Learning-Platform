# 知行台工程规则

## 单一事实源

- 产品：无登录的个人学习与自测工作台。
- 前端：React、TypeScript、Vite；所有页面必须兼容手机和电脑。
- 服务端：Node.js、Fastify。
- 数据库：SQLite，默认文件为 `data/study-workbench.sqlite`。
- 对象存储：私有 MinIO；图片和资料附件存对象存储，SQLite 只保存元数据。
- 身份策略：浏览器生成匿名 `device_id`，只用于区分本机成绩与错题；不建立账号系统。
- 生产部署：阿里云 Ubuntu，Docker Engine + Compose；应用只公开宿主机 80 端口，MinIO 仅在 Compose 私有网络中提供服务。

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
- 公网不得直接暴露 MinIO API 或管理控制台；附件统一通过应用接口读取。

## 部署约束

- 应用目录：`/opt/learning-workbench`。
- 持久化数据：Compose 命名卷 `learning-workbench_app_data` 与 `learning-workbench_minio_data`。
- 启停命令：`docker compose up -d --build`、`docker compose down`。
- 生产密钥只保存在服务器的 `/opt/learning-workbench/.env`，不得提交 Git。
- 部署后必须检查容器健康状态、`/api/health`、首页、前端深层路由和容器日志。
