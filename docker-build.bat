@echo off
REM Docker 构建和部署脚本 (Windows)

setlocal

REM 配置变量
set IMAGE_NAME=ruihuawebsite
set IMAGE_TAG=latest
set CONTAINER_NAME=ruihuawebsite-app

echo 🚀 开始构建 Docker 镜像...

REM 构建镜像
docker build -t %IMAGE_NAME%:%IMAGE_TAG% .

if %errorlevel% neq 0 (
    echo ❌ 镜像构建失败
    exit /b 1
)

echo ✅ 镜像构建完成: %IMAGE_NAME%:%IMAGE_TAG%

REM 显示镜像信息
docker images | findstr %IMAGE_NAME%

echo.
echo 📋 可用的部署选项:
echo 1. 使用 docker-compose: docker-compose up -d
echo 2. 单独运行容器:
echo    docker run -d --name %CONTAINER_NAME% ^
echo      -p 3000:3000 ^
echo      -e NODE_ENV=production ^
echo      -e MONGODB_URL=mongodb://host.docker.internal:27017/ruihua_cms ^
echo      -v %cd%/public/uploads:/app/public/uploads ^
echo      %IMAGE_NAME%:%IMAGE_TAG%
echo.
echo 3. 推送到镜像仓库:
echo    docker tag %IMAGE_NAME%:%IMAGE_TAG% your-registry/%IMAGE_NAME%:%IMAGE_TAG%
echo    docker push your-registry/%IMAGE_NAME%:%IMAGE_TAG%

echo.
echo 🎉 构建完成！

pause