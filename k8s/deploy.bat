@echo off
REM 瑞华 CMS Kubernetes 部署脚本 (Windows)

echo 🚀 开始部署瑞华 CMS 到 Kubernetes...

REM 检查 kubectl 是否可用
kubectl version --client >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ kubectl 未安装或不在 PATH 中
    exit /b 1
)

REM 检查集群连接
kubectl cluster-info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 无法连接到 Kubernetes 集群
    exit /b 1
)

echo ✅ Kubernetes 集群连接正常

REM 构建 Docker 镜像
echo 📦 构建 Docker 镜像...
docker build -t ruihua-cms:latest .

REM 如果使用 minikube，加载镜像到 minikube
minikube status >nul 2>&1
if %errorlevel% equ 0 (
    echo 📥 加载镜像到 minikube...
    minikube image load ruihua-cms:latest
)

REM 应用 Kubernetes 配置
echo 🔧 应用 Kubernetes 配置...

kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml

REM 等待 MongoDB 就绪
echo ⏳ 等待 MongoDB 启动...
kubectl wait --for=condition=ready pod -l app=mongodb --timeout=300s

REM 部署应用
kubectl apply -f k8s/app-deployment.yaml

REM 等待应用就绪
echo ⏳ 等待应用启动...
kubectl wait --for=condition=ready pod -l app=ruihua-cms-app --timeout=300s

echo ✅ 部署完成！

REM 显示服务状态
echo.
echo 📊 服务状态：
kubectl get pods,svc,ingress

echo.
echo 🌐 访问信息：
echo 如果使用 minikube，请运行以下命令获取访问地址：
echo minikube service ruihua-cms-service --url
echo.
echo 或者使用端口转发：
echo kubectl port-forward svc/ruihua-cms-service 3000:80
echo 然后访问: http://localhost:3000
echo.
echo 默认管理员账号: zhice / zhiceruihua123

pause