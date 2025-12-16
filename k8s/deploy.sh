#!/bin/bash

# 瑞华 CMS Kubernetes 部署脚本

echo "🚀 开始部署瑞华 CMS 到 Kubernetes..."

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

# 构建 Docker 镜像
echo "📦 构建 Docker 镜像..."
docker build -t ruihua-cms:latest .

# 如果使用 minikube，加载镜像到 minikube
if command -v minikube &> /dev/null && minikube status &> /dev/null; then
    echo "📥 加载镜像到 minikube..."
    minikube image load ruihua-cms:latest
fi

# 应用 Kubernetes 配置
echo "🔧 应用 Kubernetes 配置..."

# 创建命名空间（可选）
# kubectl apply -f namespace.yaml

# 应用配置
kubectl apply -f configmap.yaml
kubectl apply -f mongodb-deployment.yaml

# 等待 MongoDB 就绪
echo "⏳ 等待 MongoDB 启动..."
kubectl wait --for=condition=ready pod -l app=mongodb --timeout=300s

# 部署应用
kubectl apply -f app-deployment.yaml

# 等待应用就绪
echo "⏳ 等待应用启动..."
kubectl wait --for=condition=ready pod -l app=ruihua-cms-app --timeout=300s

echo "✅ 部署完成！"

# 显示服务状态
echo ""
echo "📊 服务状态："
kubectl get pods,svc,ingress

echo ""
echo "🌐 访问信息："
echo "如果使用 minikube，请运行以下命令获取访问地址："
echo "minikube service ruihua-cms-service --url"
echo ""
echo "或者使用端口转发："
echo "kubectl port-forward svc/ruihua-cms-service 3000:80"
echo "然后访问: http://localhost:3000"
echo ""
echo "默认管理员账号: zhice / zhiceruihua123"