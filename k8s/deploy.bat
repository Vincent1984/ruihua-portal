@echo off
REM 瑞华智策 Kubernetes 部署脚本 (Windows)

echo 🚀 开始部署瑞华智策应用到 Kubernetes...

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

REM 使用远程镜像仓库的镜像
echo 📦 使用镜像: ruihua-imagerepo-cn-shanghai.cr.volces.com/ruihua/ruihuawebsite:latest

REM 应用 Kubernetes 配置
echo 🔧 应用 Kubernetes 配置...

echo 📝 应用 ConfigMap...
kubectl apply -f configmap.yaml

echo 🗄️ 部署 MongoDB...
kubectl apply -f mongodb-deployment.yaml

REM 等待 MongoDB 就绪
echo ⏳ 等待 MongoDB 启动...
kubectl wait --for=condition=ready pod -l app=mongodb --timeout=300s

if %errorlevel% equ 0 (
    echo ✅ MongoDB 启动成功
) else (
    echo ❌ MongoDB 启动超时
    exit /b 1
)

REM 部署应用
echo 🚀 部署应用...
kubectl apply -f app-deployment.yaml

REM 等待应用就绪
echo ⏳ 等待应用启动...
kubectl wait --for=condition=ready pod -l app=ruihuawebsite-app --timeout=300s

if %errorlevel% equ 0 (
    echo ✅ 应用启动成功
) else (
    echo ❌ 应用启动超时
    kubectl get pods -l app=ruihuawebsite-app
    exit /b 1
)

echo 🎉 部署完成！

REM 显示服务状态
echo.
echo 📊 服务状态：
kubectl get pods,svc -l app=ruihuawebsite-app
kubectl get pods,svc -l app=mongodb

echo.
echo 🌐 访问信息：
echo 使用端口转发访问应用：
echo kubectl port-forward svc/ruihuawebsite-service 3000:80
echo 然后访问: https://www.ruihuaconsulting.com (正式环境) 或 http://localhost:3000 (本地)
echo.
echo 管理后台: https://www.ruihuaconsulting.com/admin/index.html
echo 默认管理员账号: zhice / zhiceruihua123
echo.
echo 查看应用日志:
echo kubectl logs -l app=ruihuawebsite-app -f
echo.
echo 查看 MongoDB 日志:
echo kubectl logs -l app=mongodb -f

pause