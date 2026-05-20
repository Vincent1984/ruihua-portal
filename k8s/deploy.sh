#!/bin/bash

# 瑞华智策 Kubernetes 部署脚本

echo "🚀 开始部署瑞华智策应用到 Kubernetes..."

# 检查 kubectl 是否可用
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl 未安装或不在 PATH 中"
    exit 1
fi

# 检查集群连接
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 无法连接到 Kubernetes 集群"
    exit 1
fi

echo "✅ Kubernetes 集群连接正常"

# 使用远程镜像仓库的镜像
echo "📦 使用镜像: ruihua-imagerepo-cn-shanghai.cr.volces.com/ruihua/ruihuawebsite:latest"

# 应用 Kubernetes 配置
echo "🔧 应用 Kubernetes 配置..."

# 应用配置
echo "📝 应用 ConfigMap..."
kubectl apply -f k8s/configmap.yaml

echo "🗄️ 部署 MongoDB..."
kubectl apply -f k8s/mongodb-deployment.yaml

# 等待 MongoDB 就绪
echo "⏳ 等待 MongoDB 启动..."
kubectl wait --for=condition=ready pod -l app=mongodb --timeout=300s

if [ $? -eq 0 ]; then
    echo "✅ MongoDB 启动成功"
else
    echo "❌ MongoDB 启动超时"
    exit 1
fi

# 部署应用
echo "🚀 部署应用..."
kubectl apply -f k8s/app-deployment.yaml

# 等待应用就绪
echo "⏳ 等待应用启动..."
kubectl wait --for=condition=ready pod -l app=ruihuawebsite-app --timeout=300s

if [ $? -eq 0 ]; then
    echo "✅ 应用启动成功"
else
    echo "❌ 应用启动超时"
    kubectl get pods -l app=ruihuawebsite-app
    exit 1
fi

echo "🎉 部署完成！"

# 显示服务状态
echo ""
echo "📊 服务状态："
kubectl get pods,svc -l app=ruihuawebsite-app
kubectl get pods,svc -l app=mongodb

echo ""
echo "🌐 访问信息："
echo "使用端口转发访问应用："
echo "kubectl port-forward svc/ruihuawebsite-service 3000:80"
echo "然后访问: https://www.ruihuaconsulting.com (正式环境) 或 http://localhost:3000 (本地)"
echo ""
echo "管理后台: https://www.ruihuaconsulting.com/admin/index.html"
echo "默认管理员账号: zhice / zhiceruihua123"
echo ""
echo "查看应用日志:"
echo "kubectl logs -l app=ruihuawebsite-app -f"
echo ""
echo "查看 MongoDB 日志:"
echo "kubectl logs -l app=mongodb -f"