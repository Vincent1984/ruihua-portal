# 使用官方 Node.js 运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖（如果需要）
RUN apk add --no-cache \
    ca-certificates \
    tzdata

# 设置时区
ENV TZ=Asia/Shanghai

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装项目依赖
RUN npm install --omit=dev && npm cache clean --force

# 复制配置文件
COPY config/ ./config/

# 复制应用代码
COPY server.js ./
COPY models/ ./models/

# 复制静态资源
COPY public/ ./public/

# 创建必要的目录
RUN mkdir -p public/uploads && \
    mkdir -p logs && \
    chown -R node:node /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动应用
CMD ["node", "server.js"]