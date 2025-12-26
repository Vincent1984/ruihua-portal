# Docker 部署指南

## 概述

本项目支持多种 Docker 部署方式，包括单容器部署、Docker Compose 部署和 Kubernetes 部署。

## 快速开始

### 方法一：使用 Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd ruihua-cms

# 2. 配置环境变量（可选）
cp .env.production .env
# 编辑 .env 文件，配置钉钉通知等参数

# 3. 启动服务
docker-compose up -d

# 4. 查看状态
docker-compose ps
docker-compose logs -f app
```

### 方法二：使用构建脚本

```bash
# Linux/Mac
chmod +x docker-build.sh
./docker-build.sh

# Windows
docker-build.bat
```

### 方法三：手动构建和运行

```bash
# 1. 构建镜像
docker build -t ruihua-cms:latest .

# 2. 运行 MongoDB
docker run -d --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:6.0

# 3. 运行应用
docker run -d --name ruihua-cms-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URL=mongodb://host.docker.internal:27017/ruihua_cms \
  -v $(pwd)/public/uploads:/app/public/uploads \
  ruihua-cms:latest
```

## 环境变量配置

### 必需的环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 应用端口 | `3000` |
| `MONGODB_URL` | MongoDB 连接字符串 | `mongodb://localhost:27017/ruihua_cms` |

### 可选的环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `ADMIN_USERNAME` | 管理员用户名 | `zhice` |
| `ADMIN_PASSWORD` | 管理员密码 | `zhiceruihua123` |
| `DINGTALK_WEBHOOK_URL` | 钉钉机器人 Webhook | - |
| `DINGTALK_SECRET` | 钉钉机器人密钥 | - |

### 环境变量配置方式

#### 1. 通过 .env 文件
```bash
# .env
NODE_ENV=production
MONGODB_URL=mongodb://mongodb:27017/ruihua_cms
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=SECxxx
```

#### 2. 通过 docker-compose.yml
```yaml
environment:
  - NODE_ENV=production
  - MONGODB_URL=mongodb://mongodb:27017/ruihua_cms
  - ADMIN_USERNAME=admin
  - ADMIN_PASSWORD=your-secure-password
```

#### 3. 通过命令行参数
```bash
docker run -e NODE_ENV=production -e MONGODB_URL=... ruihua-cms:latest
```

## 数据持久化

### 文件上传
```bash
# 挂载上传目录
-v $(pwd)/public/uploads:/app/public/uploads
```

### MongoDB 数据
```bash
# 使用 Docker Volume
-v mongodb_data:/data/db

# 或使用本地目录
-v $(pwd)/data/mongodb:/data/db
```

## 健康检查

应用包含内置的健康检查：

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"
```

检查健康状态：
```bash
docker ps  # 查看 STATUS 列
docker inspect ruihua-cms-app | grep Health -A 10
```

## 日志管理

### 查看日志
```bash
# Docker Compose
docker-compose logs -f app
docker-compose logs -f mongodb

# 单容器
docker logs -f ruihua-cms-app
docker logs -f mongodb
```

### 日志轮转
```yaml
# docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 性能优化

### 1. 多阶段构建
使用 `Dockerfile.multi-stage` 进行优化构建：

```bash
docker build -f Dockerfile.multi-stage -t ruihua-cms:optimized .
```

### 2. 资源限制
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### 3. 缓存优化
```bash
# 使用 BuildKit 进行构建
DOCKER_BUILDKIT=1 docker build -t ruihua-cms:latest .
```

## 安全配置

### 1. 非 root 用户
Dockerfile 已配置使用 `node` 用户运行应用。

### 2. 敏感信息管理
```bash
# 使用 Docker Secrets（Swarm 模式）
echo "your-secret-password" | docker secret create admin_password -

# 在 docker-compose.yml 中引用
secrets:
  - admin_password
```

### 3. 网络隔离
```yaml
# docker-compose.yml
networks:
  app-network:
    driver: bridge

services:
  app:
    networks:
      - app-network
```

## 监控和维护

### 1. 容器监控
```bash
# 查看资源使用情况
docker stats ruihua-cms-app

# 查看容器详细信息
docker inspect ruihua-cms-app
```

### 2. 备份和恢复
```bash
# 备份 MongoDB 数据
docker exec mongodb mongodump --out /backup
docker cp mongodb:/backup ./backup

# 恢复数据
docker cp ./backup mongodb:/backup
docker exec mongodb mongorestore /backup
```

### 3. 更新部署
```bash
# 1. 构建新镜像
docker build -t ruihua-cms:v2.0 .

# 2. 更新 docker-compose.yml 中的镜像标签
# 3. 重新部署
docker-compose up -d
```

## 故障排查

### 常见问题

1. **应用无法连接数据库**
   ```bash
   # 检查网络连接
   docker network ls
   docker network inspect <network_name>
   
   # 检查 MongoDB 状态
   docker logs mongodb
   ```

2. **文件上传失败**
   ```bash
   # 检查目录权限
   docker exec ruihua-cms-app ls -la public/
   
   # 检查挂载
   docker inspect ruihua-cms-app | grep Mounts -A 10
   ```

3. **内存不足**
   ```bash
   # 增加内存限制
   docker update --memory=1g ruihua-cms-app
   ```

### 调试模式
```bash
# 以调试模式运行
docker run -it --rm \
  -e NODE_ENV=development \
  -e DEBUG=* \
  ruihua-cms:latest
```

## 生产环境建议

1. **使用具体的镜像标签**而不是 `latest`
2. **配置日志轮转**避免磁盘空间不足
3. **设置资源限制**防止容器占用过多资源
4. **定期备份数据**
5. **监控容器健康状态**
6. **使用 HTTPS**和反向代理
7. **定期更新基础镜像**修复安全漏洞