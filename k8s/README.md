# 瑞华 CMS Kubernetes 部署

## 文件说明

- `configmap.yaml` - 应用配置信息（包含数据库连接和管理员账号）
- `mongodb-deployment.yaml` - MongoDB 数据库部署
- `app-deployment.yaml` - 应用服务部署
- `kustomization.yaml` - Kustomize 配置
- `deploy.sh` - 自动部署脚本（Linux/Mac）
- `deploy.bat` - 自动部署脚本（Windows）

## 快速部署

### 方法一：使用部署脚本
```bash
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

### 方法二：手动部署
```bash
# 1. 构建镜像
docker build -t ruihua-cms:latest .

# 2. 如果使用 minikube，加载镜像
minikube image load ruihua-cms:latest

# 3. 部署到 Kubernetes
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/app-deployment.yaml
```

### 方法三：使用 Kustomize
```bash
kubectl apply -k k8s/
```

## 配置说明

### ConfigMap 配置
- `DB_HOST`: MongoDB 服务地址
- `DB_PORT`: MongoDB 端口
- `DB_NAME`: 数据库名称
- `NODE_ENV`: 运行环境
- `PORT`: 应用端口
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD`: 管理员密码

### 存储配置
- MongoDB 数据存储: 5Gi PVC
- 文件上传存储: 2Gi PVC

### 资源配置
- MongoDB: 256Mi-512Mi 内存，250m-500m CPU
- 应用: 128Mi-256Mi 内存，100m-200m CPU

## 访问应用

### 本地开发（minikube）
```bash
# 获取服务访问地址
minikube service ruihua-cms-service --url

# 或者使用端口转发
kubectl port-forward svc/ruihua-cms-service 3000:80
```

### 生产环境
使用 LoadBalancer 或 NodePort 类型的 Service，或者配置 Ingress Controller。

## 管理命令

### 查看状态
```bash
kubectl get pods,svc,ingress
kubectl logs -l app=ruihua-cms-app
kubectl logs -l app=mongodb
```

### 扩缩容
```bash
kubectl scale deployment ruihua-cms-app --replicas=3
```

### 更新应用
```bash
# 构建新镜像
docker build -t ruihua-cms:v1.1 .

# 更新部署
kubectl set image deployment/ruihua-cms-app ruihua-cms-app=ruihua-cms:v1.1
```

### 删除部署
```bash
kubectl delete -f k8s/
```

## 故障排查

### 查看 Pod 状态
```bash
kubectl describe pod <pod-name>
```

### 查看日志
```bash
kubectl logs <pod-name> -f
```

### 进入容器
```bash
kubectl exec -it <pod-name> -- /bin/sh
```

### 检查配置
```bash
kubectl get configmap ruihua-cms-config -o yaml
```

## 注意事项

1. **镜像管理**: 确保 Docker 镜像已构建并可访问
2. **存储类**: 根据集群环境配置合适的 StorageClass
3. **网络策略**: 根据安全要求配置网络策略
4. **资源限制**: 根据实际负载调整资源配置
5. **备份策略**: 定期备份 MongoDB 数据
6. **监控告警**: 配置应用和数据库监控

## 生产环境建议

1. 使用 Helm Chart 管理部署
2. 配置 HPA（水平自动扩缩容）
3. 使用 StatefulSet 部署 MongoDB
4. 配置 TLS 证书
5. 设置资源配额和限制
6. 配置日志收集和监控