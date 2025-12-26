# Docker 配置更新说明

## 🔄 **更新内容**

### **1. Dockerfile 优化**
- ✅ 添加了系统依赖和时区设置
- ✅ 使用非 root 用户运行应用
- ✅ 添加健康检查
- ✅ 优化文件复制顺序
- ✅ 清理 npm 缓存

### **2. 依赖更新**
在 `package.json` 中添加了缺失的依赖：
- ✅ `axios`: 用于钉钉通知功能
- ✅ `dotenv`: 用于环境变量管理

### **3. Docker Compose 增强**
- ✅ 添加钉钉通知环境变量
- ✅ 添加健康检查配置
- ✅ 优化服务依赖关系

### **4. 新增文件**

#### **构建脚本**
- `docker-build.sh` - Linux/Mac 构建脚本
- `docker-build.bat` - Windows 构建脚本

#### **多阶段构建**
- `Dockerfile.multi-stage` - 优化的多阶段构建文件

#### **文档**
- `docs/docker-deployment.md` - 详细的部署指南

### **5. .dockerignore 优化**
排除了不必要的文件：
- 文档文件 (`docs/`, `*.md`)
- 开发配置 (`.vscode`, `.idea`)
- Kubernetes 配置 (`k8s/`)
- 环境变量文件 (`.env*`)

## 🚀 **使用方法**

### **快速启动**
```bash
# 使用 Docker Compose（推荐）
docker-compose up -d

# 查看状态
docker-compose ps
docker-compose logs -f app
```

### **手动构建**
```bash
# Linux/Mac
chmod +x docker-build.sh
./docker-build.sh

# Windows
docker-build.bat
```

### **环境变量配置**
更新 `docker-compose.yml` 中的环境变量：
```yaml
environment:
  - DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
  - DINGTALK_SECRET=YOUR_SECRET
  - ADMIN_USERNAME=your_username
  - ADMIN_PASSWORD=your_password
```

## 🔧 **新功能支持**

### **预约功能**
- ✅ 预约数据保存到 MongoDB
- ✅ 钉钉通知集成
- ✅ 管理后台预约管理

### **配置管理**
- ✅ 环境变量配置
- ✅ 数据库配置文件
- ✅ 钉钉通知配置

### **健康检查**
- ✅ 应用健康状态监控
- ✅ 数据库连接检查
- ✅ 自动重启机制

## 📊 **镜像信息**

### **基础镜像**
- `node:18-alpine` - 轻量级 Node.js 运行环境

### **镜像大小优化**
- 使用 Alpine Linux 减少镜像大小
- 多阶段构建进一步优化
- 清理不必要的文件和缓存

### **安全性**
- 非 root 用户运行
- 最小权限原则
- 敏感信息通过环境变量管理

## 🔍 **故障排查**

### **常用命令**
```bash
# 查看容器状态
docker ps

# 查看日志
docker-compose logs -f app

# 进入容器调试
docker exec -it ruihua-cms-app sh

# 检查健康状态
docker inspect ruihua-cms-app | grep Health -A 10
```

### **常见问题**
1. **端口冲突**: 修改 `docker-compose.yml` 中的端口映射
2. **数据库连接失败**: 检查 MongoDB 容器状态
3. **文件上传失败**: 检查 `public/uploads` 目录权限

## 📝 **下一步**

1. **配置钉钉通知**: 更新环境变量中的 Webhook URL 和密钥
2. **修改管理员密码**: 更新 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`
3. **生产环境部署**: 参考 `docs/docker-deployment.md`
4. **监控和日志**: 配置日志收集和监控系统

## 🎯 **验证步骤**

部署完成后，验证以下功能：
- [ ] 网站首页正常访问
- [ ] 管理后台登录正常
- [ ] 预约表单提交成功
- [ ] 预约数据保存到数据库
- [ ] 钉钉通知发送成功（如已配置）
- [ ] 管理后台预约管理功能正常