# 瑞华 CMS 系统

## 环境配置

### 本地开发
1. 复制 `.env` 文件并根据需要修改配置
2. 安装依赖：`npm install`
3. 启动应用：`npm start`

### Docker 部署
1. 使用 docker-compose：`docker-compose up -d`
2. 访问应用：http://localhost:3000
3. 管理后台：http://localhost:3000/admin/index.html

## 配置文件说明

### 环境变量 (.env)
- `DB_HOST`: 数据库主机地址
- `DB_PORT`: 数据库端口
- `DB_NAME`: 数据库名称
- `MONGODB_URL`: 完整的 MongoDB 连接字符串
- `NODE_ENV`: 运行环境 (development/production)
- `PORT`: 应用端口
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD`: 管理员密码

### 数据库配置 (config/database.js)
支持不同环境的数据库配置，自动根据 NODE_ENV 选择对应配置。

## 默认账号
- 用户名: zhice
- 密码: zhiceruihua123

*注意：生产环境请务必修改默认密码*