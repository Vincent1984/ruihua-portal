# 短信验证码服务配置指南

## 概述

本系统集成了短信验证码功能，用于预约表单的手机号验证。支持开发模式（模拟短信）和生产模式（真实短信发送）。

## 配置说明

### 环境变量配置

在 `.env` 文件中配置以下参数：

```env
# 短信配置
SMS_API_URL=https://rcs.uninets.com.cn/uninetsOutInterface/domesticSmsSend
SMS_USERNAME=rrxt
SMS_PASSWORD=Renrui123
# 开发模式：设置为true时使用模拟短信，false时使用真实短信服务
SMS_MOCK_MODE=true
```

### 模式说明

#### 开发模式 (SMS_MOCK_MODE=true)
- 不发送真实短信
- 验证码在服务器日志中显示
- 前端会显示验证码（仅开发环境）
- 适用于开发和测试阶段

#### 生产模式 (SMS_MOCK_MODE=false)
- 发送真实短信到用户手机
- 需要短信服务商签名报备
- 适用于正式环境

## 短信服务商配置

### 1. 签名报备
在短信服务商平台报备签名：`【瑞华智策】`

### 2. 模板报备
报备短信模板：
```
【瑞华智策】验证码为：{code} 你正在预约组织人效体检，需要进行验证码校验（3分钟内有效），请勿向任何人提供此验证码。
```

### 3. API参数格式
```json
{
  "loginname": "用户名",
  "password": "密码", 
  "phone": "手机号",
  "content": "短信内容"
}
```

### 4. 请求头设置
```
Content-Type: application/json; charset=utf-8
```

## 功能特性

### 验证码规则
- 6位随机数字
- 有效期：3分钟
- 同一手机号3分钟内只能发送一次
- 验证码使用后自动失效

### 安全特性
- 手机号格式验证（11位中国大陆手机号）
- 频率限制防刷
- 验证码自动过期
- 数据库自动清理过期验证码

## API接口

### 发送验证码
```
POST /api/send-verification-code
Content-Type: application/json

{
  "phone": "13800138000"
}
```

**成功响应：**
```json
{
  "success": true,
  "message": "验证码已发送",
  "expiresIn": 180
}
```

**开发模式额外返回：**
```json
{
  "success": true,
  "message": "验证码已发送（模拟模式）",
  "expiresIn": 180,
  "mockCode": "123456"
}
```

### 预约提交（包含验证码验证）
```
POST /api/appointments
Content-Type: application/json

{
  "name": "张三",
  "phone": "13800138000",
  "company": "测试公司",
  "title": "CEO",
  "problem": "问题描述",
  "verificationCode": "123456",
  "source": "form1.html"
}
```

## 错误处理

### 常见错误码
- `UN:-22`: 签名未报备
- `UN:-1`: 用户名或密码错误
- 频率限制：返回剩余等待时间

### 错误响应示例
```json
{
  "error": "验证码发送过于频繁，请稍后再试",
  "remainingTime": 120
}
```

## 部署注意事项

### Docker部署
在 `docker-compose.yml` 中添加环境变量：
```yaml
environment:
  - SMS_API_URL=https://rcs.uninets.com.cn/uninetsOutInterface/domesticSmsSend
  - SMS_USERNAME=rrxt
  - SMS_PASSWORD=Renrui123
  - SMS_MOCK_MODE=false
```

### K8s部署
在 `k8s/configmap.yaml` 中添加配置：
```yaml
data:
  SMS_API_URL: "https://rcs.uninets.com.cn/uninetsOutInterface/domesticSmsSend"
  SMS_USERNAME: "rrxt"
  SMS_PASSWORD: "Renrui123"
  SMS_MOCK_MODE: "false"
```

## 测试验证

### 开发环境测试
1. 设置 `SMS_MOCK_MODE=true`
2. 访问预约页面
3. 填写手机号并点击获取验证码
4. 查看浏览器弹窗或服务器日志获取验证码
5. 输入验证码完成预约

### 生产环境测试
1. 确保签名和模板已报备
2. 设置 `SMS_MOCK_MODE=false`
3. 使用真实手机号测试
4. 验证短信接收和验证码功能

## 监控和日志

### 日志记录
- 模拟模式：`[模拟短信] 发送到 {phone}: 验证码 {code}`
- 发送失败：`SMS send failed: {error}`
- API错误：`SMS API Error: {error}`

### 监控指标
- 验证码发送成功率
- 验证码验证成功率
- API响应时间
- 错误率统计