# Docker 配置更新说明 - v2.0

## 🔄 **最新更新内容**

### **1. Dockerfile 全面优化**
- ✅ 升级到更安全的构建方式，使用 `npm ci` 替代 `npm install`
- ✅ 添加 curl 工具用于健康检查
- ✅ 创建专用的 nodejs 用户（UID: 1001）
- ✅ 复制所有必要的静态文件（HTML、admin、favicon等）
- ✅ 创建 authors 子目录用于用户头像上传
- ✅ 优化健康检查使用 curl 替代 node 脚本
- ✅ 增强安全性配置

### **2. Kubernetes 配置全面增强**

#### **ConfigMap 完善**
- ✅ 添加 JWT 密钥配置
- ✅ 添加 TLS 配置（开发环境）
- ✅ 完整的钉钉通知配置
- ✅ 短信服务完整配置

#### **Deployment 优化**
- ✅ 增加安全上下文配置（非 root 用户）
- ✅ 优化资源限制（内存：256Mi-512Mi，CPU：200m-500m）
- ✅ 完善健康检查配置（liveness、readiness、startup）
- ✅ 添加滚动更新策略
- ✅ 增加日志存储卷
- ✅ 添加版本标签和元数据

#### **存储优化**
- ✅ 增加日志存储卷（2Gi）
- ✅ 扩大上传存储卷到 5Gi
- ✅ 添加存储类配置

### **3. Docker Compose 增强**
- ✅ 添加完整的环境变量配置
- ✅ 使用 curl 进行健康检查
- ✅ 添加日志卷挂载
- ✅ 配置专用网络
- ✅ 添加 MongoDB 配置卷

## 🚀 **新功能完整支持**

### **预约管理系统**
- ✅ 预约提交和管理
- ✅ 短信验证码功能
- ✅ 钉钉通知集成
- ✅ UTM 参数跟踪
- ✅ CSV 导出功能

### **成熟度诊断系统**
- ✅ 在线诊断测试
- ✅ 结果分析和导出
- ✅ Excel/CSV 格式支持

### **白皮书下载管理**
- ✅ 下载申请管理
- ✅ 重复提交检测
- ✅ 数据导出功能

### **完整管理功能**
- ✅ 角色权限管理
- ✅ 操作日志记录
- ✅ 文件上传管理
- ✅ 用户头像上传

## 📋 **环境变量完整配置**

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| MONGODB_URL | MongoDB 连接字符串 | mongodb://mongodb:27017/ruihua_cms |
| DINGTALK_WEBHOOK_URL | 钉钉机器人 Webhook | https://oapi.dingtalk.com/robot/send?access_token=xxx |
| DINGTALK_SECRET | 钉钉机器人密钥 | SECxxx |
| SMS_API_URL | 短信服务 API | https://rcs.uninets.com.cn/uninetsOutInterface/domesticSmsSend |
| SMS_USERNAME | 短信服务用户名 | rrxt |
| SMS_PASSWORD | 短信服务密码 | Renrui123 |
| JWT_SECRET | JWT 签名密钥 | ruihua_secret_key_change_this_in_production |
| NODE_TLS_REJECT_UNAUTHORIZED | TLS 配置 | 0 |

## 🔧 **部署方式**

### **Docker Compose 部署（开发/测试）**
```bash
# 构建并启动服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

### **Kubernetes 部署（生产环境）**
```bash
# 应用配置
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/app-deployment.yaml

# 检查状态
kubectl get pods
kubectl get services
kubectl logs -f deployment/ruihua-cms-app
```

## 🔒 **安全注意事项**

1. **生产环境**：请更改默认的 JWT_SECRET
2. **数据库**：建议为 MongoDB 配置认证
3. **HTTPS**：生产环境应配置 SSL/TLS
4. **密钥管理**：敏感信息应使用 Kubernetes Secrets
5. **网络策略**：配置适当的网络访问控制

## 📊 **监控和日志**

- 应用日志存储在 `/app/logs` 目录
- 健康检查端点：`GET /`
- 上传文件存储在 `/app/public/uploads`
- 用户头像存储在 `/app/public/uploads/authors/{userId}`

## 🔍 **故障排除**

### **常见问题**
1. **MongoDB 连接失败**：检查 MONGODB_URL 配置
2. **钉钉通知失败**：验证 DINGTALK_WEBHOOK_URL 和 DINGTALK_SECRET
3. **短信发送失败**：检查 SMS 相关配置
4. **文件上传失败**：确认存储卷挂载正确

### **调试命令**
```bash
# 查看容器日志
docker logs ruihua-cms-app

# 进入容器调试
docker exec -it ruihua-cms-app sh

# 检查环境变量
docker exec ruihua-cms-app env | grep DINGTALK

# Kubernetes 调试
kubectl describe pod <pod-name>
kubectl exec -it <pod-name> -- sh
```

## 🎯 **功能验证清单**

部署完成后，验证以下功能：
- [ ] 网站首页正常访问 (http://localhost:3000)
- [ ] 管理后台登录正常 (/admin/index.html)
- [ ] 预约表单提交成功
- [ ] 短信验证码发送和验证
- [ ] 预约数据保存到数据库
- [ ] 钉钉通知发送成功
- [ ] 管理后台预约管理功能正常
- [ ] 成熟度诊断功能正常
- [ ] 白皮书下载功能正常
- [ ] 文件上传功能正常
- [ ] 数据导出功能正常

## 📈 **性能优化**

### **资源配置建议**
- **开发环境**: 1 CPU, 512MB 内存
- **测试环境**: 2 CPU, 1GB 内存  
- **生产环境**: 4 CPU, 2GB 内存

### **存储配置建议**
- **上传文件存储**: 5-10GB
- **日志存储**: 2-5GB
- **数据库存储**: 根据数据量调整

## 🔄 **版本历史**

- **v2.0**: 完整功能支持，K8s 配置优化，安全性增强
- **v1.0**: 基础 Docker 配置，预约功能支持